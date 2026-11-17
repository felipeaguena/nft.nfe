/**
 * NFT LOGISTICS - MÓDULO ESPELHO DO DOCUMENTO FISCAL
 * Visualização e conferência prévia das configurações efetuadas na NF-e em tempo real.
 * Renderiza em Sidebar Overlay (Drawer) no padrão do Design System NFT.
 */

(function () {
  'use strict';

  // --- FUNÇÕES UTILITÁRIAS ---
  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getElVal(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback !== undefined ? fallback : '';
    if (el.tagName === 'SELECT') {
      if (el.selectedIndex >= 0) {
        return el.options[el.selectedIndex].text.trim() || el.value.trim() || fallback || '';
      }
      return el.value.trim() || fallback || '';
    }
    return el.value ? el.value.trim() : (fallback !== undefined ? fallback : '');
  }

  function getElRawVal(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback !== undefined ? fallback : '';
    return el.value !== undefined ? String(el.value).trim() : (fallback !== undefined ? fallback : '');
  }

  function parseMoedaBR(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    var s = String(val).trim();
    if (s === '') return 0;
    // Se possui vírgula e ponto (ex: 1.250,50 ou 1,250.50)
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        // Padrão BR: 1.250,50 -> 1250.50
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        // Padrão US com separador de milhar: 1,250.50 -> 1250.50
        return parseFloat(s.replace(/,/g, '')) || 0;
      }
    } else if (s.indexOf(',') !== -1) {
      // Apenas vírgula: 25000,00 -> 25000.00
      return parseFloat(s.replace(',', '.')) || 0;
    } else {
      // Apenas ponto ou sem separador: 25000.00 -> 25000.00
      return parseFloat(s) || 0;
    }
  }

  function fmtMoedaBR(num) {
    var n = typeof num === 'number' ? num : parseMoedaBR(num);
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtUnitarioBR(num, valOriginal) {
    var n = typeof num === 'number' ? num : parseMoedaBR(num);
    var decs = 2;
    var s = (valOriginal !== undefined && valOriginal !== null && valOriginal !== '') ? String(valOriginal).trim() : String(n);
    if (s.indexOf('.') !== -1) {
      var decPart = s.split('.')[1];
      if (decPart && decPart.length > 2) {
        decs = Math.min(decPart.length, 4);
      }
    } else if (s.indexOf(',') !== -1) {
      var decPart = s.split(',')[1];
      if (decPart && decPart.length > 2) {
        decs = Math.min(decPart.length, 4);
      }
    }
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: decs, maximumFractionDigits: decs });
  }

  function fmtQtdBR(num, valOriginal) {
    var n = typeof num === 'number' ? num : parseMoedaBR(num);
    var s = (valOriginal !== undefined && valOriginal !== null && valOriginal !== '') ? String(valOriginal).trim() : String(n);
    var decs = (n % 1 === 0) ? 0 : 2;
    if (s.indexOf('.') !== -1) {
      var decPart = s.split('.')[1];
      if (decPart && decPart.length > 2) {
        decs = Math.min(decPart.length, 4);
      }
    } else if (s.indexOf(',') !== -1) {
      var decPart = s.split(',')[1];
      if (decPart && decPart.length > 2) {
        decs = Math.min(decPart.length, 4);
      }
    }
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decs, maximumFractionDigits: decs });
  }

  function fmtNumeroBR(num, decimais) {
    var dec = decimais !== undefined ? decimais : 2;
    var n = typeof num === 'number' ? num : parseMoedaBR(num);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function coletarItensAtuais() {
    // 1. Tenta obter diretamente do Tabulator (instância itensTable)
    if (window.itensTable && typeof window.itensTable.getData === 'function') {
      try {
        var dados = window.itensTable.getData();
        if (Array.isArray(dados) && dados.length > 0) return dados;
      } catch (e) {
        console.warn('[Espelho] Falha ao ler itensTable:', e);
      }
    }

    // 2. Tenta obter do cache em memória itensCache
    if (window.itensCache && Array.isArray(window.itensCache) && window.itensCache.length > 0) {
      return window.itensCache;
    }

    // 3. Fallback: elementos DOM do preview caso esteja na página de teste
    var blocks = document.querySelectorAll('.nft-item-repeater');
    if (blocks && blocks.length > 0) {
      var itensDom = [];
      blocks.forEach(function (blk, idx) {
        var desc = blk.querySelector('.it-desc') ? blk.querySelector('.it-desc').value : 'Produto ' + (idx + 1);
        var qtd = blk.querySelector('.it-qtd') ? parseMoedaBR(blk.querySelector('.it-qtd').value) : 1;
        var un = blk.querySelector('.it-un') ? blk.querySelector('.it-un').value : 'UN';
        var val = blk.querySelector('.it-val') ? parseMoedaBR(blk.querySelector('.it-val').value) : 0;
        var infad = blk.querySelector('.it-infad') ? blk.querySelector('.it-infad').value : '';
        var ncm = blk.querySelector('input[value*="."]') ? blk.querySelector('input[value*="."]').value : '';

        itensDom.push({
          nItem: idx + 1,
          xProd: desc,
          qCom: qtd,
          uCom: un,
          vUnCom: val,
          vProd: qtd * val,
          infAdProd: infad,
          NCM: ncm,
          CFOP: '7106'
        });
      });
      return itensDom;
    }

    return [];
  }

  function montarEspelhoHTML() {
    // 1. Dados da Nota & Operação
    var nNF = getElRawVal('nNF') || getElRawVal('inputNumNF') || '000000';
    var serie = getElRawVal('serie') || '001';
    var natOp = getElVal('natOp') || 'REEXPORTAÇÃO DE ADMISSÃO TEMPORÁRIA';
    var refInterna = getElRawVal('ref_interna') || getElRawVal('inputRef') || 'S/REF';
    var dhEmi = getElRawVal('dhEmi') || getElRawVal('inputDtEmi') || new Date().toLocaleDateString('pt-BR');
    
    // Tratativa de data se vier no formato YYYY-MM-DD
    if (dhEmi && dhEmi.indexOf('-') === 4) {
      var p = dhEmi.split('T')[0].split('-');
      if (p.length === 3) dhEmi = p[2] + '/' + p[1] + '/' + p[0];
    }

    // Parâmetros Globais da Operação
    var tpNF = getElVal('tpNF', '1 - Saída');
    var finNFe = getElVal('finNFe', '1 - Normal');
    var idDest = getElVal('idDest', '3 - Exterior');
    var indFinal = getElVal('indFinal', '1 - Consumidor Final');
    var indPres = getElVal('indPres', '0 - Não se aplica');
    var tpAmb = getElVal('tpAmb', '2 - Homologação');
    var tpEmis = getElVal('tpEmis', '1 - Normal');
    var nDI = getElRawVal('nDI') || getElRawVal('inputDI') || '';

    // 2. Emitente (Captura detalhada de todos os campos)
    var emitNome = 'NFT LOGISTICS LTDA';
    var emitCnpj = '47.998.441/0001-98';
    var emitIE = '148.924.210.114';
    var emitCRT = getElVal('emit_CRT') || '1 - Simples Nacional';
    var emitPais = getElRawVal('emit_xPais') || 'Brasil';
    var emitCPais = getElRawVal('emit_cPais') || '1058';
    var emitLgr = getElRawVal('emit_xLgr') || '';
    var emitNro = getElRawVal('emit_nro') || 'S/N';
    var emitCpl = getElRawVal('emit_xCpl') || '';
    var emitBairro = getElRawVal('emit_xBairro') || '';
    var emitMun = getElRawVal('emit_xMun') || 'São Paulo';
    var emitCMun = getElRawVal('emit_cMun') || '';
    var emitUF = getElRawVal('emit_UF') || 'SP';
    var emitCEP = getElRawVal('emit_CEP') || '';

    var elEmitNome = document.getElementById('topbar-emitente-nome') || document.getElementById('emit_xNome');
    if (elEmitNome && elEmitNome.innerText) emitNome = elEmitNome.innerText.trim();
    else if (elEmitNome && elEmitNome.value) emitNome = elEmitNome.value.trim();

    var elEmitCnpj = document.getElementById('topbar-emitente-cnpj') || document.getElementById('emit_CNPJ');
    if (elEmitCnpj && elEmitCnpj.innerText) emitCnpj = elEmitCnpj.innerText.trim();
    else if (elEmitCnpj && elEmitCnpj.value) emitCnpj = elEmitCnpj.value.trim();

    var elEmitIE = document.getElementById('emit_IE');
    if (elEmitIE && elEmitIE.value) emitIE = elEmitIE.value.trim();

    // 3. Destinatário / Tomador (Captura detalhada de todos os campos)
    var destNome = getElRawVal('dest_xNome') || getElRawVal('inputDestNome') || 'NÃO INFORMADO';
    var destPais = getElRawVal('dest_xPais') || 'EXTERIOR';
    var destCPais = getElRawVal('dest_cPais') || '';
    var destUF = getElRawVal('dest_UF') || 'EX';
    var destLgr = getElRawVal('dest_xLgr') || '';
    var destNro = getElRawVal('dest_nro') || '';
    var destCpl = getElRawVal('dest_xCpl') || '';
    var destBairro = getElRawVal('dest_xBairro') || '';
    var destMun = getElRawVal('dest_xMun') || '';
    var destCMun = getElRawVal('dest_cMun') || '';
    var destCEP = getElRawVal('dest_CEP') || '';
    var destIndIE = getElVal('dest_indIEDest', '9 - Não Contribuinte');

    // Identificação de Exterior
    var isExterior = false;
    var destPaisUpper = String(destPais).trim().toUpperCase();
    var destUFUpper = String(destUF).trim().toUpperCase();
    var destCPaisStr = String(destCPais).trim();
    var idDestVal = String(idDest).trim();

    if (destUFUpper === 'EX' || (destCPaisStr && destCPaisStr !== '1058') || (destPaisUpper !== 'BRASIL' && destPaisUpper !== 'BRAZIL' && destPaisUpper !== '') || idDestVal.indexOf('3') === 0) {
      isExterior = true;
    }

    // Tratativa de Documento (Doc)
    var rawDestDoc = getElRawVal('dest_CNPJ_CPF') || getElRawVal('dest_CNPJ') || getElRawVal('dest_CPF') || getElRawVal('dest_idEstrangeiro') || getElRawVal('inputDestDoc') || '';
    var destDoc = rawDestDoc;
    if (!destDoc || destDoc.toUpperCase() === 'NÃO INFORMADO' || destDoc.toUpperCase() === 'NAO INFORMADO') {
      destDoc = isExterior ? 'Exterior' : 'NÃO INFORMADO';
    }

    // Tratativa de Inscrição Estadual (IE)
    var rawDestIE = getElRawVal('dest_IE');
    var destIE = rawDestIE;
    if (isExterior) {
      destIE = 'ISENTO (Não Contribuinte)';
    } else {
      if (!destIE || destIE.toUpperCase() === 'ISENTO') {
        destIE = 'ISENTO';
      }
    }

    // 4. Coleta de Itens
    var itens = coletarItensAtuais();
    var linhasItensHtml = '';
    var somaProd = 0;
    var somaPesoLiq = 0;

    if (itens.length === 0) {
      linhasItensHtml = '<tr><td colspan="5" style="text-align: center; color: #94A3B8; padding: 18px 8px;">Nenhum produto cadastrado na grade de itens.</td></tr>';
    } else {
      itens.forEach(function (it, idx) {
        var num = it.nItem || (idx + 1);
        var desc = it.xProd || 'Produto sem descrição';
        var ncm = it.NCM || '-';
        var cfop = it.CFOP || '-';
        var un = it.uCom || 'UN';
        var qtd = parseMoedaBR(it.qCom || 0);
        var vUn = parseMoedaBR(it.vUnCom || 0);
        var vTot = parseMoedaBR(it.vProd || 0);
        if (vTot === 0 && qtd > 0 && vUn > 0) vTot = qtd * vUn;
        somaProd += vTot;

        var peso = parseMoedaBR(it.pesoL || 0);
        somaPesoLiq += peso;

        var infad = it.infAdProd || '';

        linhasItensHtml += `
          <tr>
            <td style="width: 45%;">
              <div class="nft-item-desc"><strong>${num}.</strong> ${escHtml(desc)}</div>
              ${infad ? `<div class="nft-item-infad">↳ ${escHtml(infad)}</div>` : ''}
            </td>
            <td style="width: 15%; text-align: center; font-family: monospace; font-size: 10px;">
              <div>${escHtml(ncm)}</div>
              <div style="color: #2563EB; font-weight: 600;">CFOP ${escHtml(cfop)}</div>
            </td>
            <td style="width: 12%; text-align: center;">
              <strong>${fmtQtdBR(qtd, it.qCom)}</strong> <small style="color: #64748B;">${escHtml(un)}</small>
            </td>
            <td style="width: 14%; text-align: right; font-family: monospace;">
              ${fmtUnitarioBR(vUn, it.vUnCom)}
            </td>
            <td style="width: 14%; text-align: right; font-weight: 700; font-family: monospace; color: #0F172A;">
              ${fmtMoedaBR(vTot)}
            </td>
          </tr>
        `;
      });
    }

    // 5. Totais Globais
    var vProdTot = parseMoedaBR(getElRawVal('tot_vProd')) || somaProd;
    var vFrete = parseMoedaBR(getElRawVal('tot_vFrete'));
    var vSeg = parseMoedaBR(getElRawVal('tot_vSeg'));
    var vOutro = parseMoedaBR(getElRawVal('tot_vOutro'));
    var vDesc = parseMoedaBR(getElRawVal('tot_vDesc'));
    var vBC = parseMoedaBR(getElRawVal('tot_vBC'));
    var vICMS = parseMoedaBR(getElRawVal('tot_vICMS'));
    var vIPI = parseMoedaBR(getElRawVal('tot_vIPI'));
    var vPIS = parseMoedaBR(getElRawVal('tot_vPIS'));
    var vCOFINS = parseMoedaBR(getElRawVal('tot_vCOFINS'));
    var vAFRMM = parseMoedaBR(getElRawVal('tot_vAFRMM'));

    var vNF = parseMoedaBR(getElRawVal('tot_vNF')) || parseMoedaBR(getElRawVal('vNF'));
    if (vNF === 0) {
      vNF = vProdTot + vFrete + vSeg + vOutro - vDesc + vIPI;
    }

    // 6. Transporte & Cobrança
    var modFrete = getElVal('modFrete', '9 - Sem Frete');
    var transpNome = getElRawVal('transp_xNome') || 'NÃO ESPECIFICADA';
    var qVol = getElRawVal('qVol') || '0';
    var pesoLiq = parseMoedaBR(getElRawVal('pesoL')) || somaPesoLiq;
    var pesoBruto = parseMoedaBR(getElRawVal('pesoB')) || pesoLiq;
    var tPag = getElVal('tot_tPag', '90 - Sem Pagamento');
    var vPag = parseMoedaBR(getElRawVal('tot_vPag'));

    // 7. Informações Complementares
    var infCpl = getElRawVal('infCpl') || getElRawVal('infAdic') || '';

    // Montagem completa do Canvas A4
    return `
      <!-- BANNER DE AVISO: PRÉVIA NÃO OFICIAL -->
      <div class="nft-espelho-disclaimer-banner">
        <span class="disclaimer-icon">⚠️</span>
        <div>
          <strong>DOCUMENTO NÃO OFICIAL — ESPELHO DE CONFERÊNCIA PRÉVIA</strong><br>
          Esta tela sintetiza os parâmetros globais, regras fiscais e cálculos configurados na NF-e para validação antes da assinatura e transmissão à SEFAZ.
        </div>
      </div>

      <!-- FOLHA ESTILO DANFE A4 -->
      <div class="nft-espelho-paper" id="nftEspelhoPaperCanvas">

        <!-- CABEÇALHO DO DOCUMENTO -->
        <div class="nft-paper-header">
          <div>
            <div class="nft-paper-title">DANFE - DOCUMENTO AUXILIAR DA NF-E</div>
            <div class="nft-paper-subtitle">
              <strong>${escHtml(emitNome)}</strong> • CNPJ: <span style="font-family: monospace;">${escHtml(emitCnpj)}</span> • IE: ${escHtml(emitIE)} - ${escHtml(emitUF)}
            </div>
          </div>
          <div class="nft-paper-nf-badge">
            <div class="nft-paper-nf-num">Nº ${escHtml(nNF)}</div>
            <div class="nft-paper-nf-sub">SÉRIE ${escHtml(serie)} • FOLHA 1/1</div>
          </div>
        </div>

        <!-- GRADE DE PARÂMETROS GLOBAIS DA OPERAÇÃO -->
        <div class="nft-paper-meta-grid">
          <div class="nft-meta-item">
            <span class="nft-meta-label">Natureza da Operação</span>
            <span class="nft-meta-value" style="color: #2563EB;">${escHtml(natOp)}</span>
          </div>
          <div class="nft-meta-item">
            <span class="nft-meta-label">Finalidade da NF-e</span>
            <span class="nft-meta-value">${escHtml(finNFe)}</span>
          </div>
          <div class="nft-meta-item">
            <span class="nft-meta-label">Tipo de Movimento</span>
            <span class="nft-meta-value">${escHtml(tpNF)}</span>
          </div>
          <div class="nft-meta-item">
            <span class="nft-meta-label">Destino da Operação</span>
            <span class="nft-meta-value">${escHtml(idDest)}</span>
          </div>
          <div class="nft-meta-item">
            <span class="nft-meta-label">Data de Emissão</span>
            <span class="nft-meta-value">${escHtml(dhEmi)}</span>
          </div>
          <div class="nft-meta-item">
            <span class="nft-meta-label">Ref. Interna / Processo</span>
            <span class="nft-meta-value" style="font-family: monospace; font-weight: 800;">${escHtml(refInterna)}</span>
          </div>
          <div class="nft-meta-item">
            <span class="nft-meta-label">Ambiente SEFAZ</span>
            <span class="nft-meta-value">${escHtml(tpAmb)}</span>
          </div>
          <div class="nft-meta-item">
            <span class="nft-meta-label">DI / DUIMP Vinculada</span>
            <span class="nft-meta-value">${nDI ? escHtml(nDI) : '<span style="color: #94A3B8;">Não informada</span>'}</span>
          </div>
        </div>

        <!-- QUADRO DE EMITENTE E DESTINATÁRIO -->
        <div class="nft-paper-parties">
          <!-- Emitente -->
          <div class="nft-party-card">
            <div class="nft-party-title">
              <span>🏢 Emitente</span>
              <span style="color: #16A34A; font-weight: 700;">${escHtml(emitUF)}</span>
            </div>
            <div class="nft-party-name">${escHtml(emitNome)}</div>
            <div class="nft-party-doc"><strong>CNPJ:</strong> <span style="font-family: monospace;">${escHtml(emitCnpj)}</span> &nbsp;•&nbsp; <strong>IE:</strong> ${escHtml(emitIE)}</div>
            <div class="nft-party-meta" style="font-size: 10px; color: #475569; margin-top: 3px;">
              <strong>Regime (CRT):</strong> ${escHtml(emitCRT)}
            </div>
            <div class="nft-party-address">
              <strong>Endereço:</strong> ${escHtml(emitLgr)}${emitNro ? ', ' + escHtml(emitNro) : ''}${emitCpl ? ' - ' + escHtml(emitCpl) : ''}${emitBairro ? ' - ' + escHtml(emitBairro) : ''}<br>
              ${emitMun ? escHtml(emitMun) + ' - ' : ''}${escHtml(emitUF)} • ${escHtml(emitPais)}${emitCPais ? ' (' + escHtml(emitCPais) + ')' : ''}${emitCEP ? ' • CEP: ' + escHtml(emitCEP) : ''}${emitCMun ? ' • Cód. IBGE: ' + escHtml(emitCMun) : ''}
            </div>
          </div>

          <!-- Destinatário / Tomador -->
          <div class="nft-party-card">
            <div class="nft-party-title">
              <span>👤 Destinatário / Tomador</span>
              <span style="color: ${isExterior ? '#D97706' : '#2563EB'}; font-weight: 700;">${isExterior ? '🌍 Exterior (' + escHtml(destUF) + ')' : escHtml(destUF)}</span>
            </div>
            <div class="nft-party-name">${escHtml(destNome)}</div>
            <div class="nft-party-doc"><strong>Doc:</strong> <span style="font-family: monospace;">${escHtml(destDoc)}</span></div>
            <div class="nft-party-meta" style="font-size: 10px; color: #475569; margin-top: 3px;">
              <strong>IE:</strong> ${escHtml(destIE)}${!isExterior && destIndIE ? ' • <strong>Indicador:</strong> ' + escHtml(destIndIE) : ''}
            </div>
            <div class="nft-party-address">
              <strong>Endereço:</strong> ${destLgr ? escHtml(destLgr) + (destNro ? ', ' + escHtml(destNro) : '') + (destCpl ? ' - ' + escHtml(destCpl) : '') + (destBairro ? ' - ' + escHtml(destBairro) : '') : '<span style="color: #94A3B8;">Não informado</span>'}<br>
              ${destMun ? escHtml(destMun) + ' - ' : ''}${escHtml(destUF)} • ${escHtml(destPais)}${destCPais ? ' (' + escHtml(destCPais) + ')' : ''}${destCEP ? ' • CEP: ' + escHtml(destCEP) : ''}${destCMun ? ' • Cód. IBGE: ' + escHtml(destCMun) : ''}
            </div>
          </div>
        </div>

        <!-- TABELA DE PRODUTOS / SERVIÇOS -->
        <div class="nft-section-title">
          <span>📦 Produtos / Serviços Vinculados (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})</span>
        </div>
        <div class="nft-paper-table-wrap">
          <table class="nft-paper-table">
            <thead>
              <tr>
                <th>Descrição do Produto & Informações Adicionais</th>
                <th style="text-align: center;">NCM / CFOP</th>
                <th style="text-align: center;">Qtd / Un</th>
                <th style="text-align: right;">Unitário</th>
                <th style="text-align: right;">Total Líquido</th>
              </tr>
            </thead>
            <tbody>
              ${linhasItensHtml}
            </tbody>
          </table>
        </div>

        <!-- TOTAIS E RESUMO DE TRIBUTAÇÃO -->
        <div class="nft-paper-totals-box">
          <!-- Bloco Tributos e Retenções -->
          <div class="nft-paper-tributos-grid">
            <div>
              <span class="nft-meta-label">Base Cálculo ICMS</span>
              <div style="font-weight: 700; font-family: monospace;">${fmtMoedaBR(vBC)}</div>
            </div>
            <div>
              <span class="nft-meta-label">Valor do ICMS</span>
              <div style="font-weight: 700; font-family: monospace;">${fmtMoedaBR(vICMS)}</div>
            </div>
            <div>
              <span class="nft-meta-label">Valor do IPI</span>
              <div style="font-weight: 700; font-family: monospace;">${fmtMoedaBR(vIPI)}</div>
            </div>
            <div>
              <span class="nft-meta-label">PIS / COFINS</span>
              <div style="font-weight: 700; font-family: monospace;">${fmtMoedaBR(vPIS + vCOFINS)}</div>
            </div>
            <div>
              <span class="nft-meta-label">Valor do AFRMM</span>
              <div style="font-weight: 700; font-family: monospace;">${fmtMoedaBR(vAFRMM)}</div>
            </div>
            <div>
              <span class="nft-meta-label">Desconto Global</span>
              <div style="font-weight: 700; font-family: monospace; color: #DC2626;">${fmtMoedaBR(vDesc)}</div>
            </div>
          </div>

          <!-- Bloco Totais Finais -->
          <div class="nft-paper-totals-col">
            <div class="nft-total-row">
              <span>Total dos Produtos:</span>
              <strong>${fmtMoedaBR(vProdTot)}</strong>
            </div>
            <div class="nft-total-row">
              <span>Frete (+):</span>
              <strong>${fmtMoedaBR(vFrete)}</strong>
            </div>
            <div class="nft-total-row">
              <span>Seguro & Despesas (+):</span>
              <strong>${fmtMoedaBR(vSeg + vOutro)}</strong>
            </div>
            <div class="nft-total-row">
              <span>Descontos (-):</span>
              <strong style="color: #DC2626;">-${fmtMoedaBR(vDesc)}</strong>
            </div>
            <div class="nft-total-row grand-total">
              <span>VALOR TOTAL DA NF:</span>
              <strong>${fmtMoedaBR(vNF)}</strong>
            </div>
          </div>
        </div>

        <!-- TRANSPORTE E FORMA DE PAGAMENTO -->
        <div class="nft-paper-extra-grid">
          <div class="nft-extra-item">
            <strong>🚚 Transporte:</strong> ${escHtml(modFrete)}<br>
            <span>Transportadora: ${escHtml(transpNome)} • Volumes: ${escHtml(qVol)} • Peso Líq: ${fmtNumeroBR(pesoLiq, 3)} kg • Peso Bruto: ${fmtNumeroBR(pesoBruto, 3)} kg</span>
          </div>
          <div class="nft-extra-item">
            <strong>💳 Pagamento SEFAZ:</strong> ${escHtml(tPag)}<br>
            <span>Valor do Pagamento: ${fmtMoedaBR(vPag || vNF)}</span>
          </div>
        </div>

        <!-- INFORMAÇÕES COMPLEMENTARES (SE HOUVER) -->
        ${infCpl ? `
          <div class="nft-paper-infcpl">
            <strong>Informações Complementares / Interesse do Contribuinte</strong>
            <div>${escHtml(infCpl)}</div>
          </div>
        ` : ''}

        <!-- RODAPÉ FISCAL -->
        <div class="nft-paper-footer">
          Documento gerado em ambiente de prévia do Design System • NFT Logistics LTDA<br>
          Para efeitos fiscais oficiais, consulte a chave de acesso após autorização perante o SEFAZ autorizador.
        </div>

      </div>
    `;
  }

  function garantirEstruturaOverlay() {
    var backdrop = document.getElementById('nftEspelhoBackdrop');
    var drawer = document.getElementById('nftEspelhoDrawer');

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'nftEspelhoBackdrop';
      backdrop.className = 'nft-espelho-backdrop';
      backdrop.addEventListener('click', fecharEspelhoFiscal);
      document.body.appendChild(backdrop);
    }

    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'nftEspelhoDrawer';
      drawer.className = 'nft-espelho-drawer';

      drawer.innerHTML = `
        <header class="nft-espelho-header">
          <div class="nft-espelho-header-left">
            <h2 class="nft-espelho-title">
              <span>📄</span> Espelho do Documento Fiscal
            </h2>
            <p class="nft-espelho-subtitle">Resumo executivo de configurações, itens e valores apurados da NF-e</p>
          </div>
          <div class="nft-espelho-header-actions">
            <button class="nft-espelho-btn" onclick="window.copiarResumoEspelho()" title="Copiar resumo textual para a área de transferência">
              <span>📋</span> Copiar Resumo
            </button>
            <button class="nft-espelho-btn" onclick="window.imprimirEspelhoFiscal()" title="Imprimir visualização estilo DANFE">
              <span>🖨️</span> Imprimir
            </button>
            <button class="nft-espelho-btn-close" onclick="window.fecharEspelhoFiscal()" title="Fechar Espelho (Esc)">✕</button>
          </div>
        </header>

        <div class="nft-espelho-body" id="nftEspelhoBody">
          <!-- Conteúdo gerado dinamicamente via JS -->
        </div>
      `;

      document.body.appendChild(drawer);
    }
  }

  // --- AÇÕES DO MÓDULO EXPOSTAS NO ESCOPO GLOBAL (window) ---

  window.abrirEspelhoFiscal = function () {
    garantirEstruturaOverlay();

    var bodyContainer = document.getElementById('nftEspelhoBody');
    if (bodyContainer) {
      bodyContainer.innerHTML = montarEspelhoHTML();
    }

    var backdrop = document.getElementById('nftEspelhoBackdrop');
    var drawer = document.getElementById('nftEspelhoDrawer');

    if (backdrop) backdrop.classList.add('active');
    if (drawer) drawer.classList.add('active');

    // Desativa rolagem do fundo
    document.body.style.overflow = 'hidden';

    // Se o Lucide icons estiver presente, inicializa novos ícones
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };

  window.fecharEspelhoFiscal = function () {
    var backdrop = document.getElementById('nftEspelhoBackdrop');
    var drawer = document.getElementById('nftEspelhoDrawer');

    if (backdrop) backdrop.classList.remove('active');
    if (drawer) drawer.classList.remove('active');

    // Restaura rolagem do fundo
    document.body.style.overflow = '';
  };

  window.imprimirEspelhoFiscal = function () {
    window.print();
  };

  window.copiarResumoEspelho = function () {
    var nNF = getElRawVal('nNF') || '000000';
    var serie = getElRawVal('serie') || '001';
    var ref = getElRawVal('ref_interna') || 'S/REF';
    var natOp = getElVal('natOp') || 'NÃO INFORMADA';
    var dest = getElRawVal('dest_xNome') || 'NÃO INFORMADO';
    var vNF = getElRawVal('tot_vNF') || getElRawVal('vNF') || '0,00';
    var itens = coletarItensAtuais();

    var texto = `=== RESUMO: ESPELHO DO DOCUMENTO FISCAL ===\n` +
      `NF-e: Nº ${nNF} (Série ${serie})\n` +
      `Referência: ${ref}\n` +
      `Natureza: ${natOp}\n` +
      `Destinatário: ${dest}\n` +
      `Quantidade de Itens: ${itens.length}\n` +
      `Valor Total da NF: R$ ${vNF}\n` +
      `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}\n` +
      `===========================================`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        if (window.showToast) {
          window.showToast('success', 'Resumo da Nota copiado para a área de transferência!');
        } else {
          alert('Resumo copiado com sucesso:\n\n' + texto);
        }
      }).catch(function () {
        alert('Resumo da Nota:\n\n' + texto);
      });
    } else {
      alert('Resumo da Nota:\n\n' + texto);
    }
  };

  // --- ATALHOS DE TECLADO E INICIALIZAÇÃO ---
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var drawer = document.getElementById('nftEspelhoDrawer');
      if (drawer && drawer.classList.contains('active')) {
        fecharEspelhoFiscal();
      }
    }
    // Atalho Alt + E para abrir/fechar o espelho
    if (e.altKey && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      var d = document.getElementById('nftEspelhoDrawer');
      if (d && d.classList.contains('active')) {
        fecharEspelhoFiscal();
      } else {
        abrirEspelhoFiscal();
      }
    }
  });

  function inicializarBotaoFlutuante() {
    if (document.getElementById('nftEspelhoFab')) return;
    var fab = document.createElement('button');
    fab.id = 'nftEspelhoFab';
    fab.className = 'nft-espelho-fab-trigger';
    fab.setAttribute('type', 'button');
    fab.setAttribute('title', 'Abrir Espelho do Documento Fiscal (Atalho: Alt + E)');
    fab.innerHTML = '<span style="font-size: 15px;">📄</span><span>Espelho da Nota</span>';
    fab.style.display = 'none';
    fab.addEventListener('click', window.abrirEspelhoFiscal);
    document.body.appendChild(fab);

    window.addEventListener('scroll', function () {
      if (window.scrollY > 180) {
        fab.style.display = 'inline-flex';
      } else {
        fab.style.display = 'none';
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarBotaoFlutuante);
  } else {
    inicializarBotaoFlutuante();
  }

})();
