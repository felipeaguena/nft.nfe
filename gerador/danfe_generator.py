import os
import io
import re
import xml.etree.ElementTree as ET
from datetime import datetime
import pymupdf as fitz
import barcode
from barcode.writer import ImageWriter

try:
    from brazilfiscalreport.danfe import Danfe as BFRDanfe, DanfeConfig
    from brazilfiscalreport.danfe.danfe_emit_info import DanfeEmitInfo
    HAS_BFR = True

    # Customiza a renderização do bloco do emitente no padrão oficial NFT Logistics
    # (Logo quadrada à esquerda, nome do emitente à direita e endereço completo centralizado na base)
    def _custom_danfe_emit_render(self):
        from brazilfiscalreport.pdf_element import Element
        Element.render(self)

        # 1. Logotipo quadrado à esquerda (proporção 1:1)
        logo_size = 18.0
        logo_x = self.x + 2.5
        logo_y = self.y + 2.0

        has_logo = False
        if self.logo_image and os.path.exists(str(self.logo_image)):
            try:
                self.pdf.image(
                    name=str(self.logo_image),
                    x=logo_x,
                    y=logo_y,
                    w=logo_size,
                    h=logo_size,
                    keep_aspect_ratio=True,
                )
                has_logo = True
            except Exception as e:
                print(f"Aviso ao desenhar logotipo no DANFE: {e}")

        # 2. Nome do Emitente à direita da logo
        emit_name = (self.emit or '').strip().upper()
        if has_logo:
            name_x = logo_x + logo_size + 2.5
            name_w = self.w - (name_x - self.x) - 2.0
        else:
            name_x = self.x + 2.0
            name_w = self.w - 4.0

        font_sz = 11.5 if len(emit_name) <= 22 else (10.0 if len(emit_name) <= 32 else 8.5)
        self.pdf.set_font(self.pdf.default_font, 'B', font_sz)
        name_y = self.y + (logo_size / 2.0) - 2.0
        self.pdf.set_xy(x=name_x, y=name_y)
        self.pdf.multi_cell(w=name_w, h=4.2, text=emit_name, border=0, align='C')

        # 3. Endereço Completo na parte inferior do quadro (centralizado, negrito)
        addr_text = ''
        try:
            emit_el = getattr(self.pdf, 'emit', None)
            if emit_el is not None:
                def _t(tag):
                    n = emit_el.find(f'.//{{http://www.portalfiscal.inf.br/nfe}}{tag}')
                    if n is None: n = emit_el.find(f'.//{tag}')
                    return (n.text or '').strip() if n is not None else ''

                lgr = _t('xLgr')
                nro = _t('nro')
                cpl = _t('xCpl')
                bairro = _t('xBairro')
                mun = _t('xMun')
                uf = _t('UF')
                cep = re.sub(r'\D', '', _t('CEP'))
                fone = _t('fone')

                # Abreviações oficiais
                lgr = re.sub(r'^\s*Avenida\b\.?', 'AV.', lgr, flags=re.I)
                lgr = re.sub(r'^\s*Av\b\.?', 'AV.', lgr, flags=re.I)
                lgr = re.sub(r'^\s*Rua\b\.?', 'RUA', lgr, flags=re.I)
                lgr = re.sub(r'\bDoutor\b\.?', 'DR.', lgr, flags=re.I)
                lgr = re.sub(r'\bDr\b\.?', 'DR.', lgr, flags=re.I)

                partes = []
                lgr_nro = f'{lgr}, {nro}'.upper() if nro else lgr.upper()
                if lgr_nro: partes.append(lgr_nro)
                if cpl: partes.append(cpl.upper())
                if bairro: partes.append(bairro.upper())
                
                # Município e UF (ex: Sao Paulo, SP conforme padrão da imagem)
                loc = f'{mun}, {uf.upper()}' if (mun and uf) else (mun or uf.upper())
                cep_str = f'CEP: {cep}' if cep else ''
                
                end_base = ' - '.join(partes)
                if loc and cep_str:
                    addr_text = f'{end_base}, {loc} - {cep_str}'
                elif loc:
                    addr_text = f'{end_base}, {loc}'
                else:
                    addr_text = end_base
                if fone:
                    addr_text += f' - FONE: {fone}'
        except Exception:
            pass

        if not addr_text:
            raw_addr = str(self.address or '').strip()
            lines = [l.strip() for l in raw_addr.replace('\r', '').split('\n') if l.strip()]
            addr_text = ' - '.join(lines)
            addr_text = re.sub(r'\bAvenida\b\.?', 'AV.', addr_text, flags=re.I)
            addr_text = re.sub(r'\bDoutor\b\.?', 'DR.', addr_text, flags=re.I)
            addr_text = re.sub(r'\s*Fone:\s*$', '', addr_text, flags=re.I)

        addr_text = re.sub(r'[ 	]+', ' ', addr_text).strip()
        addr_text = re.sub(r'\s*-\s*', ' - ', addr_text)

        addr_y = self.y + logo_size + 2.5
        addr_x = self.x + 2.0
        addr_w = self.w - 4.0

        self.pdf.set_font(self.pdf.default_font, 'B', 7.2)
        self.pdf.set_xy(x=addr_x, y=addr_y)
        self.pdf.multi_cell(w=addr_w, h=3.2, text=addr_text, border=0, align='C')

    DanfeEmitInfo.render = _custom_danfe_emit_render
except Exception as e_bfr_import:
    HAS_BFR = False
    print(f"Aviso: BrazilFiscalReport não pôde ser importado ({e_bfr_import}). Usando renderizador legado.")

