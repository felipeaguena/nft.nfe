/**
 * NFT Logistics - Módulo de Análise e Validação Completa de Rascunho XML
 * Valida o rascunho atual contra as regras de esquema do MOC SEFAZ (NF-e v4.00)
 */

(function () {
    let modalElement = null;

    function getOrCreateModal() {
        if (modalElement && document.body.contains(modalElement)) {
            return modalElement;
        }

        const modalDiv = document.createElement('div');
        modalDiv.id = 'modalResultadoAnalise';
        modalDiv.className = 'modal fade';
        modalDiv.tabIndex = -1;
        modalDiv.setAttribute('aria-labelledby', 'modalResultadoAnaliseLabel');
        modalDiv.setAttribute('aria-hidden', 'true');

        modalDiv.setAttribute('data-ui', 'modal.analise.container');

        modalDiv.innerHTML = `
            <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header" id="modalAnaliseHeader" data-ui="modal.analise.header">
                        <div class="d-flex align-items-center gap-2">
                            <span id="modalAnaliseIcon" class="nft-kpi-icon" data-ui="modal.analise.icon"></span>
                            <div>
                                <h5 class="modal-title" id="modalResultadoAnaliseLabel" data-ui="modal.analise.title">Resultado da Análise do Rascunho</h5>
                                <small class="text-muted" id="modalAnaliseSubtitulo" data-ui="modal.analise.subtitle">Auditoria de conformidade com o Esquema XML da NF-e v4.00</small>
                            </div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar janela" title="Fechar análise" data-ui="modal.analise.btn-close"></button>
                    </div>
                    <div class="modal-body" id="modalAnaliseCorpo" data-ui="modal.analise.body">
                        <!-- Conteúdo dinâmico -->
                    </div>
                    <div class="modal-footer nft-modal-footer--split" data-ui="modal.analise.footer">
                        <span class="text-muted small" id="modalAnaliseFooterInfo" data-ui="modal.analise.footer-info">NFT Logistics XML Validator</span>
                        <div class="d-flex gap-2">
                            <button type="button" class="nft-btn nft-btn--ghost nft-btn--sm" data-bs-dismiss="modal" title="Fechar janela e revisar os campos da nota" data-ui="modal.analise.btn-fechar">Fechar e Revisar</button>
                            <button type="button" class="nft-btn nft-btn--primary nft-btn--sm" id="btnGerarXMLModal" onclick="fecharModalEGerarXML()" title="Gerar e baixar o arquivo XML da NF-e" data-ui="modal.analise.btn-download-xml">
                                <i data-lucide="download"></i>
                                <span>Download do XML</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
        modalElement = modalDiv;
        return modalElement;
    }

    function coletarDadosRascunho() {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        const mutatorLimparNumero = (val) => {
            if (!val) return '0.00';
            let s = String(val).trim();
            if (s.includes(',') && s.includes('.')) {
                s = s.replace(/\./g, '').replace(',', '.');
            } else if (s.includes(',')) {
                s = s.replace(',', '.');
            }
            return s;
        };

        let itensLimpos = [];
        if (window.itensTable && typeof window.itensTable.getData === 'function') {
            itensLimpos = window.itensTable.getData();
        } else if (window.itensCache && Array.isArray(window.itensCache)) {
            itensLimpos = window.itensCache;
        }

        itensLimpos = itensLimpos.map(item => {
            const novo = { ...item };
            const camposNum = [
                'qCom', 'vUnCom', 'vProd', 'qTrib', 'vUnTrib', 'vFrete', 'vSeg', 'vDesc', 'vOutro',
                'vAFRMM', 'vBC_IPI', 'pIPI', 'vIPI', 'vBC_II', 'vDespAdu', 'vII', 'vIOF',
                'vBC_PIS', 'pPIS', 'vPIS', 'vBC_COFINS', 'pCOFINS', 'vCOFINS'
            ];
            camposNum.forEach(k => {
                if (novo[k] !== undefined && novo[k] !== null && novo[k] !== '') {
                    let v = String(novo[k]).trim();
                    if (v.includes(',') && v.includes('.')) {
                        v = v.replace(/\./g, '').replace(',', '.');
                    } else if (v.includes(',')) {
                        v = v.replace(',', '.');
                    }
                    novo[k] = v;
                }
            });
            return novo;
        });

        return {
            cabecalho: {
                nNF: getVal('nNF'),
                serie: getVal('serie'),
                refNFe: (getVal('refNFe') || '').replace(/\D/g, '').slice(0, 44),
                natOp: getVal('natOp') || getVal('select_operacao'),
                cfop_padrao: getVal('cfop_padrao'),
                tpNF: getVal('tpNF'),
                idDest: getVal('idDest'),
                chaveAcesso: getVal('chaveAcesso'),
                cNF: getVal('cNF'),
                cUF: getVal('cUF'),
                dhEmi: getVal('dhEmi'),
                dhSaiEnt: getVal('dhSaiEnt') || getVal('dhEmi'),
                mod: getVal('mod'),
                tpEmis: getVal('tpEmis'),
                cDV: getVal('cDV'),
                emit_xNome: getVal('emit_xNome'),
                emit_CNPJ: getVal('emit_CNPJ'),
                emit_xLgr: getVal('emit_xLgr'),
                emit_nro: getVal('emit_nro'),
                emit_xBairro: getVal('emit_xBairro'),
                emit_cMun: getVal('emit_cMun'),
                emit_xMun: getVal('emit_xMun'),
                emit_UF: getVal('emit_UF'),
                emit_CEP: getVal('emit_CEP'),
                emit_IE: getVal('emit_IE') || (window.currentCabecalho && window.currentCabecalho.emit_IE) || '',
                emit_CRT: getVal('emit_CRT') || (window.currentCabecalho && window.currentCabecalho.emit_CRT) || '1',
                emit_cPais: getVal('emit_cPais') || (window.currentCabecalho && window.currentCabecalho.emit_cPais) || '1058',
                emit_xPais: getVal('emit_xPais') || (window.currentCabecalho && window.currentCabecalho.emit_xPais) || 'Brasil',
                dest_xNome: getVal('dest_xNome'),
                dest_CNPJ_CPF: getVal('dest_CNPJ_CPF'),
                dest_idEstrangeiro: getVal('dest_idEstrangeiro') || (window.currentCabecalho && window.currentCabecalho.dest_idEstrangeiro) || '',
                dest_indIEDest: getVal('dest_indIEDest') || '9',
                dest_IE: getVal('dest_IE') || '',
                dest_xLgr: getVal('dest_xLgr'),
                dest_nro: getVal('dest_nro'),
                dest_xBairro: getVal('dest_xBairro'),
                dest_cMun: getVal('dest_cMun'),
                dest_xMun: getVal('dest_xMun'),
                dest_UF: getVal('dest_UF'),
                dest_CEP: getVal('dest_CEP'),
                dest_cPais: getVal('dest_cPais') || (window.currentCabecalho && window.currentCabecalho.dest_cPais) || '1058',
                dest_xPais: getVal('dest_xPais') || (window.currentCabecalho && window.currentCabecalho.dest_xPais) || 'Brasil',
                verProc: getVal('verProc') || '4.01_sebrae_b057',
                exporta_UFSaidaPais: getVal('exporta_UFSaidaPais'),
                exporta_xLocExporta: getVal('exporta_xLocExporta'),
                exporta_xLocDespacho: getVal('exporta_xLocDespacho'),
                import_nDI: getVal('import_nDI'),
                import_dDI: getVal('import_dDI'),
                import_cExportador: getVal('import_cExportador'),
                import_tpViaTransp: getVal('import_tpViaTransp') || '1',
                import_tpIntermedio: getVal('import_tpIntermedio') || '1',
                import_UFDesemb: getVal('import_UFDesemb'),
                import_xLocDesemb: getVal('import_xLocDesemb'),
                import_dDesemb: getVal('import_dDesemb')
            },
            referencia_interna: (typeof window.obterReferenciaInterna === 'function' ? window.obterReferenciaInterna() : (getVal('referenciaInterna') || getVal('referencia_interna') || '')).trim(),
            itens: itensLimpos,
            rodape: {
                infCpl: getVal('infCpl'),
                transporte: {
                    modFrete: getVal('transp_modFrete'),
                    CNPJ_CPF: getVal('transp_CNPJ_CPF'),
                    xNome: getVal('transp_xNome'),
                    IE: getVal('transp_IE'),
                    xEnder: getVal('transp_xEnder'),
                    xMun: getVal('transp_xMun'),
                    UF: getVal('transp_UF'),
                    CEP: getVal('transp_CEP'),
                    qVol: getVal('transp_qVol'),
                    esp: getVal('transp_esp'),
                    pesoL: mutatorLimparNumero(getVal('transp_pesoL')),
                    pesoB: mutatorLimparNumero(getVal('transp_pesoB'))
                },
                exportacao: {
                    UFSaidaPais: getVal('exporta_UFSaidaPais'),
                    xLocExporta: getVal('exporta_xLocExporta'),
                    xLocDespacho: getVal('exporta_xLocDespacho')
                },
                totais: {
                    vProd: mutatorLimparNumero(getVal('tot_vProd')),
                    vFrete: mutatorLimparNumero(getVal('tot_vFrete')),
                    vSeg: mutatorLimparNumero(getVal('tot_vSeg')),
                    vOutro: mutatorLimparNumero(getVal('tot_vOutro')),
                    vDesc: mutatorLimparNumero(getVal('tot_vDesc')),
                    vNF: mutatorLimparNumero(getVal('tot_vNF') || getVal('vNF')),
                    vBC: mutatorLimparNumero(getVal('tot_vBC')),
                    vICMS: mutatorLimparNumero(getVal('tot_vICMS')),
                    vBCST: mutatorLimparNumero(getVal('tot_vBCST')),
                    vST: mutatorLimparNumero(getVal('tot_vST')),
                    vII: mutatorLimparNumero(getVal('tot_vII')),
                    vIPI: mutatorLimparNumero(getVal('tot_vIPI')),
                    vPIS: mutatorLimparNumero(getVal('tot_vPIS')),
                    vCOFINS: mutatorLimparNumero(getVal('tot_vCOFINS'))
                }
            }
        };
    }

    function destacarElementoComAnimacao(el) {
        if (!el) return;
        el.classList.add('nft-field-error-highlight');
        const container = el.closest('.nft-field, .nft-notch-field') || el.closest('.form-group') || el.parentElement;
        if (container && container !== document.body && container.tagName !== 'FORM') {
            container.classList.add('nft-field-error-highlight');
        }
        setTimeout(() => {
            el.classList.remove('nft-field-error-highlight');
            if (container) container.classList.remove('nft-field-error-highlight');
        }, 3500);
    }

    function resolverAbaId(abaIdentificador) {
        if (!abaIdentificador) return 'cabecalho';
        const s = String(abaIdentificador).toLowerCase().trim();
        if (s.includes('tipo') || s.includes('imposto')) {
            return 'tipo-nota';
        }
        if (s.includes('identifica') || s.includes('emit') || s.includes('dest') || s.includes('transp') || s === '2') {
            return 'identificacao';
        }
        if (s.includes('item') || s.includes('prod') || s.includes('tot') || s === '3') {
            return 'itens';
        }
        if (s.includes('sefaz') || s.includes('hist') || s === '4') {
            return 'historico-sefaz';
        }
        return 'cabecalho';
    }

    window.irParaErro = function(abaId, campoId, itemNum, modalFieldId) {
        // 1. Fecha o modal de análise
        if (modalElement && window.bootstrap && bootstrap.Modal) {
            const inst = bootstrap.Modal.getInstance(modalElement);
            if (inst) inst.hide();
        }

        const targetAba = resolverAbaId(abaId);

        // Se for modal de Tipo de Nota
        if (targetAba === 'tipo-nota') {
            if (typeof window.abrirModalTipoNota === 'function') {
                window.abrirModalTipoNota();
            }
            return;
        }

        // 2. Troca de aba
        if (typeof window.sidebarSwitchTab === 'function') {
            window.sidebarSwitchTab(targetAba);
        } else {
            const btnTab = document.getElementById(targetAba + '-tab');
            if (btnTab) btnTab.click();
        }

        // 3. Se for erro em item da nota e tivermos modal de edição disponível
        if (targetAba === 'itens' && itemNum && window.abrirModalItemEditar) {
            setTimeout(() => {
                let lista = [];
                if (window.itensTable && typeof window.itensTable.getData === 'function') {
                    lista = window.itensTable.getData();
                } else if (window.itensCache && Array.isArray(window.itensCache)) {
                    lista = window.itensCache;
                }
                const idx = parseInt(itemNum, 10) - 1;
                const rowData = (idx >= 0 && idx < lista.length) ? lista[idx] : (lista[0] || null);
                if (rowData) {
                    window.abrirModalItemEditar(rowData, idx >= 0 ? idx : 0);
                    if (modalFieldId) {
                        setTimeout(() => {
                            // Seleciona a aba interna correta no modal de edição do item
                            if (modalFieldId.includes('nDI') || modalFieldId.includes('dDI') || modalFieldId.includes('qTrib')) {
                                const tabAduan = document.getElementById('tab-item-aduaneiro-btn');
                                if (tabAduan) tabAduan.click();
                            } else if (modalFieldId.includes('CST') || modalFieldId.includes('pICMS') || modalFieldId.includes('pIPI') || modalFieldId.includes('pPIS') || modalFieldId.includes('pCOFINS')) {
                                const tabTrib = document.getElementById('tab-item-tributos-btn');
                                if (tabTrib) tabTrib.click();
                            } else {
                                const tabGeral = document.getElementById('tab-item-geral-btn');
                                if (tabGeral) tabGeral.click();
                            }
                            const mEl = document.getElementById(modalFieldId);
                            if (mEl) {
                                mEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                try { mEl.focus(); } catch(e) {}
                                if (typeof mEl.select === 'function') { try { mEl.select(); } catch(e) {} }
                                destacarElementoComAnimacao(mEl);
                            }
                        }, 350);
                    }
                    return;
                }
            }, 250);
        }

        // 4. Se for campo na tela (Tabs 1: Operação, 2: Identificação ou 3: Itens)
        setTimeout(() => {
            let el = null;
            if (campoId) {
                el = document.getElementById(campoId);
            }
            if (!el && campoId === 'select_operacao') el = document.getElementById('natOp') || document.getElementById('select_operacao');
            if (!el && campoId === 'tabela-itens') el = document.getElementById('tabela-itens') || document.getElementById('btn-adicionar-item');

            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                try { el.focus(); } catch(e) {}
                if (typeof el.select === 'function') {
                    try { el.select(); } catch(e) {}
                }
                destacarElementoComAnimacao(el);
            }
        }, 250);
    };

    window.irParaAbaAnalise = function(abaNome) {
        window.irParaErro(abaNome, '', '', '');
    };

    window.fecharModalEGerarXML = function() {
        if (modalElement && window.bootstrap && bootstrap.Modal) {
            const inst = bootstrap.Modal.getInstance(modalElement);
            if (inst) inst.hide();
        }
        if (typeof window.generateXML === 'function') {
            window.generateXML();
        }
    };

    function renderizarResultadoAnalise(data) {
        const modal = getOrCreateModal();
        const headerEl = modal.querySelector('#modalAnaliseHeader');
        const iconWrap = modal.querySelector('#modalAnaliseIcon');
        const corpoEl = modal.querySelector('#modalAnaliseCorpo');
        const footerInfo = modal.querySelector('#modalAnaliseFooterInfo');
        const btnGerarXML = modal.querySelector('#btnGerarXMLModal');

        const totalErros = data.total_erros || 0;
        const totalAlertas = data.total_alertas || 0;
        const valido = data.valido === true;
        const resumo = data.resumo || {};

        footerInfo.innerText = `${resumo.total_itens || 0} itens analisados • NF nº ${resumo.n_nf || '-'} • Destinatário: ${resumo.destinatario || '-'}`;

        let statusBannerHtml = '';

        if (valido && totalAlertas === 0) {
            iconWrap.className = 'd-inline-flex align-items-center justify-content-center bg-success text-white shadow-sm';
            iconWrap.innerHTML = '<i data-lucide="check" style="width: 18px; height: 18px;"></i>';
            statusBannerHtml = `
                <div class="alert alert-success d-flex align-items-center gap-3 p-3 rounded-3 shadow-sm border-0 mb-3" style="background-color: rgba(16, 185, 129, 0.12); color: #065f46;">
                    <i data-lucide="check-circle-2" style="width: 28px; height: 28px; flex-shrink: 0;"></i>
                    <div>
                        <div class="fw-bold fs-6">Rascunho 100% Válido!</div>
                        <div class="small">Todos os campos obrigatórios e regras do esquema da NF-e 4.00 estão em total conformidade. Você já pode gerar o arquivo XML com segurança.</div>
                    </div>
                </div>
            `;
        } else if (valido && totalAlertas > 0) {
            iconWrap.className = 'd-inline-flex align-items-center justify-content-center bg-warning text-dark shadow-sm';
            iconWrap.innerHTML = '<i data-lucide="alert-triangle" style="width: 18px; height: 18px;"></i>';
            statusBannerHtml = `
                <div class="alert alert-warning d-flex align-items-center gap-3 p-3 rounded-3 shadow-sm border-0 mb-3" style="background-color: rgba(245, 158, 11, 0.15); color: #92400e;">
                    <i data-lucide="alert-circle" style="width: 28px; height: 28px; flex-shrink: 0;"></i>
                    <div>
                        <div class="fw-bold fs-6">Rascunho Apto com ${totalAlertas} Alerta(s) / Recomendações</div>
                        <div class="small">A estrutura do XML é válida, mas há avisos ou campos opcionais que merecem sua atenção antes da transmissão final à SEFAZ.</div>
                    </div>
                </div>
            `;
        } else {
            iconWrap.className = 'd-inline-flex align-items-center justify-content-center bg-danger text-white shadow-sm';
            iconWrap.innerHTML = '<i data-lucide="x" style="width: 18px; height: 18px;"></i>';
            statusBannerHtml = `
                <div class="alert alert-danger d-flex align-items-center gap-3 p-3 rounded-3 shadow-sm border-0 mb-3" style="background-color: rgba(239, 68, 68, 0.12); color: #991b1b;">
                    <i data-lucide="alert-octagon" style="width: 28px; height: 28px; flex-shrink: 0;"></i>
                    <div>
                        <div class="fw-bold fs-6">Rascunho com ${totalErros} Pendência(s) Obrigatória(s)</div>
                        <div class="small">Foram detectados campos sem preencher ou inconsistências que violam o esquema da NF-e e resultarão em rejeição imediata na SEFAZ.</div>
                    </div>
                </div>
            `;
        }

        // Cards de Resumo Rápido
        const formatMoeda = (val) => {
            return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        const cardsResumoHtml = `
            <div class="row g-2 mb-3">
                <div class="col-6 col-md-3">
                    <div class="card p-2 px-3 text-center h-100">
                        <small class="text-muted d-block">Itens na Nota</small>
                        <strong class="text-heading font-monospace">${resumo.total_itens || 0}</strong>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card p-2 px-3 text-center h-100">
                        <small class="text-muted d-block">Total Produtos</small>
                        <strong class="text-primary font-monospace">${formatMoeda(resumo.valor_total_produtos)}</strong>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card p-2 px-3 text-center h-100">
                        <small class="text-muted d-block">NF-e / Série</small>
                        <strong class="text-heading font-monospace">${resumo.n_nf || '-'} / ${resumo.serie || '-'}</strong>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="card p-2 px-3 text-center h-100">
                        <small class="text-muted d-block">Montagem XML</small>
                        <span class="nft-badge" data-tone="info">
                            ${resumo.xml_construido ? '100% Ok' : 'Incompleto'}
                        </span>
                    </div>
                </div>
            </div>
        `;

        // Lista de Erros
        let errosHtml = '';
        if (totalErros > 0) {
            const itensErros = data.erros.map(e => {
                const abaId = e.aba_id || resolverAbaId(e.aba);
                const campoId = e.campo_id || '';
                const itemNum = e.item_num || '';
                const modalFieldId = e.modal_field_id || '';
                const abaDisplay = e.aba || 'Aba';

                return `
                <li class="list-group-item d-flex justify-content-between align-items-center gap-2 py-2 px-3 border-danger-subtle error-item-row cursor-pointer"
                    onclick="irParaErro('${abaId}', '${campoId}', '${itemNum}', '${modalFieldId}')"
                    title="Clique para ir até este campo na tela"
                    data-ui="modal.analise-rascunho.row-erro">
                    <div class="ms-1 me-auto">
                        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <span class="nft-badge" data-tone="danger">${e.categoria || 'Erro'}</span>
                            <strong class="text-heading small">${e.campo || ''}</strong>
                            ${campoId ? `<code class="text-muted small">#${campoId}</code>` : ''}
                        </div>
                        <div class="text-muted small">${e.mensagem || ''}</div>
                    </div>
                    <button type="button" class="btn-analise-corrigir-erro"
                        onclick="event.stopPropagation(); irParaErro('${abaId}', '${campoId}', '${itemNum}', '${modalFieldId}')"
                        title="Ir diretamente para a ${abaDisplay} e focar no campo"
                        data-ui="modal.analise-rascunho.btn-corrigir">
                        <i data-lucide="crosshair" class="nft-icon--sm"></i>
                        <span>Corrigir na ${abaDisplay}</span> &rarr;
                    </button>
                </li>
            `}).join('');

            errosHtml = `
                <div class="card border border-danger mb-3 overflow-hidden" data-ui="modal.analise-rascunho.card-erros">
                    <div class="card-header py-2 px-3 d-flex justify-content-between align-items-center">
                        <span class="fw-bold d-flex align-items-center gap-2 text-danger small">
                            <i data-lucide="alert-octagon" class="nft-icon--sm"></i>
                            <span>O que precisa ser corrigido (${totalErros}):</span>
                        </span>
                    </div>
                    <ul class="list-group list-group-flush">
                        ${itensErros}
                    </ul>
                </div>
            `;
        }

        // Lista de Alertas
        let alertasHtml = '';
        if (totalAlertas > 0) {
            const itensAlertas = data.alertas.map(a => {
                const abaId = a.aba_id || resolverAbaId(a.aba);
                const campoId = a.campo_id || '';
                const itemNum = a.item_num || '';
                const modalFieldId = a.modal_field_id || '';
                const abaDisplay = a.aba || 'Aba';

                return `
                <li class="list-group-item d-flex justify-content-between align-items-center gap-2 py-2 px-3 border-warning-subtle alert-item-row cursor-pointer"
                    onclick="irParaErro('${abaId}', '${campoId}', '${itemNum}', '${modalFieldId}')"
                    title="Clique para ir até este campo na tela"
                    data-ui="modal.analise-rascunho.row-alerta">
                    <div class="ms-1 me-auto">
                        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <span class="nft-badge" data-tone="warning">${a.categoria || 'Aviso'}</span>
                            <strong class="text-heading small">${a.campo || ''}</strong>
                            ${campoId ? `<code class="text-muted small">#${campoId}</code>` : ''}
                        </div>
                        <div class="text-muted small">${a.mensagem || ''}</div>
                    </div>
                    <button type="button" class="btn-analise-revisar-alerta"
                        onclick="event.stopPropagation(); irParaErro('${abaId}', '${campoId}', '${itemNum}', '${modalFieldId}')"
                        title="Ir diretamente para a ${abaDisplay} e revisar o campo"
                        data-ui="modal.analise-rascunho.btn-revisar">
                        <i data-lucide="crosshair" class="nft-icon--sm"></i>
                        <span>Revisar na ${abaDisplay}</span> &rarr;
                    </button>
                </li>
            `}).join('');

            alertasHtml = `
                <div class="card border border-warning mb-3 overflow-hidden" data-ui="modal.analise-rascunho.card-alertas">
                    <div class="card-header py-2 px-3 d-flex justify-content-between align-items-center">
                        <span class="fw-bold d-flex align-items-center gap-2 text-warning small">
                            <i data-lucide="alert-triangle" class="nft-icon--sm"></i>
                            <span>Alertas e Recomendações (${totalAlertas}):</span>
                        </span>
                    </div>
                    <ul class="list-group list-group-flush">
                        ${itensAlertas}
                    </ul>
                </div>
            `;
        }

        corpoEl.innerHTML = `
            ${statusBannerHtml}
            ${cardsResumoHtml}
            ${errosHtml}
            ${alertasHtml}
        `;

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        if (window.bootstrap && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
            modalInstance.show();
        }
    }

    // Função Principal Exposta Globalmente
    window.analisarRascunho = async function () {
        // Feedback visual no botão
        const btn = document.querySelector('.btn-analisar-rascunho, .sidebar-footer-btn-analisar');
        let oldHtml = '';
        if (btn) {
            oldHtml = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span><span>Analisando...</span>';
            btn.disabled = true;
        }

        try {
            // Garante chave de acesso recalculada
            if (typeof window.calcularChaveAcessoDinamica === 'function') {
                window.calcularChaveAcessoDinamica();
            }

            const payload = coletarDadosRascunho();
            const res = await fetch('/api/analisar_rascunho', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Erro HTTP ${res.status}`);
            }

            const data = await res.json();
            renderizarResultadoAnalise(data);
        } catch (err) {
            console.error("Erro ao analisar rascunho:", err);
            if (window.nftAlert) {
                window.nftAlert(`Não foi possível concluir a análise do rascunho:\n${err.message}`, {
                    title: 'Falha na Análise',
                    type: 'danger'
                });
            } else {
                alert(`Erro ao analisar rascunho: ${err.message}`);
            }
        } finally {
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
                if (window.lucide && typeof window.lucide.createIcons === 'function') {
                    window.lucide.createIcons();
                }
            }
        }
    };
})();