class DanfeGenerator:
    def __init__(self, template_path=None, logo_path=None):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if template_path is None:
            template_path = os.path.join(base_dir, "modelo", "danfe_template_clean.pdf")
        self.template_path = template_path

        if logo_path is None:
            # Imagem oficial definida pelo usuário: NFTLogoBlackCompact.png (quadrado 1:1)
            default_logo = os.path.join(base_dir, "static", "img", "brand", "NFTLogoBlackCompact.png")
            if not os.path.exists(default_logo):
                default_logo = os.path.join(base_dir, "static", "img", "brand", "NFTLogoBlackCompact.webp")
            if not os.path.exists(default_logo):
                default_logo = os.path.join(base_dir, "static", "img", "brand", "nft_logo_completo-black.png")
            if os.path.exists(default_logo):
                logo_path = default_logo
        self.logo_path = logo_path

    def get_logo_for_emitter(self, xml_bytes):
        """
        Identifica o CNPJ do emitente no XML e recupera o logotipo quadrado cadastrado
        para esta empresa no banco de dados (Turso / SQLite / R2). Se não houver logotipo personalizado,
        utiliza o logotipo padrão da NFT Logistics.
        """
        try:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_bytes)
            ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}
            cnpj_el = root.find('.//nfe:emit/nfe:CNPJ', ns) or root.find('.//emit/CNPJ')
            if cnpj_el is not None and cnpj_el.text:
                raw_cnpj = re.sub(r'\D', '', cnpj_el.text).strip()
                if raw_cnpj:
                    base_dir = os.path.dirname(os.path.abspath(__file__))
                    from app import get_db_connection
                    conn = get_db_connection()
                    c = conn.cursor()
                    row = c.execute(
                        "SELECT id, logo_url FROM cadastros WHERE REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '') = ? AND logo_url IS NOT NULL AND logo_url != '' ORDER BY id DESC LIMIT 1",
                        (raw_cnpj,)
                    ).fetchone()
                    conn.close()
                    if row:
                        emp_id = row['id'] if hasattr(row, '__getitem__') else row[0]
                        # Verifica se já está em disco local
                        local_dir = os.path.join(base_dir, 'static', 'uploads', 'empresas')
                        for ext in ('.png', '.jpg', '.jpeg', '.webp'):
                            cand = os.path.join(local_dir, f"logo_{emp_id}{ext}")
                            if os.path.exists(cand):
                                return cand
                        # Tenta obter do Cloudflare R2
                        try:
                            import r2_storage
                            for ext in ('.png', '.jpg', '.jpeg', '.webp'):
                                r2_key = f"empresas/logo_{emp_id}{ext}"
                                b = r2_storage.get_file_bytes_r2(r2_key)
                                if b:
                                    os.makedirs(local_dir, exist_ok=True)
                                    target_p = os.path.join(local_dir, f"logo_{emp_id}{ext}")
                                    with open(target_p, 'wb') as lf:
                                        lf.write(b)
                                    return target_p
                        except Exception:
                            pass
        except Exception as e:
            print(f"Aviso ao consultar logotipo do emitente: {e}")

        return self.logo_path

    @staticmethod
    def format_currency(val):
        try:
            f = float(val) if val is not None else 0.0
            return f"{f:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return "0,00"

    @staticmethod
    def format_qty(val, decimals=4):
        try:
            f = float(val) if val is not None else 0.0
            fmt = f"{{:,.{decimals}f}}"
            return fmt.format(f).replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return "0,0000"

    @staticmethod
    def format_weight(val):
        try:
            f = float(val) if val is not None else 0.0
            return f"{f:,.3f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return "0,000"

    @staticmethod
    def format_cnpj_cpf(val):
        val = re.sub(r"\D", "", str(val or ""))
        if len(val) == 14:
            return f"{val[:2]}.{val[2:5]}.{val[5:8]}/{val[8:12]}-{val[12:]}"
        elif len(val) == 11:
            return f"{val[:3]}.{val[3:6]}.{val[6:9]}-{val[9:]}"
        return val

    @staticmethod
    def format_cep(val):
        val = re.sub(r"\D", "", str(val or ""))
        if len(val) == 8:
            return f"{val[:5]}-{val[5:]}"
        return val

    @staticmethod
    def format_chave(chave):
        chave = re.sub(r"\D", "", str(chave or ""))
        return " ".join([chave[i:i+4] for i in range(0, len(chave), 4)])

    @staticmethod
    def format_doc_number(n_nf):
        try:
            n = int(re.sub(r"\D", "", str(n_nf or "0")))
            s = f"{n:09d}"
            return f"Nº. {s[:3]}.{s[3:6]}.{s[6:]}"
        except Exception:
            return f"Nº. {n_nf}"

    def parse_xml(self, xml_content_or_path):
        if os.path.exists(xml_content_or_path):
            with open(xml_content_or_path, "rb") as f:
                raw_bytes = f.read()
        else:
            raw_bytes = xml_content_or_path.encode("utf-8") if isinstance(xml_content_or_path, str) else bytes(xml_content_or_path)
            
        raw_bytes = self.enriquecer_xml_para_danfe(raw_bytes)
        root = ET.fromstring(raw_bytes)

        ns = {"nfe": "http://www.portalfiscal.inf.br/nfe"}
        if not root.tag.endswith("NFe") and not root.tag.endswith("nfeProc"):
            # Check without namespace
            pass

        # Helper xpath
        def find_txt(elem, path, default=""):
            if elem is None:
                return default
            node = elem.find(path, ns)
            if node is None:
                # try without prefix
                clean_path = re.sub(r"nfe:", "", path)
                node = elem.find(clean_path)
            return node.text.strip() if (node is not None and node.text) else default

        # Extrair chave e protocolo se for nfeProc ou se tiver infProt
        chave = ""
        prot_txt = ""
        inf_prot = root.find(".//nfe:infProt", ns) or root.find(".//infProt")
        if inf_prot is not None:
            chave = find_txt(inf_prot, "nfe:chNFe")
            n_prot = find_txt(inf_prot, "nfe:nProt")
            dh_rec = find_txt(inf_prot, "nfe:dhRecbto")
            if dh_rec:
                try:
                    dt = datetime.fromisoformat(dh_rec.replace("Z", "+00:00"))
                    dh_rec_str = dt.strftime("%d/%m/%Y %H:%M:%S")
                except Exception:
                    dh_rec_str = dh_rec
                prot_txt = f"{n_prot}  -  {dh_rec_str}"
            else:
                prot_txt = n_prot

        inf_nfe = root.find(".//nfe:infNFe", ns) or root.find(".//infNFe")
        if not chave and inf_nfe is not None:
            nfe_id = inf_nfe.attrib.get("Id", "")
            chave = re.sub(r"\D", "", nfe_id)

        ide = inf_nfe.find("nfe:ide", ns) or inf_nfe.find("ide") if inf_nfe is not None else None
        emit = inf_nfe.find("nfe:emit", ns) or inf_nfe.find("emit") if inf_nfe is not None else None
        dest = inf_nfe.find("nfe:dest", ns) or inf_nfe.find("dest") if inf_nfe is not None else None
        tot = inf_nfe.find(".//nfe:ICMSTot", ns) or inf_nfe.find(".//ICMSTot") if inf_nfe is not None else None
        transp = inf_nfe.find("nfe:transp", ns) or inf_nfe.find("transp") if inf_nfe is not None else None
        inf_adic = inf_nfe.find("nfe:infAdic", ns) or inf_nfe.find("infAdic") if inf_nfe is not None else None

        # IDE
        n_nf = find_txt(ide, "nfe:nNF", "0")
        serie = str(int(find_txt(ide, "nfe:serie", "1"))).zfill(3)
        tp_nf = find_txt(ide, "nfe:tpNF", "1")
        nat_op = find_txt(ide, "nfe:natOp", "")
        dh_emi = find_txt(ide, "nfe:dhEmi", "")
        dh_sai_ent = find_txt(ide, "nfe:dhSaiEnt", "")

        def parse_dt(dt_str):
            if not dt_str:
                return "", ""
            try:
                dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                return dt.strftime("%d/%m/%Y"), dt.strftime("%H:%M:%S")
            except Exception:
                parts = dt_str.split("T")
                d_p = parts[0].split("-")
                d_fmt = f"{d_p[2]}/{d_p[1]}/{d_p[0]}" if len(d_p) == 3 else dt_str
                h_fmt = parts[1][:8] if len(parts) > 1 else "00:00:00"
                return d_fmt, h_fmt

        dt_emi, _ = parse_dt(dh_emi)
        dt_sai, hr_sai = parse_dt(dh_sai_ent)

        # EMITENTE
        x_emit = find_txt(emit, "nfe:xNome", "NFT LOGISTICS LTDA")

        # DESTINATÁRIO
        x_dest = find_txt(dest, "nfe:xNome", "")
        cnpj_dest = find_txt(dest, "nfe:CNPJ") or find_txt(dest, "nfe:CPF") or find_txt(dest, "nfe:idEstrangeiro")
        ie_dest = find_txt(dest, "nfe:IE", "ISENTO")
        ender_dest = dest.find("nfe:enderDest", ns) if dest is not None else None
        x_lgr = find_txt(ender_dest, "nfe:xLgr")
        nro = find_txt(ender_dest, "nfe:nro")
        x_cpl = find_txt(ender_dest, "nfe:xCpl")
        dest_logr = f"{x_lgr}, {nro}" + (f" - {x_cpl}" if x_cpl else "")
        bairro_dest = find_txt(ender_dest, "nfe:xBairro")
        cep_dest = find_txt(ender_dest, "nfe:CEP")
        mun_dest = find_txt(ender_dest, "nfe:xMun")
        uf_dest = find_txt(ender_dest, "nfe:UF")
        fone_dest = find_txt(ender_dest, "nfe:fone")

        # TOTAIS
        v_bc = find_txt(tot, "nfe:vBC", "0.00")
        v_icms = find_txt(tot, "nfe:vICMS", "0.00")
        v_bc_st = find_txt(tot, "nfe:vBCST", "0.00")
        v_st = find_txt(tot, "nfe:vST", "0.00")
        v_ii = find_txt(tot, "nfe:vII", "0.00")
        v_pis = find_txt(tot, "nfe:vPIS", "0.00")
        v_prod = find_txt(tot, "nfe:vProd", "0.00")
        v_frete = find_txt(tot, "nfe:vFrete", "0.00")
        v_seg = find_txt(tot, "nfe:vSeg", "0.00")
        v_desc = find_txt(tot, "nfe:vDesc", "0.00")
        v_outro = find_txt(tot, "nfe:vOutro", "0.00")
        v_ipi = find_txt(tot, "nfe:vIPI", "0.00")
        v_cofins = find_txt(tot, "nfe:vCOFINS", "0.00")
        v_nf = find_txt(tot, "nfe:vNF", "0.00")

        # TRANSPORTE
        mod_frete = find_txt(transp, "nfe:modFrete", "1")
        frete_modalidade_map = {
            "0": "0-Emitente",
            "1": "1-Destinatário",
            "2": "2-Terceiros",
            "3": "3-Próprio Rem.",
            "4": "4-Próprio Dest.",
            "9": "9-Sem Frete"
        }
        frete_desc = frete_modalidade_map.get(str(mod_frete), "1-Destinatário")

        transp_aero = transp.find("nfe:transporta", ns) if transp is not None else None
        x_transp = find_txt(transp_aero, "nfe:xNome")
        cnpj_transp = find_txt(transp_aero, "nfe:CNPJ") or find_txt(transp_aero, "nfe:CPF")
        ie_transp = find_txt(transp_aero, "nfe:IE")
        end_transp = find_txt(transp_aero, "nfe:xEnder")
        mun_transp = find_txt(transp_aero, "nfe:xMun")
        uf_transp = find_txt(transp_aero, "nfe:UF")

        veic = transp.find("nfe:veicTransp", ns) if transp is not None else None
        placa = find_txt(veic, "nfe:placa")
        uf_veic = find_txt(veic, "nfe:UF")
        rntc = find_txt(veic, "nfe:RNTC")

        vol = transp.find("nfe:vol", ns) if transp is not None else None
        q_vol = find_txt(vol, "nfe:qVol")
        esp_vol = find_txt(vol, "nfe:esp")
        marca_vol = find_txt(vol, "nfe:marca")
        n_vol = find_txt(vol, "nfe:nVol")
        peso_l = find_txt(vol, "nfe:pesoL")
        peso_b = find_txt(vol, "nfe:pesoB")

        # PRODUTOS
        det_list = inf_nfe.findall("nfe:det", ns) if inf_nfe is not None else []
        itens = []
        for det in det_list:
            p = det.find("nfe:prod", ns)
            imposto = det.find("nfe:imposto", ns)
            c_prod = find_txt(p, "nfe:cProd")
            x_prod = find_txt(p, "nfe:xProd")
            ncm = find_txt(p, "nfe:NCM")
            cfop = find_txt(p, "nfe:CFOP")
            u_com = find_txt(p, "nfe:uCom")
            q_com = find_txt(p, "nfe:qCom")
            v_un_com = find_txt(p, "nfe:vUnCom")
            u_trib = find_txt(p, "nfe:uTrib")
            q_trib = find_txt(p, "nfe:qTrib")
            v_un_trib = find_txt(p, "nfe:vUnTrib")
            v_prod_item = find_txt(p, "nfe:vProd")

            # Orig / CSOSN / CST
            icms_det = imposto.find(".//nfe:ICMS", ns) if imposto is not None else None
            orig = "0"
            cst_csosn = ""
            v_bc_item = "0.00"
            v_icms_item = "0.00"
            p_icms_item = "0.00"
            if icms_det is not None and len(icms_det) > 0:
                child = icms_det[0]
                orig = find_txt(child, "nfe:orig", "0")
                cst_csosn = find_txt(child, "nfe:CSOSN") or find_txt(child, "nfe:CST")
                v_bc_item = find_txt(child, "nfe:vBC", "0.00")
                v_icms_item = find_txt(child, "nfe:vICMS", "0.00")
                p_icms_item = find_txt(child, "nfe:pICMS", "0.00")

            ipi_det = imposto.find(".//nfe:IPI", ns) if imposto is not None else None
            v_ipi_item = find_txt(ipi_det, ".//nfe:vIPI", "0.00")
            p_ipi_item = find_txt(ipi_det, ".//nfe:pIPI", "0.00")

            itens.append({
                "cProd": c_prod,
                "xProd": x_prod,
                "infAdProd": find_txt(det, "nfe:infAdProd"),
                "NCM": ncm,
                "orig_csosn": f"{orig}/{cst_csosn}" if cst_csosn else orig,
                "CFOP": cfop,
                "uCom": u_com,
                "qCom": q_com,
                "vUnCom": v_un_com,
                "uTrib": u_trib,
                "qTrib": q_trib,
                "vUnTrib": v_un_trib,
                "vProd": v_prod_item,
                "vBC": v_bc_item,
                "vICMS": v_icms_item,
                "vIPI": v_ipi_item,
                "pICMS": p_icms_item,
                "pIPI": p_ipi_item
            })

        # DADOS ADICIONAIS
        inf_cpl = find_txt(inf_adic, "nfe:infCpl")

        return {
            "chave": chave,
            "protocolo": prot_txt,
            "nNF": n_nf,
            "serie": serie,
            "tpNF": tp_nf,
            "natOp": nat_op,
            "dtEmi": dt_emi,
            "dtSai": dt_sai,
            "hrSai": hr_sai,
            "emitente": {"xNome": x_emit},
            "destinatario": {
                "xNome": x_dest,
                "cnpj_cpf": self.format_cnpj_cpf(cnpj_dest),
                "endereco": dest_logr,
                "bairro": bairro_dest,
                "cep": self.format_cep(cep_dest),
                "municipio": mun_dest,
                "uf": uf_dest,
                "fone": fone_dest,
                "ie": ie_dest
            },
            "totais": {
                "vBC": self.format_currency(v_bc),
                "vICMS": self.format_currency(v_icms),
                "vBCST": self.format_currency(v_bc_st),
                "vST": self.format_currency(v_st),
                "vII": self.format_currency(v_ii),
                "vPIS": self.format_currency(v_pis),
                "vProd": self.format_currency(v_prod),
                "vFrete": self.format_currency(v_frete),
                "vSeg": self.format_currency(v_seg),
                "vDesc": self.format_currency(v_desc),
                "vOutro": self.format_currency(v_outro),
                "vIPI": self.format_currency(v_ipi),
                "vCOFINS": self.format_currency(v_cofins),
                "vNF": self.format_currency(v_nf)
            },
            "transporte": {
                "frete": frete_desc,
                "xNome": x_transp,
                "cnpj_cpf": self.format_cnpj_cpf(cnpj_transp),
                "ie": ie_transp,
                "endereco": end_transp,
                "municipio": mun_transp,
                "uf": uf_transp,
                "placa": placa,
                "ufVeic": uf_veic,
                "antt": rntc,
                "qVol": q_vol,
                "esp": esp_vol,
                "marca": marca_vol,
                "num": n_vol,
                "pesoB": self.format_weight(peso_b) if peso_b else "",
                "pesoL": self.format_weight(peso_l) if peso_l else ""
            },
            "itens": itens,
            "infCpl": inf_cpl
        }

    def generate_barcode_image(self, chave):
        chave_clean = re.sub(r"\D", "", chave)
        if len(chave_clean) != 44:
            return None
        if ImageWriter is None:
            return None
        try:
            code128 = barcode.get("code128", chave_clean, writer=ImageWriter())
            fp = io.BytesIO()
            code128.write(fp, options={
                "write_text": False,
                "quiet_zone": 1.0,
                "module_height": 10.0,
                "font_size": 0
            })
            fp.seek(0)
            return fp.getvalue()
        except Exception as e_bc:
            print(f"Aviso ao gerar código de barras: {e_bc}")
            return None

    def enriquecer_xml_para_danfe(self, xml_bytes):
        """
        Garante que cada item (<det>) possua as informações adicionais
        (DI, adição, item e kg líquido/peso) para exibição visual no DANFE,
        mesmo que o XML original da SEFAZ não tenha a tag <infAdProd>.
        """
        try:
            from lxml import etree as _etree
            root = _etree.fromstring(xml_bytes)
            ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}
            
            # 1. Busca DI global no infCpl caso itens não tenham tag <DI> explícita
            inf_cpl = root.findtext('.//nfe:infAdic/nfe:infCpl', default='', namespaces=ns)
            m_di_global = re.search(r'DI:\s*([0-9\/\.\-]+)', inf_cpl)
            di_global = m_di_global.group(1).strip() if m_di_global else ""

            # 2. Busca se há dados complementares no banco (rascunhos) pela chave
            chave_nfe = ""
            inf_nfe = root.find('.//nfe:infNFe', ns)
            if inf_nfe is not None:
                chave_nfe = re.sub(r'\D', '', inf_nfe.attrib.get('Id', ''))
            
            itens_db_map = {}
            if chave_nfe and len(chave_nfe) == 44:
                try:
                    from app import get_db_connection
                    import json
                    conn = get_db_connection()
                    c = conn.cursor()
                    r_rasc = c.execute(
                        "SELECT payload_json FROM rascunhos WHERE REPLACE(chave_acesso, ' ', '') = ? ORDER BY id DESC LIMIT 1",
                        (chave_nfe,)
                    ).fetchone()
                    if not r_rasc and len(chave_nfe) >= 34:
                        n_nf_num = str(int(chave_nfe[25:34]))
                        r_rasc = c.execute(
                            "SELECT payload_json FROM rascunhos WHERE REPLACE(referencia_interna, ' ', '') LIKE ? OR payload_json LIKE ? ORDER BY id DESC LIMIT 1",
                            (f"%{n_nf_num}%", f"%\"nNF\": \"{n_nf_num}\"%")
                        ).fetchone()
                    conn.close()
                    if r_rasc and r_rasc['payload_json']:
                        p_data = json.loads(r_rasc['payload_json'])
                        dc_itens = p_data.get('dados_completos', {}).get('itens', []) or p_data.get('itens', [])
                        for it_idx, it_obj in enumerate(dc_itens, 1):
                            itens_db_map[it_idx] = it_obj
                            if it_obj.get('cProd'):
                                itens_db_map[str(it_obj['cProd']).strip()] = it_obj
                except Exception:
                    pass

            # 3. Itera sobre cada <det> e garante a informação adicional
            dets = root.findall('.//nfe:det', ns)
            modificado = False
            for idx, det in enumerate(dets, 1):
                c_prod = det.findtext('.//nfe:cProd', default='', namespaces=ns).strip()
                prod_el = det.find('nfe:prod', ns)
                if prod_el is None:
                    continue

                it_db = itens_db_map.get(idx) or itens_db_map.get(c_prod) or {}

                # Extrai DI do XML
                n_di = det.findtext('.//nfe:DI/nfe:nDI', default='', namespaces=ns).strip()
                n_adic = det.findtext('.//nfe:DI/nfe:adi/nfe:nAdicao', default='', namespaces=ns).strip()
                n_seq = det.findtext('.//nfe:DI/nfe:adi/nfe:nSeqAdic', default='', namespaces=ns).strip()

                if it_db.get('infAdProd') and 'DI:' in it_db['infAdProd']:
                    inf_db_txt = it_db['infAdProd']
                    m_di_b = re.search(r'DI:\s*([0-9\/\.\-]+)', inf_db_txt)
                    m_ad_b = re.search(r'Adic(?:ao|ão)?:\s*(\d+)', inf_db_txt, re.I)
                    m_it_b = re.search(r'Item:\s*(\d+)', inf_db_txt, re.I)
                    if m_di_b: n_di = m_di_b.group(1).strip()
                    if m_ad_b: n_adic = m_ad_b.group(1).strip()
                    if m_it_b: n_seq = m_it_b.group(1).strip()

                if not n_di:
                    n_di = str(it_db.get('nDI') or di_global or '').strip()
                if not n_adic:
                    n_adic = str(it_db.get('nAdicao') or '').strip()
                if not n_seq:
                    n_seq = str(it_db.get('nSeqAdic') or det.attrib.get('nItem') or idx).strip()

                peso_l = str(it_db.get('pesoL') or it_db.get('kg_liquido') or it_db.get('peso_liquido') or '').strip()
                if not peso_l:
                    u_trib = det.findtext('.//nfe:uTrib', default='', namespaces=ns).strip().upper()
                    if u_trib == 'KG':
                        q_trib = det.findtext('.//nfe:qTrib', default='', namespaces=ns).strip()
                        if q_trib and float(q_trib or 0) > 0:
                            peso_l = q_trib

                inf_ad_el = det.find('nfe:infAdProd', ns)
                inf_ad_txt = inf_ad_el.text.strip() if (inf_ad_el is not None and inf_ad_el.text) else ""
                inf_db = str(it_db.get('infAdProd') or '').strip()

                partes = []
                if n_di:
                    raw_adic = re.sub(r'\D', '', n_adic).lstrip('0') or '1'
                    raw_seq = re.sub(r'\D', '', n_seq).lstrip('0') or str(idx)
                    di_str = f"DI: {n_di} Adicao: {int(raw_adic):03d} Item: {int(raw_seq):03d}"
                    partes.append(di_str)

                if peso_l and peso_l not in ('0', '0.00', '0.000', '0,00', '0,000'):
                    peso_fmt = peso_l.replace(',', '.')
                    try:
                        peso_fmt = f"{float(peso_fmt):.3f}"
                    except Exception:
                        pass
                    partes.append(f"Peso Liq: {peso_fmt} kg")

                texto_extra = inf_ad_txt or inf_db
                if texto_extra:
                    t_limpo = texto_extra
                    t_limpo = re.sub(r'DI:\s*[\w\.\/\-]+(?:\s+(?:Adicao|Adição|Adic)\s*:?\s*\d+)?(?:\s+(?:Item|Seq)\s*:?\s*\d+)?', '', t_limpo, flags=re.I)
                    t_limpo = re.sub(r'(?:Peso\s*L[ií]q(?:uido)?|Kg\s*L[ií]q(?:uido)?)\s*[:=]?\s*[\d.,]+\s*(?:kg)?', '', t_limpo, flags=re.I)
                    t_limpo = re.sub(r'[\s\-\–\—;:]{2,}', ' - ', t_limpo).strip(' -;:,')
                    if t_limpo and t_limpo not in partes:
                        partes.append(t_limpo)

                if partes:
                    final_inf_ad = " - ".join(partes)
                    if inf_ad_el is not None:
                        if inf_ad_el.text != final_inf_ad:
                            inf_ad_el.text = final_inf_ad
                            modificado = True
                    else:
                        new_inf = _etree.SubElement(det, '{http://www.portalfiscal.inf.br/nfe}infAdProd')
                        new_inf.text = final_inf_ad
                        modificado = True

            if modificado:
                return _etree.tostring(root, encoding='utf-8')
            return xml_bytes
        except Exception as e_enrich:
            print(f"Aviso ao enriquecer XML para DANFE: {e_enrich}")
            return xml_bytes

    def render(self, xml_path_or_content, output_pdf_path):
        if HAS_BFR:
            try:
                xml_bytes = None
                if isinstance(xml_path_or_content, (bytes, bytearray)):
                    xml_bytes = bytes(xml_path_or_content)
                elif isinstance(xml_path_or_content, str):
                    if xml_path_or_content.strip().startswith('<') or len(xml_path_or_content) > 300:
                        xml_bytes = xml_path_or_content.encode("utf-8")
                    elif os.path.exists(xml_path_or_content):
                        with open(xml_path_or_content, "rb") as f:
                            xml_bytes = f.read()
                    else:
                        xml_bytes = xml_path_or_content.encode("utf-8")
                else:
                    xml_bytes = bytes(xml_path_or_content)

                # Enriquecimento visual para DANFE: garante informações adicionais em cada item
                xml_bytes = self.enriquecer_xml_para_danfe(xml_bytes)

                is_cancelada = bool(
                    b'<cStat>101</cStat>' in xml_bytes
                    or b'110111' in xml_bytes
                    or b'CANCELAMENTO' in xml_bytes.upper()
                )

                logo_to_use = self.get_logo_for_emitter(xml_bytes)
                config = DanfeConfig(
                    logo=logo_to_use if (logo_to_use and os.path.exists(str(logo_to_use))) else None,
                    watermark_cancelled=is_cancelada
                )
                danfe = BFRDanfe(xml_bytes, config=config)
                pdf_bytes = danfe.output()
                with open(output_pdf_path, "wb") as f_out:
                    f_out.write(pdf_bytes)
                print(f"DANFE PDF gerado via BrazilFiscalReport em: {output_pdf_path}")
                return
            except Exception as e_bfr:
                print(f"Aviso: Falha ao gerar DANFE via BrazilFiscalReport ({e_bfr}). Recorrendo ao layout legado.")

        self._render_legacy(xml_path_or_content, output_pdf_path)

    def _render_legacy(self, xml_path_or_content, output_pdf_path):
        data = self.parse_xml(xml_path_or_content)
        doc = fitz.open(self.template_path)
        page = doc[0]

        # Inserir Código de Barras
        if data["chave"]:
            img_bytes = self.generate_barcode_image(data["chave"])
            if img_bytes:
                # Retângulo do código de barras
                barcode_rect = fitz.Rect(355, 68, 582, 105)
                page.insert_image(barcode_rect, stream=img_bytes)

            # Chave formatada
            chave_fmt = self.format_chave(data["chave"])
            page.insert_text(fitz.Point(360.2, 129.0), chave_fmt, fontsize=8.0, fontname="Helvetica-Bold")

        # Canhoto do Rodapé / Topo
        n_nf_fmt = self.format_doc_number(data["nNF"])
        serie_fmt = f"Série {data['serie']}"
        page.insert_text(fitz.Point(498.3, 33.5), n_nf_fmt, fontsize=10.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(512.4, 43.5), serie_fmt, fontsize=10.0, fontname="Helvetica-Bold")

        canhoto_info = f"EMISSÃO: {data['dtEmi']}  VALOR TOTAL: R$ {data['totais']['vNF']}  DESTINATÁRIO: {data['destinatario']['xNome']} - {data['destinatario']['endereco']}"
        page.insert_text(fitz.Point(7.1, 23.5), canhoto_info[:120], fontsize=7.0, fontname="Helvetica")
        if data['destinatario']['bairro'] or data['destinatario']['municipio']:
            canhoto_loc = f"{data['destinatario']['bairro']} {data['destinatario']['municipio']}-{data['destinatario']['uf']}"
            page.insert_text(fitz.Point(7.1, 30.5), canhoto_loc, fontsize=7.0, fontname="Helvetica")

        # Cabeçalho DANFE
        page.insert_text(fitz.Point(324.1, 117.0), str(data["tpNF"]), fontsize=10.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(257.4, 134.5), n_nf_fmt, fontsize=10.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(271.4, 143.0), serie_fmt, fontsize=10.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(276.7, 151.5), "Folha 1/1", fontsize=8.0, fontname="Helvetica-Oblique")

        # Protocolo e Nat Op
        page.insert_text(fitz.Point(7.1, 172.0), data["natOp"][:45], fontsize=8.0, fontname="Helvetica-Bold")
        if data["protocolo"]:
            page.insert_text(fitz.Point(371.0, 172.0), data["protocolo"], fontsize=9.5, fontname="Helvetica-Bold")

        # Destinatário
        d = data["destinatario"]
        page.insert_text(fitz.Point(7.1, 223.0), d["xNome"][:45], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(364.2, 223.0), d["cnpj_cpf"], fontsize=9.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(517.8, 223.0), data["dtEmi"], fontsize=9.0, fontname="Helvetica-Bold")

        page.insert_text(fitz.Point(7.1, 243.0), d["endereco"][:45], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(282.0, 243.0), d["bairro"][:20], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(403.9, 243.0), d["cep"], fontsize=9.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(517.8, 243.0), data["dtSai"], fontsize=9.0, fontname="Helvetica-Bold")

        page.insert_text(fitz.Point(7.1, 263.0), d["municipio"][:35], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(285.3, 263.0), d["uf"], fontsize=9.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(304.7, 263.0), d["fone"][:15], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(401.1, 263.0), d["ie"], fontsize=9.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(522.8, 263.0), data["hrSai"], fontsize=9.0, fontname="Helvetica-Bold")

        # Totais e Impostos
        # Linha 1 (Y=294): vBC, vICMS, vBCST, vST, vII, vPIS, vProd
        t = data["totais"]
        def r_align(text, x_right, y, sz=8.0):
            # approximate width for Helvetica bold
            w = fitz.get_text_length(text, fontname="Helvetica-Bold", fontsize=sz)
            page.insert_text(fitz.Point(x_right - w, y), text, fontsize=sz, fontname="Helvetica-Bold")

        r_align(t["vBC"], 87.7, 294.0)
        r_align(t["vICMS"], 171.1, 294.0)
        r_align(t["vBCST"], 254.5, 294.0)
        r_align(t["vST"], 337.9, 294.0)
        r_align(t["vII"], 421.4, 294.0)
        r_align(t["vPIS"], 504.8, 294.0)
        r_align(t["vProd"], 588.2, 294.0)

        # Linha 2 (Y=314): vFrete, vSeg, vDesc, vOutro, vIPI, vCOFINS, vNF
        r_align(t["vFrete"], 87.7, 314.0)
        r_align(t["vSeg"], 171.1, 314.0)
        r_align(t["vDesc"], 254.5, 314.0)
        r_align(t["vOutro"], 337.9, 314.0)
        r_align(t["vIPI"], 421.4, 314.0)
        r_align(t["vCOFINS"], 504.8, 314.0)
        r_align(t["vNF"], 588.2, 314.0)

        # Transportador
        tr = data["transporte"]
        page.insert_text(fitz.Point(7.1, 345.0), tr["xNome"][:35], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(185.5, 345.0), tr["frete"], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(265.0, 345.0), tr["antt"], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(352.0, 345.0), tr["placa"], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(440.0, 345.0), tr["ufVeic"], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(462.0, 345.0), tr["cnpj_cpf"], fontsize=8.0, fontname="Helvetica-Bold")

        page.insert_text(fitz.Point(7.1, 365.0), tr["endereco"][:45], fontsize=7.5, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(265.0, 365.0), tr["municipio"][:25], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(440.0, 365.0), tr["uf"], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(492.0, 365.0), tr["ie"], fontsize=8.0, fontname="Helvetica-Bold")

        if tr["qVol"]:
            page.insert_text(fitz.Point(20.0, 385.0), str(tr["qVol"]), fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(66.2, 385.0), tr["esp"][:20], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(166.0, 385.0), tr["marca"][:15], fontsize=8.0, fontname="Helvetica-Bold")
        page.insert_text(fitz.Point(265.0, 385.0), tr["num"][:15], fontsize=8.0, fontname="Helvetica-Bold")
        if tr["pesoB"]:
            r_align(tr["pesoB"], 477.6, 385.0)
        if tr["pesoL"]:
            r_align(tr["pesoL"], 588.2, 385.0)

        # Itens da NF (Y inicial = 420.0)
        y_item = 420.0
        for it in data["itens"]:
            if y_item > 730:
                break # Se exceder a página 1 (no DANFE padrão cabe ~15 itens de 2 linhas)

            # Quebrar descrição em linhas de até 35 caracteres
            x_prod_lines = []
            words = it["xProd"].split(" ")
            cur_line = ""
            for w in words:
                if len(cur_line + " " + w) <= 35:
                    cur_line = (cur_line + " " + w).strip()
                else:
                    if cur_line:
                        x_prod_lines.append(cur_line)
                    cur_line = w
            if cur_line:
                x_prod_lines.append(cur_line)

            if it.get("infAdProd"):
                cur_inf = ""
                for w in str(it["infAdProd"]).strip().split(" "):
                    if len(cur_inf + " " + w) <= 35:
                        cur_inf = (cur_inf + " " + w).strip()
                    else:
                        if cur_inf:
                            x_prod_lines.append(cur_inf)
                        cur_inf = w
                if cur_inf:
                    x_prod_lines.append(cur_inf)

            # Imprimir linha 1 das colunas
            page.insert_text(fitz.Point(15.8, y_item), it["cProd"][:10], fontsize=5.0, fontname="Helvetica")
            page.insert_text(fitz.Point(46.8, y_item), x_prod_lines[0] if x_prod_lines else "", fontsize=5.0, fontname="Helvetica")
            page.insert_text(fitz.Point(181.6, y_item), it["NCM"][:8], fontsize=5.0, fontname="Helvetica")
            page.insert_text(fitz.Point(208.0, y_item), it["orig_csosn"][:6], fontsize=5.0, fontname="Helvetica")
            page.insert_text(fitz.Point(226.9, y_item), it["CFOP"][:4], fontsize=5.0, fontname="Helvetica")
            page.insert_text(fitz.Point(246.0, y_item), it["uCom"][:3], fontsize=5.0, fontname="Helvetica")
            
            # Alinhamentos numéricos
            def r_align_item(txt, x_right, y):
                w = fitz.get_text_length(txt, fontname="Helvetica", fontsize=5.0)
                page.insert_text(fitz.Point(x_right - w, y), txt, fontsize=5.0, fontname="Helvetica")

            r_align_item(self.format_qty(it["qCom"]), 296.2, y_item)
            r_align_item(self.format_qty(it["vUnCom"]), 330.2, y_item)
            page.insert_text(fitz.Point(336.7, y_item), it["uTrib"][:3], fontsize=5.0, fontname="Helvetica")
            r_align_item(self.format_qty(it["qTrib"]), 386.9, y_item)
            r_align_item(self.format_qty(it["vUnTrib"]), 420.9, y_item)
            r_align_item(self.format_currency(it["vProd"]), 455.0, y_item)
            r_align_item(self.format_currency(it["vBC"]), 489.0, y_item)
            r_align_item(self.format_currency(it["vICMS"]), 523.0, y_item)
            r_align_item(self.format_currency(it["vIPI"]), 550.0, y_item)
            r_align_item(self.format_currency(it["pICMS"]), 571.2, y_item)

            # Imprimir linhas subsequentes da descrição
            for extra_line in x_prod_lines[1:]:
                y_item += 5.0
                page.insert_text(fitz.Point(46.8, y_item), extra_line, fontsize=5.0, fontname="Helvetica")

            y_item += 9.0

        # Dados Adicionais / Inf Cpl (Y=762.0 a 820.0)
        if data["infCpl"]:
            # Quebrar texto em linhas de ~95 caracteres
            txt_cpl = data["infCpl"].replace("\r\n", " ").replace("\n", " ")
            cpl_words = txt_cpl.split(" ")
            cpl_lines = []
            c_line = "Inf. Contribuinte: "
            for w in cpl_words:
                if len(c_line + " " + w) <= 90:
                    c_line = (c_line + " " + w).strip()
                else:
                    cpl_lines.append(c_line)
                    c_line = w
            if c_line:
                cpl_lines.append(c_line)

            y_cpl = 762.0
            for l_txt in cpl_lines[:8]: # até 8 linhas
                page.insert_text(fitz.Point(7.1, y_cpl), l_txt, fontsize=7.5, fontname="Helvetica")
                y_cpl += 8.0

        # Rodapé com data/hora de impressão
        now_str = datetime.now().strftime("%d/%m/%Y as %H:%M:%S")
        footer_txt = f"Impresso em {now_str}  GETT Tecnologia - gett.com.br"
        page.insert_text(fitz.Point(7.1, 836.0), footer_txt, fontsize=6.0, fontname="Helvetica-Oblique")

        doc.save(output_pdf_path)
        doc.close()
        print(f"DANFE PDF gerado com sucesso em: {output_pdf_path}")
