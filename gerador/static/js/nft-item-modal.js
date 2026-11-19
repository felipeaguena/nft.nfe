/**
 * NFT LOGISTICS - MODAL DEDICADO DE EDIÇÃO E CADASTRO DE ITENS DA NF-E (det nItem)
 * Permite preenchimento objetivo, rápido e validado com recálculos automáticos de totais e impostos.
 */

(function () {
    let currentModalItemIndex = -1; // -1 = Novo Item, >= 0 = Editando item existente
    let cstOptionsCache = null;

    // Converte string para número float seguro
    function parseNum(val) {
        if (!val) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        let s = String(val).trim();
        if (s.includes(',') && s.includes('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function formatNum(val, dec = 2) {
        return parseNum(val).toFixed(dec);
    }

    // Injeta a estrutura HTML da Modal caso não exista no DOM
    function injectItemModalHTML() {
        if (document.getElementById('modalItemDetalhe')) return;

        const fIn = (id, label, o = {}) => `
            <div class="nft-field${o.mod ? ' nft-field--' + o.mod : ''}${o.flush ? ' nft-field--flush' : ''}"${o.tone ? ' data-tone="' + o.tone + '"' : ''} data-ui="modal.item.field-${id}">
                <label class="nft-field__label" for="${id}">${label}${o.req ? ' <span class="nft-field__req">*</span>' : ''}</label>
                <input type="${o.type || 'text'}"${o.step ? ' step="' + o.step + '"' : ''} class="nft-control${o.cls ? ' ' + o.cls : ''}" id="${id}"${o.val !== undefined ? ' value="' + o.val + '"' : ''}${o.ph ? ' placeholder="' + o.ph + '"' : ''}${o.max ? ' maxlength="' + o.max + '"' : ''}${o.ro ? ' readonly' : ''} title="${o.title || label}" data-ui="modal.item.input-${id}">
            </div>`;

        const fSel = (id, label, optionsHtml = '', o = {}) => `
            <div class="nft-field${o.mod ? ' nft-field--' + o.mod : ''}${o.flush ? ' nft-field--flush' : ''}" data-ui="modal.item.field-${id}">
                <label class="nft-field__label" for="${id}">${label}</label>
                <select class="nft-control form-select${o.cls ? ' ' + o.cls : ''}" id="${id}" title="${o.title || label}" data-ui="modal.item.select-${id}">${optionsHtml}</select>
            </div>`;

        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.id = 'modalItemDetalhe';
        modalDiv.tabIndex = -1;
        modalDiv.setAttribute('aria-labelledby', 'modalItemDetalheTitle');
        modalDiv.setAttribute('aria-hidden', 'true');
        modalDiv.setAttribute('data-ui', 'modal.item');

        modalDiv.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <!-- CABEÇALHO DO POPUP -->
                <div class="modal-header" data-ui="modal.item.header">
                    <div class="d-flex align-items-center gap-2">
                        <div class="nft-kpi-icon" data-tone="primary" id="modalItemHeaderIcon">
                            <i data-lucide="package" class="nft-icon--md"></i>
                        </div>
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <h5 class="modal-title mb-0" id="modalItemDetalheTitle">Item da NF-e</h5>
                                <span class="nft-badge nft-badge--mono" data-tone="info" id="modalItemBadgeNum" title="Número ou código do item na nota" data-ui="modal.item.badge-num">#1</span>
                            </div>
                            <small class="text-muted" id="modalItemSubtitle">Preenchimento objetivo de produtos, quantidades, rateios e impostos.</small>
                        </div>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar janela" title="Fechar janela" data-ui="modal.item.btn-close"></button>
                </div>

                <!-- CORPO DO POPUP COM ABAS -->
                <div class="modal-body" data-ui="modal.item.body">
                    <!-- NAVEGAÇÃO DE SUB-ABAS -->
                    <ul class="nav nav-tabs nav-fill mb-3" id="modalItemNavTabs" role="tablist" data-ui="modal.item.tabs">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="tab-item-geral-btn" data-bs-toggle="tab" data-bs-target="#tab-item-geral" type="button" role="tab" title="Dados do produto, quantidades e valores comerciais" data-ui="modal.item.tab-geral">
                                <i data-lucide="package" class="nft-icon--sm"></i>
                                <span>1. Produto &amp; Valores</span>
                                <span class="nft-badge nft-badge--mono" data-tone="info" id="modal-badge-resumo-vprod" title="Valor total bruto deste item (vProd)" data-ui="modal.item.badge-vprod">R$ 0,00</span>
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="tab-item-tributos-btn" data-bs-toggle="tab" data-bs-target="#tab-item-tributos" type="button" role="tab" title="Alíquotas e valores de ICMS, IPI, PIS, COFINS e II" data-ui="modal.item.tab-tributos">
                                <i data-lucide="scale" class="nft-icon--sm"></i>
                                <span>2. Tributação (ICMS, IPI, PIS, COFINS, II)</span>
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="tab-item-aduaneiro-btn" data-bs-toggle="tab" data-bs-target="#tab-item-aduaneiro" type="button" role="tab" title="Unidade tributável na SEFAZ e declaração de importação (DI/DUIMP)" data-ui="modal.item.tab-aduaneiro">
                                <i data-lucide="globe" class="nft-icon--sm"></i>
                                <span>3. Declaração Aduaneira (DI / DUIMP) &amp; Trib.</span>
                            </button>
                        </li>
                    </ul>

                    <!-- CONTEÚDO DAS ABAS -->
                    <div class="tab-content" id="modalItemTabContent" data-ui="modal.item.tab-content">
                        <!-- ABA 1: PRODUTO & VALORES -->
                        <div class="tab-pane fade show active" id="tab-item-geral" role="tabpanel" data-ui="modal.item.pane-geral">
                            <div class="row g-2">
                                <div class="col-md-2">
                                    ${fIn('m_item_nItem', 'Item (nItem)', { mod: 'sigla', val: '1', ro: true, cls: 'fw-bold', title: 'Número sequencial do item na NF-e (tag XML nItem)' })}
                                </div>
                                <div class="col-md-3">
                                    ${fIn('m_item_cProd', 'Cód. Produto (cProd)', { mod: 'code', req: true, ph: 'Ex: 0001 ou SKU', title: 'Código interno do produto ou serviço (tag XML cProd)' })}
                                </div>
                                <div class="col-md-3">
                                    ${fIn('m_item_cEAN', 'Código EAN/GTIN (cEAN)', { mod: 'code', val: 'SEM GTIN', title: 'Código de barras GTIN/EAN do produto ou SEM GTIN (tag XML cEAN)' })}
                                </div>
                                <div class="col-md-2">
                                    ${fIn('m_item_CFOP', 'CFOP', { mod: 'sigla', req: true, ph: '5102', max: '4', cls: 'fw-bold text-primary', title: 'Código Fiscal de Operações e Prestações de 4 dígitos (tag XML CFOP)' })}
                                </div>
                                <div class="col-md-2">
                                    ${fSel('m_item_orig', 'Origem Mercad.', `
                                        <option value="0">0 - Nacional</option>
                                        <option value="1">1 - Estrang. Import. Direta</option>
                                        <option value="2">2 - Estrang. Mercado Interno</option>
                                        <option value="3">3 - Nac. Conteúdo Imp. &gt; 40%</option>
                                        <option value="4">4 - Nac. Conf. Proc. Básicos</option>
                                        <option value="5">5 - Nac. Conteúdo Imp. &lt;= 40%</option>
                                        <option value="6">6 - Estrang. sem similar CAMEX</option>
                                        <option value="7">7 - Estrang. Mercado s/ similar</option>
                                        <option value="8">8 - Nac. Conteúdo Imp. &gt; 70%</option>
                                    `, { title: 'Origem da mercadoria na tabela ICMS (tag XML orig)' })}
                                </div>

                                <div class="col-md-7">
                                    ${fIn('m_item_xProd', 'Descrição do Produto (xProd)', { req: true, ph: 'Descrição comercial completa do produto...', title: 'Descrição comercial completa do produto ou serviço (tag XML xProd)' })}
                                </div>
                                <div class="col-md-3">
                                    ${fIn('m_item_NCM', 'NCM', { mod: 'code', req: true, ph: 'Ex: 84713012', max: '8', title: 'Código NCM de 8 dígitos da mercadoria (tag XML NCM)' })}
                                </div>
                                <div class="col-md-2">
                                    ${fIn('m_item_CEST', 'CEST', { mod: 'code', ph: 'Opcional', max: '7', title: 'Código Especificador da Substituição Tributária (tag XML CEST)' })}
                                </div>

                                <!-- CARD DE QUANTIDADE E VALORES -->
                                <div class="col-12 mt-3">
                                    <div class="card p-3">
                                        <h6 class="nft-section-title text-primary">
                                            <i data-lucide="dollar-sign" class="nft-icon--sm"></i>
                                            <span>Quantidades &amp; Valores Comerciais</span>
                                        </h6>
                                        <div class="row g-2">
                                            <div class="col-md-2">
                                                ${fIn('m_item_uCom', 'Un. Comercial (uCom)', { mod: 'sigla', req: true, val: 'UN', max: '6', title: 'Unidade comercial de venda ou remessa (tag XML uCom)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_qCom', 'Quantidade (qCom)', { mod: 'number', type: 'number', step: '0.0001', req: true, val: '1.0000', cls: 'fw-semibold', title: 'Quantidade comercial do item (tag XML qCom)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vUnCom', 'V. Unitário R$ (vUnCom)', { mod: 'number', type: 'number', step: '0.0001', req: true, val: '0.0000', cls: 'fw-semibold', title: 'Valor unitário comercial em Reais (tag XML vUnCom)' })}
                                            </div>
                                            <div class="col-md-2">
                                                ${fIn('m_item_pesoL', 'Kg Líquido', { mod: 'number', type: 'number', step: '0.001', ph: '0.000', cls: 'fw-semibold', title: 'Peso líquido em quilogramas para unidade tributável e volume' })}
                                            </div>
                                            <div class="col-md-2">
                                                ${fIn('m_item_vProd', 'Total do Produto R$', { mod: 'number highlight', tone: 'success', val: '0.00', ro: true, cls: 'fw-bold text-success', title: 'Valor total bruto do produto (qCom × vUnCom — tag XML vProd)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- RATEIOS E DESCONTOS -->
                                <div class="col-12 mt-2">
                                    <div class="card p-3">
                                        <h6 class="nft-section-title">
                                            <i data-lucide="git-branch" class="nft-icon--sm"></i>
                                            <span>Rateio de Despesas, Frete &amp; Descontos (R$)</span>
                                        </h6>
                                        <div class="row g-2">
                                            <div class="col-md-3">
                                                ${fIn('m_item_vFrete', 'Frete (vFrete)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Valor do frete rateado para este item (tag XML vFrete)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vSeg', 'Seguro (vSeg)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Valor do seguro rateado para este item (tag XML vSeg)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vDesc', 'Desconto (vDesc)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Valor do desconto concedido neste item (tag XML vDesc)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vOutro', 'Outras Desp. (vOutro)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Outras despesas acessórias rateadas para este item (tag XML vOutro)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- INFORMAÇÕES ADICIONAIS DO PRODUTO -->
                                <div class="col-12 mt-2">
                                    <div class="nft-field nft-field--flush" data-ui="modal.item.field-m_item_infAdProd">
                                        <label class="nft-field__label" for="m_item_infAdProd">Informações Adicionais do Produto (infAdProd)</label>
                                        <textarea class="nft-control" id="m_item_infAdProd" rows="2" placeholder="Informações técnicas, número de série, lote, observações específicas deste item..." title="Informações adicionais impressas abaixo da descrição do item no DANFE (tag XML infAdProd)" data-ui="modal.item.textarea-infAdProd"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ABA 2: TRIBUTAÇÃO -->
                        <div class="tab-pane fade" id="tab-item-tributos" role="tabpanel" data-ui="modal.item.pane-tributos">
                            <!-- BARRA DE AJUSTE RÁPIDO DE REGIME FISCAL DO ITEM -->
                            <div class="card p-2 mb-3 d-flex flex-row flex-wrap align-items-center justify-content-between gap-2" data-ui="modal.item.bar-regimes">
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <span class="small fw-bold text-muted text-uppercase">Enquadramento Rápido:</span>
                                    <button type="button" class="nft-btn nft-btn--secondary nft-btn--sm" onclick="window.aplicarRegimeAoItemModal('SUSPENSAO')" title="Aplicar Suspensão (CST 50, cEnq 108/107, PIS/COF 08)" data-ui="modal.item.btn-regime-suspensao">Suspensão</button>
                                    <button type="button" class="nft-btn nft-btn--secondary nft-btn--sm" onclick="window.aplicarRegimeAoItemModal('ISENCAO')" title="Aplicar Isenção (CST 40, cEnq 301, CST IPI 52, PIS/COF 07)" data-ui="modal.item.btn-regime-isencao">Isenção</button>
                                    <button type="button" class="nft-btn nft-btn--secondary nft-btn--sm" onclick="window.aplicarRegimeAoItemModal('RECOLHIMENTO')" title="Aplicar Recolhimento/Tributada (CST 00, cEnq 999, CST IPI 49, PIS 1.65%, COF 7.60%)" data-ui="modal.item.btn-regime-recolhimento">Recolhimento</button>
                                    <button type="button" class="nft-btn nft-btn--secondary nft-btn--sm" onclick="window.aplicarRegimeAoItemModal('IMUNIDADE')" title="Aplicar Imunidade / Reexportação (CST 41, cEnq 999, CST IPI 55, PIS/COF 08)" data-ui="modal.item.btn-regime-imunidade">Imunidade</button>
                                </div>
                                <div>
                                    <button type="button" class="nft-btn nft-btn--danger nft-btn--sm" onclick="window.zerarImpostosItemModal()" title="Zerar todas as bases e alíquotas de tributos deste item" data-ui="modal.item.btn-zerar-impostos">
                                        <i data-lucide="trash-2"></i>
                                        <span>Zerar Impostos</span>
                                    </button>
                                </div>
                            </div>

                            <div class="row g-3">
                                <!-- ICMS -->
                                <div class="col-md-6">
                                    <div class="card p-3 h-100">
                                        <h6 class="nft-section-title text-primary">ICMS / CSOSN</h6>
                                        <div class="row g-2">
                                            <div class="col-12">
                                                ${fSel('m_item_CSOSN', 'Situação Tributária (CST / CSOSN)', '', { mod: 'code', title: 'Código de Situação Tributária do ICMS (CST ou CSOSN)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_pRedBC', '% Red. Base', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Percentual de redução da base de cálculo do ICMS (tag XML pRedBC)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_vBC_ICMS', 'Base ICMS R$', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Base de cálculo do ICMS em Reais (tag XML vBC)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_pICMS', 'Alíq. ICMS %', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Alíquota do ICMS em percentual (tag XML pICMS)' })}
                                            </div>
                                            <div class="col-12">
                                                ${fIn('m_item_vICMS', 'Valor ICMS R$ (vICMS)', { mod: 'number', val: '0.00', cls: 'fw-bold', title: 'Valor do ICMS calculado em Reais (tag XML vICMS)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- IPI -->
                                <div class="col-md-6">
                                    <div class="card p-3 h-100">
                                        <h6 class="nft-section-title">IPI</h6>
                                        <div class="row g-2">
                                            <div class="col-md-8">
                                                ${fSel('m_item_CST_IPI', 'CST IPI', '', { mod: 'code', title: 'Código de Situação Tributária do IPI (tag XML CST)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_cEnq', 'cEnq IPI', { mod: 'sigla', val: '999', title: 'Código de Enquadramento Legal do IPI (tag XML cEnq)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_vBC_IPI', 'Base IPI R$', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Base de cálculo do IPI em Reais' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_pIPI', 'Alíq. IPI %', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Alíquota do IPI em percentual (tag XML pIPI)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_vIPI', 'Valor IPI R$', { mod: 'number', val: '0.00', cls: 'fw-bold', title: 'Valor do IPI em Reais (tag XML vIPI)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- PIS -->
                                <div class="col-md-6">
                                    <div class="card p-3">
                                        <h6 class="nft-section-title">PIS</h6>
                                        <div class="row g-2">
                                            <div class="col-12">
                                                ${fSel('m_item_CST_PIS', 'CST PIS', '', { mod: 'code', title: 'Código de Situação Tributária do PIS' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_vBC_PIS', 'Base PIS R$', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Base de cálculo do PIS em Reais' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_pPIS', 'Alíq. PIS %', { mod: 'number', type: 'number', step: '0.01', val: '1.65', title: 'Alíquota do PIS em percentual (tag XML pPIS)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_vPIS', 'Valor PIS R$', { mod: 'number', val: '0.00', cls: 'fw-bold', title: 'Valor do PIS em Reais (tag XML vPIS)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- COFINS -->
                                <div class="col-md-6">
                                    <div class="card p-3">
                                        <h6 class="nft-section-title">COFINS</h6>
                                        <div class="row g-2">
                                            <div class="col-12">
                                                ${fSel('m_item_CST_COFINS', 'CST COFINS', '', { mod: 'code', title: 'Código de Situação Tributária da COFINS' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_vBC_COFINS', 'Base COFINS R$', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Base de cálculo da COFINS em Reais' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_pCOFINS', 'Alíq. COFINS %', { mod: 'number', type: 'number', step: '0.01', val: '7.60', title: 'Alíquota da COFINS em percentual (tag XML pCOFINS)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_vCOFINS', 'Valor COFINS R$', { mod: 'number', val: '0.00', cls: 'fw-bold', title: 'Valor da COFINS em Reais (tag XML vCOFINS)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- IMPOSTO DE IMPORTAÇÃO (II) & IOF -->
                                <div class="col-12">
                                    <div class="card p-3">
                                        <h6 class="nft-section-title">Imposto de Importação (II) &amp; Despesas Aduaneiras</h6>
                                        <div class="row g-2">
                                            <div class="col-md-3">
                                                ${fIn('m_item_vBC_II', 'Base II (R$)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Base de cálculo do Imposto de Importação' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vDespAdu', 'Desp. Aduaneiras (vDespAdu)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Valor das despesas aduaneiras (tag XML vDespAdu)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vII', 'Valor II (vII)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Valor do Imposto de Importação (tag XML vII)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vIOF', 'Valor IOF (vIOF)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Valor do IOF aduaneiro (tag XML vIOF)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ABA 3: DECLARAÇÃO ADUANEIRA (DI / DUIMP) & UNIDADE TRIBUTÁVEL -->
                        <div class="tab-pane fade" id="tab-item-aduaneiro" role="tabpanel" data-ui="modal.item.pane-aduaneiro">
                            <div class="row g-3">
                                <!-- UNIDADES TRIBUTÁVEIS (uTrib) -->
                                <div class="col-12">
                                    <div class="card p-3">
                                        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 border-bottom pb-2">
                                            <h6 class="nft-section-title text-primary border-0 pb-0 mb-0">Unidade Tributável na SEFAZ (uTrib / qTrib / vUnTrib)</h6>
                                            <button type="button" class="nft-btn nft-btn--secondary nft-btn--sm" id="btn-copiar-com-para-trib" title="Copiar unidade, quantidade e valor comercial para os campos tributáveis" data-ui="modal.item.btn-copiar-trib">
                                                <i data-lucide="copy"></i>
                                                <span>Copiar Comercial &rarr; Tributável</span>
                                            </button>
                                        </div>
                                        <div class="row g-2">
                                            <div class="col-md-2">
                                                ${fIn('m_item_uTrib', 'Un. Trib (uTrib)', { mod: 'sigla', val: 'UN', max: '6', title: 'Unidade tributável exigida pela tabela NCM SEFAZ (tag XML uTrib)' })}
                                            </div>
                                            <div class="col-md-2">
                                                ${fIn('m_item_qTrib', 'Qtd. Trib (qTrib)', { mod: 'number', type: 'number', step: '0.0001', val: '1.0000', title: 'Quantidade na unidade tributável (tag XML qTrib)' })}
                                            </div>
                                            <div class="col-md-2">
                                                ${fIn('m_item_pesoL_adu', 'Kg Líquido', { mod: 'number', type: 'number', step: '0.001', ph: '0.000', title: 'Peso líquido em quilogramas deste item' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vUnTrib', 'V. Unit. Trib (vUnTrib)', { mod: 'number', type: 'number', step: '0.0001', val: '0.0000', title: 'Valor unitário de tributação (vProd / qTrib — tag XML vUnTrib)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_cEANTrib', 'GTIN Tributável (cEANTrib)', { mod: 'code', val: 'SEM GTIN', title: 'Código GTIN da unidade tributável ou SEM GTIN (tag XML cEANTrib)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- DADOS DA DI / DUIMP -->
                                <div class="col-12">
                                    <div class="card p-3">
                                        <h6 class="nft-section-title">Declaração de Importação (DI / DUIMP) &amp; Adição</h6>
                                        <div class="row g-2">
                                            <div class="col-md-3">
                                                ${fIn('m_item_nDI', 'Número DI/DUIMP (nDI)', { mod: 'code', ph: 'Ex: 24/1234567-8', title: 'Número do documento de importação DI/DUIMP (tag XML nDI)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_dDI', 'Data Registro (dDI)', { type: 'date', title: 'Data de registro da DI/DUIMP (tag XML dDI)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_xLocDesemb', 'Local Desembaraço (xLocDesemb)', { ph: 'Ex: PORTO DE SANTOS', title: 'Local onde ocorreu o desembaraço aduaneiro (tag XML xLocDesemb)' })}
                                            </div>
                                            <div class="col-md-2">
                                                ${fIn('m_item_UFDesemb', 'UF Desemb.', { mod: 'sigla', max: '2', ph: 'SP', title: 'Sigla da UF onde ocorreu o desembaraço aduaneiro (tag XML UFDesemb)' })}
                                            </div>

                                            <div class="col-md-3">
                                                ${fIn('m_item_dDesemb', 'Data Desembaraço', { type: 'date', title: 'Data do desembaraço aduaneiro (tag XML dDesemb)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fSel('m_item_tpViaTransp', 'Via de Transporte', `
                                                    <option value="1">1 - Marítima</option>
                                                    <option value="2">2 - Fluvial</option>
                                                    <option value="3">3 - Lacustre</option>
                                                    <option value="4">4 - Aérea</option>
                                                    <option value="5">5 - Postal</option>
                                                    <option value="6">6 - Ferroviária</option>
                                                    <option value="7">7 - Rodoviária</option>
                                                    <option value="8">8 - Conduto / Rede Transmissão</option>
                                                    <option value="9">9 - Meios Próprios</option>
                                                    <option value="10">10 - Entrada / Saída Ficta</option>
                                                `, { title: 'Via de transporte internacional informada na DI (tag XML tpViaTransp)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_vAFRMM', 'AFRMM (vAFRMM)', { mod: 'number', type: 'number', step: '0.01', val: '0.00', title: 'Valor da AFRMM — Adicional ao Frete para Renovação da Marinha Mercante (tag XML vAFRMM)' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fSel('m_item_tpIntermedio', 'Intermediação', `
                                                    <option value="1">1 - Importação Conta Própria</option>
                                                    <option value="2">2 - Importação Conta e Ordem</option>
                                                    <option value="3">3 - Importação por Encomenda</option>
                                                `, { title: 'Forma de importação quanto à intermediação (tag XML tpIntermedio)' })}
                                            </div>

                                            <div class="col-md-2">
                                                ${fIn('m_item_nAdicao', 'Nº Adição', { mod: 'sigla', val: '1', title: 'Número da adição dentro da DI (tag XML nAdicao)' })}
                                            </div>
                                            <div class="col-md-2">
                                                ${fIn('m_item_nSeqAdic', 'Seq. Adição', { mod: 'sigla', val: '1', title: 'Número sequencial do item dentro da adição (tag XML nSeqAdic)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_cFabricante', 'Cód. Fabricante (cFabricante)', { mod: 'code', ph: 'Fabricante estrangeiro', title: 'Código do fabricante estrangeiro (tag XML cFabricante)' })}
                                            </div>
                                            <div class="col-md-4">
                                                ${fIn('m_item_cExportador', 'Cód. Exportador (cExportador)', { mod: 'code', ph: 'Exportador estrangeiro', title: 'Código do exportador estrangeiro (tag XML cExportador)' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- CÂMBIO & CONVERSÃO -->
                                <div class="col-12">
                                    <div class="card p-3">
                                        <h6 class="nft-section-title">Câmbio &amp; Conversão de Moeda Estrangeira</h6>
                                        <div class="row g-2">
                                            <div class="col-md-3">
                                                ${fIn('m_item_moeda_conversao', 'Moeda Utilizada', { mod: 'sigla', ph: 'USD / EUR', title: 'Sigla da moeda estrangeira utilizada na DI/DUIMP' })}
                                            </div>
                                            <div class="col-md-3">
                                                ${fIn('m_item_taxa_conversao', 'Taxa Câmbio (PTAX)', { mod: 'number', type: 'number', step: '0.0001', ph: 'Ex: 5.4321', title: 'Taxa de câmbio utilizada na conversão para Reais' })}
                                            </div>
                                            <div class="col-md-6 d-flex align-items-center">
                                                <small class="text-muted">Esses valores são registrados como referência de conversão da DI/DUIMP para a moeda nacional.</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- RODAPÉ DO POPUP -->
                <div class="modal-footer d-flex justify-content-between" data-ui="modal.item.footer">
                    <div>
                        <button type="button" class="nft-btn nft-btn--secondary" id="btn-recalcular-impostos-modal" title="Recalcular automaticamente ICMS, IPI, PIS e COFINS com base no Total do Produto" data-ui="modal.item.btn-recalcular">
                            <i data-lucide="refresh-cw"></i>
                            <span>Recalcular Impostos</span>
                        </button>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button type="button" class="nft-btn nft-btn--ghost" data-bs-dismiss="modal" title="Fechar sem salvar alterações do item" data-ui="modal.item.btn-cancelar">Cancelar</button>
                        <button type="button" class="nft-btn nft-btn--primary" id="btn-salvar-item-modal" title="Confirmar e salvar dados do item na grade da NF-e" data-ui="modal.item.btn-salvar">
                            <i data-lucide="check"></i>
                            <span id="btn-salvar-item-modal-texto">Salvar Item</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.appendChild(modalDiv);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: modalDiv });
        }
        vincularEventosCalculosModal();
        carregarCSTsParaModal();
    }

    // Carrega CSTs oficiais nos selects da Modal
    async function carregarCSTsParaModal() {
        try {
            if (!cstOptionsCache) {
                const resp = await fetch('/api/csts');
                const data = await resp.json();
                if (data.status === 'success' && data.csts) {
                    cstOptionsCache = data.csts;
                }
            }

            if (!cstOptionsCache) return;

            // 1. ICMS / CSOSN
            const selCsosn = document.getElementById('m_item_CSOSN');
            if (selCsosn && selCsosn.options.length <= 1) {
                selCsosn.innerHTML = '';
                const grpCsosn = document.createElement('optgroup');
                grpCsosn.label = 'Simples Nacional (CSOSN)';
                const grpIcms = document.createElement('optgroup');
                grpIcms.label = 'Regime Normal (CST ICMS)';
                (cstOptionsCache.csosn || []).forEach(c => grpCsosn.appendChild(new Option(c.codigo_descricao, c.codigo)));
                (cstOptionsCache.icms || []).forEach(c => grpIcms.appendChild(new Option(c.codigo_descricao, c.codigo)));
                selCsosn.appendChild(grpCsosn);
                selCsosn.appendChild(grpIcms);
            }

            // 2. IPI
            const selIpi = document.getElementById('m_item_CST_IPI');
            if (selIpi && selIpi.options.length <= 1) {
                selIpi.innerHTML = '';
                const grpEnt = document.createElement('optgroup');
                grpEnt.label = 'Entradas';
                const grpSai = document.createElement('optgroup');
                grpSai.label = 'Saídas';
                (cstOptionsCache.ipi || []).forEach(c => {
                    const opt = new Option(c.codigo_descricao, c.codigo);
                    if (c.aplicacao === 'ENTRADA' || c.aplicacao === 'IMPORTACAO') grpEnt.appendChild(opt);
                    else grpSai.appendChild(opt);
                });
                selIpi.appendChild(grpEnt);
                selIpi.appendChild(grpSai);
            }

            // 3. PIS & COFINS
            ['m_item_CST_PIS', 'm_item_CST_COFINS'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel && sel.options.length <= 1) {
                    sel.innerHTML = '';
                    (cstOptionsCache.pis_cofins || []).forEach(c => sel.appendChild(new Option(c.codigo_descricao, c.codigo)));
                }
            });
        } catch (e) {
            console.warn('Erro ao carregar CSTs para o modal:', e);
        }
    }

    // Vincula cálculos em tempo real no formulário da modal
    function vincularEventosCalculosModal() {
        const qComEl = document.getElementById('m_item_qCom');
        const vUnComEl = document.getElementById('m_item_vUnCom');
        const vProdEl = document.getElementById('m_item_vProd');
        const badgeResumo = document.getElementById('modal-badge-resumo-vprod');

        function recalcularTotalItemModal(autoAtualizarImpostos = true) {
            const q = parseNum(qComEl ? qComEl.value : 1);
            const vu = parseNum(vUnComEl ? vUnComEl.value : 0);
            const total = q * vu;
            const totalStr = total.toFixed(2);

            if (vProdEl) vProdEl.value = totalStr;
            if (badgeResumo) badgeResumo.innerText = 'R$ ' + totalStr.replace('.', ',');

            if (autoAtualizarImpostos) {
                recalcularImpostosModal(false);
            }
        }

        if (qComEl) qComEl.addEventListener('input', () => recalcularTotalItemModal(true));
        if (vUnComEl) vUnComEl.addEventListener('input', () => recalcularTotalItemModal(true));

        function syncPesoL(origem) {
            const pesoVal = (document.getElementById(origem)?.value || '').trim();
            const outroId = origem === 'm_item_pesoL' ? 'm_item_pesoL_adu' : 'm_item_pesoL';
            const outroEl = document.getElementById(outroId);
            if (outroEl && outroEl.value !== pesoVal) outroEl.value = pesoVal;

            const uTribVal = (document.getElementById('m_item_uTrib')?.value || '').trim().toUpperCase();
            const cfopVal = (document.getElementById('m_item_CFOP')?.value || '').trim();
            const isReexportOuKG = (uTribVal === 'KG' || cfopVal.startsWith('7'));

            if (isReexportOuKG) {
                const pesoNum = parseNum(pesoVal);
                const qTribEl = document.getElementById('m_item_qTrib');
                const vUnTribEl = document.getElementById('m_item_vUnTrib');
                const vProdVal = parseNum(document.getElementById('m_item_vProd')?.value);
                if (pesoNum > 0) {
                    if (qTribEl) qTribEl.value = pesoNum.toFixed(4);
                    if (vProdVal > 0 && vUnTribEl) {
                        vUnTribEl.value = (vProdVal / pesoNum).toFixed(4);
                    }
                }
            }

            const infAdEl = document.getElementById('m_item_infAdProd');
            if (infAdEl && typeof window.montarTextoInfAdProd === 'function') {
                const itemTemp = {
                    nDI: document.getElementById('m_item_nDI')?.value,
                    nAdicao: document.getElementById('m_item_nAdicao')?.value,
                    nSeqAdic: document.getElementById('m_item_nSeqAdic')?.value,
                    nItem: document.getElementById('modalItemBadgeNum')?.textContent?.replace('#', ''),
                    pesoL: pesoVal,
                    infAdProd: infAdEl.value
                };
                infAdEl.value = window.montarTextoInfAdProd(itemTemp);
            }
        }

        const pLEl1 = document.getElementById('m_item_pesoL');
        if (pLEl1) pLEl1.addEventListener('input', () => syncPesoL('m_item_pesoL'));
        const pLEl2 = document.getElementById('m_item_pesoL_adu');
        if (pLEl2) pLEl2.addEventListener('input', () => syncPesoL('m_item_pesoL_adu'));

        ['m_item_nDI', 'm_item_nAdicao', 'm_item_nSeqAdic'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    const infAdEl = document.getElementById('m_item_infAdProd');
                    if (infAdEl && typeof window.montarTextoInfAdProd === 'function') {
                        const itemTemp = {
                            nDI: document.getElementById('m_item_nDI')?.value,
                            nAdicao: document.getElementById('m_item_nAdicao')?.value,
                            nSeqAdic: document.getElementById('m_item_nSeqAdic')?.value,
                            nItem: document.getElementById('modalItemBadgeNum')?.textContent?.replace('#', ''),
                            pesoL: document.getElementById('m_item_pesoL')?.value,
                            infAdProd: infAdEl.value
                        };
                        infAdEl.value = window.montarTextoInfAdProd(itemTemp);
                    }
                });
            }
        });

        const qTribInputEl = document.getElementById('m_item_qTrib');
        if (qTribInputEl) {
            qTribInputEl.addEventListener('input', function() {
                const qTribNum = parseNum(qTribInputEl.value);
                const vProdVal = parseNum(document.getElementById('m_item_vProd')?.value);
                const vUnTribEl = document.getElementById('m_item_vUnTrib');
                if (qTribNum > 0 && vProdVal > 0 && vUnTribEl) {
                    vUnTribEl.value = (vProdVal / qTribNum).toFixed(4);
                }
                const uTribVal = (document.getElementById('m_item_uTrib')?.value || '').trim().toUpperCase();
                const cfopVal = (document.getElementById('m_item_CFOP')?.value || '').trim();
                if ((uTribVal === 'KG' || cfopVal.startsWith('7')) && qTribNum > 0) {
                    const pL1 = document.getElementById('m_item_pesoL');
                    const pL2 = document.getElementById('m_item_pesoL_adu');
                    if (pL1 && parseNum(pL1.value) <= 0) pL1.value = qTribNum.toFixed(4);
                    if (pL2 && parseNum(pL2.value) <= 0) pL2.value = qTribNum.toFixed(4);
                }
                const infAdEl = document.getElementById('m_item_infAdProd');
                if (infAdEl && typeof window.montarTextoInfAdProd === 'function') {
                    const itemTemp = {
                        nDI: document.getElementById('m_item_nDI')?.value,
                        nAdicao: document.getElementById('m_item_nAdicao')?.value,
                        nSeqAdic: document.getElementById('m_item_nSeqAdic')?.value,
                        nItem: document.getElementById('modalItemBadgeNum')?.textContent?.replace('#', ''),
                        pesoL: document.getElementById('m_item_pesoL')?.value,
                        infAdProd: infAdEl.value
                    };
                    infAdEl.value = window.montarTextoInfAdProd(itemTemp);
                }
            });
        }

        // Botão copiar comercial para tributável
        const btnCopiar = document.getElementById('btn-copiar-com-para-trib');
        if (btnCopiar) {
            btnCopiar.addEventListener('click', function () {
                const uCom = (document.getElementById('m_item_uCom').value || 'UN').trim();
                const qCom = document.getElementById('m_item_qCom').value || '1.0000';
                const vUnCom = document.getElementById('m_item_vUnCom').value || '0.0000';

                document.getElementById('m_item_uTrib').value = uCom;
                document.getElementById('m_item_qTrib').value = qCom;
                document.getElementById('m_item_vUnTrib').value = vUnCom;
            });
        }

        // Botão recalcular impostos
        const btnRecalcImp = document.getElementById('btn-recalcular-impostos-modal');
        if (btnRecalcImp) {
            btnRecalcImp.addEventListener('click', () => recalcularImpostosModal(true));
        }

        // Listeners de impostos individuais
        ['m_item_vBC_ICMS', 'm_item_pICMS'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcICMS);
        });
        ['m_item_vBC_IPI', 'm_item_pIPI'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcIPI);
        });
        ['m_item_vBC_PIS', 'm_item_pPIS'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcPIS);
        });
        ['m_item_vBC_COFINS', 'm_item_pCOFINS'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcCOFINS);
        });

        // Botão Salvar
        const btnSalvar = document.getElementById('btn-salvar-item-modal');
        if (btnSalvar) {
            btnSalvar.addEventListener('click', salvarModalItem);
        }
    }

    function calcICMS() {
        const bc = parseNum(document.getElementById('m_item_vBC_ICMS').value);
        const p = parseNum(document.getElementById('m_item_pICMS').value);
        document.getElementById('m_item_vICMS').value = (bc * (p / 100)).toFixed(2);
    }

    function calcIPI() {
        const bc = parseNum(document.getElementById('m_item_vBC_IPI').value);
        const p = parseNum(document.getElementById('m_item_pIPI').value);
        document.getElementById('m_item_vIPI').value = (bc * (p / 100)).toFixed(2);
    }

    function calcPIS() {
        const bc = parseNum(document.getElementById('m_item_vBC_PIS').value);
        const p = parseNum(document.getElementById('m_item_pPIS').value);
        document.getElementById('m_item_vPIS').value = (bc * (p / 100)).toFixed(2);
    }

    function calcCOFINS() {
        const bc = parseNum(document.getElementById('m_item_vBC_COFINS').value);
        const p = parseNum(document.getElementById('m_item_pCOFINS').value);
        document.getElementById('m_item_vCOFINS').value = (bc * (p / 100)).toFixed(2);
    }

    function recalcularImpostosModal(forcar = false) {
        const vProd = parseNum(document.getElementById('m_item_vProd').value);
        const vFrete = parseNum(document.getElementById('m_item_vFrete').value);
        const vSeg = parseNum(document.getElementById('m_item_vSeg').value);

        // ICMS
        const elBcIcms = document.getElementById('m_item_vBC_ICMS');
        if (forcar || parseNum(elBcIcms.value) === 0 || parseNum(elBcIcms.value) === vProd) {
            elBcIcms.value = vProd.toFixed(2);
        }
        calcICMS();

        // IPI
        const elBcIpi = document.getElementById('m_item_vBC_IPI');
        if (forcar || parseNum(elBcIpi.value) === 0) {
            elBcIpi.value = vProd.toFixed(2);
        }
        calcIPI();

        // PIS & COFINS
        const elBcPis = document.getElementById('m_item_vBC_PIS');
        if (forcar || parseNum(elBcPis.value) === 0) {
            elBcPis.value = vProd.toFixed(2);
        }
        calcPIS();

        const elBcCofins = document.getElementById('m_item_vBC_COFINS');
        if (forcar || parseNum(elBcCofins.value) === 0) {
            elBcCofins.value = vProd.toFixed(2);
        }
        calcCOFINS();

        // II
        const elBcII = document.getElementById('m_item_vBC_II');
        if (forcar || parseNum(elBcII.value) === 0) {
            elBcII.value = (vProd + vFrete + vSeg).toFixed(2);
        }
    }

    // Obtém a lista atual de itens
    function getListaItensAtual() {
        if (Array.isArray(window.itensCache)) return window.itensCache;
        if (window.itensTable && typeof window.itensTable.getData === 'function') {
            return window.itensTable.getData();
        }
        const t = window.Tabulator ? window.Tabulator.findTable('#itens-table')[0] : null;
        if (t) return t.getData();
        return [];
    }

    // Salva a lista de itens e atualiza tabela e totais
    function aplicarListaItensAtual(novaLista, scrollToIdx = -1) {
        window.itensCache = novaLista;
        if (typeof itensCache !== 'undefined') {
            itensCache = novaLista;
        }

        const diGeral = (document.getElementById('import_nDI')?.value || '').trim();
        novaLista.forEach((it, idx) => {
            if (!it.nItem) it.nItem = String(idx + 1);
            if (!it.nSeqAdic) it.nSeqAdic = it.nItem;
            if (diGeral && (!it.nDI || it.nDI.trim() === '')) {
                it.nDI = diGeral;
            }
            if (typeof window.montarTextoInfAdProd === 'function') {
                it.infAdProd = window.montarTextoInfAdProd(it);
            }
        });

        let table = window.itensTable;
        if (!table && window.Tabulator) {
            const arr = window.Tabulator.findTable('#itens-table');
            if (arr && arr.length > 0) table = arr[0];
        }

        if (table) {
            table.setData(novaLista);
            if (scrollToIdx >= 0) {
                const rows = table.getRows();
                if (rows && rows[scrollToIdx]) {
                    rows[scrollToIdx].scrollTo();
                }
            }
        }

        // Atualiza contador no badge da aba
        const badge = document.getElementById('itens-badge');
        if (badge) badge.innerText = novaLista.length;

        // Recalcula totais gerais da nota
        if (typeof window.recalcularTotaisDosItens === 'function') {
            window.recalcularTotaisDosItens(true);
        }
        if (typeof window.atualizarBadgesRateioEItens === 'function') {
            window.atualizarBadgesRateioEItens();
        }
    }

    // ABRIR MODAL: NOVO ITEM
    window.abrirModalItemNovo = function () {
        injectItemModalHTML();
        carregarCSTsParaModal();

        currentModalItemIndex = -1;
        const lista = getListaItensAtual();
        const proxItemNum = lista.length + 1;

        // Recupera valores padrão da Operação selecionada se existir
        let opCfop = "5102";
        let opCsosn = "00";
        let opAliqIcms = "0.00";
        let opCstIpi = "99";
        let opAliqIpi = "0.00";
        let opCstPis = "01";
        let opAliqPis = "1.65";
        let opCstCofins = "01";
        let opAliqCofins = "7.60";

        if (window.operacoesCache && Array.isArray(window.operacoesCache)) {
            const selOp = document.getElementById('select_operacao');
            const nomeOp = selOp ? selOp.value : '';
            const op = window.operacoesCache.find(o => o.nome_operacao && o.nome_operacao.toUpperCase() === (nomeOp || '').toUpperCase());
            if (op) {
                if (op.cfop_padrao) opCfop = op.cfop_padrao;
                if (op.csosn_icms) opCsosn = op.csosn_icms;
                if (op.aliquota_icms !== undefined) opAliqIcms = String(op.aliquota_icms);
                if (op.cst_ipi) opCstIpi = op.cst_ipi;
                if (op.aliquota_ipi !== undefined) opAliqIpi = String(op.aliquota_ipi);
                if (op.cst_pis) opCstPis = op.cst_pis;
                if (op.aliquota_pis !== undefined) opAliqPis = String(op.aliquota_pis);
                if (op.cst_cofins) opCstCofins = op.cst_cofins;
                if (op.aliquota_cofins !== undefined) opAliqCofins = String(op.aliquota_cofins);
            }
        }

        // Títulos e cabeçalho
        document.getElementById('modalItemDetalheTitle').innerText = "Adicionar Novo Item da NF-e";
        document.getElementById('modalItemBadgeNum').innerText = "#" + proxItemNum;
        document.getElementById('modalItemSubtitle').innerText = "Preencha os campos abaixo e clique em Confirmar para inserir na grade da nota.";
        document.getElementById('btn-salvar-item-modal-texto').innerText = "Adicionar à Nota";

        // Preenche campos padrões
        document.getElementById('m_item_nItem').value = String(proxItemNum);
        document.getElementById('m_item_cProd').value = String(proxItemNum).padStart(4, '0');
        document.getElementById('m_item_cEAN').value = "SEM GTIN";
        document.getElementById('m_item_xProd').value = "";
        document.getElementById('m_item_NCM').value = "";
        document.getElementById('m_item_CEST').value = "";
        document.getElementById('m_item_CFOP').value = opCfop;
        document.getElementById('m_item_orig').value = "0";
        document.getElementById('m_item_uCom').value = "UN";
        document.getElementById('m_item_qCom').value = "1.0000";
        document.getElementById('m_item_vUnCom').value = "0.0000";
        document.getElementById('m_item_vProd').value = "0.00";
        document.getElementById('modal-badge-resumo-vprod').innerText = "R$ 0,00";
        document.getElementById('m_item_vFrete').value = "0.00";
        document.getElementById('m_item_vSeg').value = "0.00";
        document.getElementById('m_item_vDesc').value = "0.00";
        document.getElementById('m_item_vOutro').value = "0.00";
        document.getElementById('m_item_infAdProd').value = "";
        if (document.getElementById('m_item_pesoL')) document.getElementById('m_item_pesoL').value = "";
        if (document.getElementById('m_item_pesoL_adu')) document.getElementById('m_item_pesoL_adu').value = "";

        // Tributos padrão
        const selCsosn = document.getElementById('m_item_CSOSN');
        if (selCsosn) selCsosn.value = opCsosn;
        document.getElementById('m_item_pRedBC').value = "0.00";
        document.getElementById('m_item_vBC_ICMS').value = "0.00";
        document.getElementById('m_item_pICMS').value = opAliqIcms;
        document.getElementById('m_item_vICMS').value = "0.00";

        const selIpi = document.getElementById('m_item_CST_IPI');
        if (selIpi) selIpi.value = opCstIpi;
        document.getElementById('m_item_cEnq').value = "999";
        document.getElementById('m_item_vBC_IPI').value = "0.00";
        document.getElementById('m_item_pIPI').value = opAliqIpi;
        document.getElementById('m_item_vIPI').value = "0.00";

        const selPis = document.getElementById('m_item_CST_PIS');
        if (selPis) selPis.value = opCstPis;
        document.getElementById('m_item_vBC_PIS').value = "0.00";
        document.getElementById('m_item_pPIS').value = opAliqPis;
        document.getElementById('m_item_vPIS').value = "0.00";

        const selCofins = document.getElementById('m_item_CST_COFINS');
        if (selCofins) selCofins.value = opCstCofins;
        document.getElementById('m_item_vBC_COFINS').value = "0.00";
        document.getElementById('m_item_pCOFINS').value = opAliqCofins;
        document.getElementById('m_item_vCOFINS').value = "0.00";

        document.getElementById('m_item_vBC_II').value = "0.00";
        document.getElementById('m_item_vDespAdu').value = "0.00";
        document.getElementById('m_item_vII').value = "0.00";
        document.getElementById('m_item_vIOF').value = "0.00";

        // Unidade Tributável padrão
        document.getElementById('m_item_uTrib').value = "UN";
        document.getElementById('m_item_qTrib').value = "1.0000";
        document.getElementById('m_item_vUnTrib').value = "0.0000";
        document.getElementById('m_item_cEANTrib').value = "SEM GTIN";

        // Dados DI herdados da Identificação da Importação no cabeçalho (se preenchidos)
        const elDiGeral = document.getElementById('import_nDI') || document.getElementById('di_numero') || document.getElementById('numero_di');
        const elDdiGeral = document.getElementById('import_dDI');
        const elLocDesembGeral = document.getElementById('import_xLocDesemb');
        const elUfDesembGeral = document.getElementById('import_UFDesemb');
        const elDDesembGeral = document.getElementById('import_dDesemb');
        const elViaTranspGeral = document.getElementById('import_tpViaTransp');
        const elIntermedioGeral = document.getElementById('import_tpIntermedio');
        const elExportadorGeral = document.getElementById('import_cExportador') || document.getElementById('dest_xNome');

        document.getElementById('m_item_nDI').value = elDiGeral ? elDiGeral.value : "";
        document.getElementById('m_item_dDI').value = elDdiGeral ? elDdiGeral.value : "";
        document.getElementById('m_item_xLocDesemb').value = elLocDesembGeral ? elLocDesembGeral.value : "";
        document.getElementById('m_item_UFDesemb').value = elUfDesembGeral ? elUfDesembGeral.value : "";
        document.getElementById('m_item_dDesemb').value = elDDesembGeral ? elDDesembGeral.value : "";
        document.getElementById('m_item_tpViaTransp').value = elViaTranspGeral ? elViaTranspGeral.value : "1";
        document.getElementById('m_item_tpIntermedio').value = elIntermedioGeral ? elIntermedioGeral.value : "1";
        document.getElementById('m_item_vAFRMM').value = "0.00";
        document.getElementById('m_item_nAdicao').value = "1";
        document.getElementById('m_item_nSeqAdic').value = "1";
        document.getElementById('m_item_cFabricante').value = "";
        document.getElementById('m_item_cExportador').value = elExportadorGeral ? elExportadorGeral.value : "";
        document.getElementById('m_item_moeda_conversao').value = "";
        document.getElementById('m_item_taxa_conversao').value = "";

        // Inicializa Informações Adicionais (infAdProd) do novo item
        if (typeof window.montarTextoInfAdProd === 'function') {
            document.getElementById('m_item_infAdProd').value = window.montarTextoInfAdProd({
                nDI: elDiGeral ? elDiGeral.value : "",
                nAdicao: "1",
                nSeqAdic: String(proxItemNum),
                nItem: String(proxItemNum),
                pesoL: "",
                infAdProd: ""
            });
        } else {
            document.getElementById('m_item_infAdProd').value = "";
        }

        // Ativa a primeira aba
        const tabBtn = document.getElementById('tab-item-geral-btn');
        if (tabBtn && window.bootstrap && bootstrap.Tab) {
            bootstrap.Tab.getOrCreateInstance(tabBtn).show();
        }

        // Abre a modal
        const modalEl = document.getElementById('modalItemDetalhe');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
        if (window.validarCamposRegexVisual) setTimeout(window.validarCamposRegexVisual, 50);

        setTimeout(() => {
            const xProd = document.getElementById('m_item_xProd');
            if (xProd) xProd.focus();
        }, 200);
    };

    // ABRIR MODAL: EDITAR ITEM EXISTENTE
    window.abrirModalItemEditar = function (rowData, optIndex = -1) {
        if (!rowData) return;
        injectItemModalHTML();
        carregarCSTsParaModal();

        const lista = getListaItensAtual();
        let idx = -1;
        if (optIndex >= 0 && optIndex < lista.length) {
            idx = optIndex;
        } else {
            idx = lista.findIndex(it => it === rowData || (it.nItem && String(it.nItem) === String(rowData.nItem)));
        }
        currentModalItemIndex = idx >= 0 ? idx : 0;

        // Títulos e cabeçalho
        document.getElementById('modalItemDetalheTitle').innerText = "Editar Item #" + (rowData.nItem || (currentModalItemIndex + 1));
        document.getElementById('modalItemBadgeNum').innerText = (rowData.cProd || "ITEM");
        document.getElementById('modalItemSubtitle').innerText = (rowData.xProd || "Edição detalhada do item");
        document.getElementById('btn-salvar-item-modal-texto').innerText = "Salvar Alterações";

        // Preenche campos a partir de rowData
        document.getElementById('m_item_nItem').value = String(rowData.nItem || (currentModalItemIndex + 1));
        document.getElementById('m_item_cProd').value = rowData.cProd || "";
        document.getElementById('m_item_cEAN').value = rowData.cEAN || "SEM GTIN";
        document.getElementById('m_item_xProd').value = rowData.xProd || "";
        document.getElementById('m_item_NCM').value = rowData.NCM || "";
        document.getElementById('m_item_CEST').value = rowData.CEST || "";
        document.getElementById('m_item_CFOP').value = rowData.CFOP || "";
        document.getElementById('m_item_orig').value = String(rowData.orig !== undefined ? rowData.orig : "0");
        document.getElementById('m_item_uCom').value = rowData.uCom || "UN";
        document.getElementById('m_item_qCom').value = formatNum(rowData.qCom, 4);
        document.getElementById('m_item_vUnCom').value = formatNum(rowData.vUnCom, 4);
        
        const vProd = formatNum(rowData.vProd, 2);
        document.getElementById('m_item_vProd').value = vProd;
        document.getElementById('modal-badge-resumo-vprod').innerText = "R$ " + vProd.replace('.', ',');

        document.getElementById('m_item_vFrete').value = formatNum(rowData.vFrete, 2);
        document.getElementById('m_item_vSeg').value = formatNum(rowData.vSeg, 2);
        document.getElementById('m_item_vDesc').value = formatNum(rowData.vDesc, 2);
        document.getElementById('m_item_vOutro').value = formatNum(rowData.vOutro, 2);
        const pesoLVal = rowData.pesoL || rowData.kg_liquido || rowData.peso_liquido || "";
        if (document.getElementById('m_item_pesoL')) document.getElementById('m_item_pesoL').value = pesoLVal;
        if (document.getElementById('m_item_pesoL_adu')) document.getElementById('m_item_pesoL_adu').value = pesoLVal;
        document.getElementById('m_item_infAdProd').value = typeof window.montarTextoInfAdProd === 'function' ? window.montarTextoInfAdProd(rowData) : (rowData.infAdProd || "");

        // Tributos
        const cstIcms = rowData.CSOSN || rowData.CST_ICMS || "00";
        const selCsosn = document.getElementById('m_item_CSOSN');
        if (selCsosn) selCsosn.value = cstIcms;
        document.getElementById('m_item_pRedBC').value = formatNum(rowData.pRedBC, 2);
        document.getElementById('m_item_vBC_ICMS').value = formatNum(rowData.vBC_ICMS, 2);
        document.getElementById('m_item_pICMS').value = formatNum(rowData.pICMS, 2);
        document.getElementById('m_item_vICMS').value = formatNum(rowData.vICMS, 2);

        const selIpi = document.getElementById('m_item_CST_IPI');
        if (selIpi) selIpi.value = rowData.CST_IPI || "99";
        document.getElementById('m_item_cEnq').value = rowData.cEnq || "999";
        document.getElementById('m_item_vBC_IPI').value = formatNum(rowData.vBC_IPI, 2);
        document.getElementById('m_item_pIPI').value = formatNum(rowData.pIPI, 2);
        document.getElementById('m_item_vIPI').value = formatNum(rowData.vIPI, 2);

        const selPis = document.getElementById('m_item_CST_PIS');
        if (selPis) selPis.value = rowData.CST_PIS || "01";
        document.getElementById('m_item_vBC_PIS').value = formatNum(rowData.vBC_PIS, 2);
        document.getElementById('m_item_pPIS').value = formatNum(rowData.pPIS, 2);
        document.getElementById('m_item_vPIS').value = formatNum(rowData.vPIS, 2);

        const selCofins = document.getElementById('m_item_CST_COFINS');
        if (selCofins) selCofins.value = rowData.CST_COFINS || "01";
        document.getElementById('m_item_vBC_COFINS').value = formatNum(rowData.vBC_COFINS, 2);
        document.getElementById('m_item_pCOFINS').value = formatNum(rowData.pCOFINS, 2);
        document.getElementById('m_item_vCOFINS').value = formatNum(rowData.vCOFINS, 2);

        document.getElementById('m_item_vBC_II').value = formatNum(rowData.vBC_II, 2);
        document.getElementById('m_item_vDespAdu').value = formatNum(rowData.vDespAdu, 2);
        document.getElementById('m_item_vII').value = formatNum(rowData.vII, 2);
        document.getElementById('m_item_vIOF').value = formatNum(rowData.vIOF, 2);

        // Unidade Tributável
        document.getElementById('m_item_uTrib').value = rowData.uTrib || rowData.uCom || "UN";
        document.getElementById('m_item_qTrib').value = formatNum(rowData.qTrib || rowData.qCom, 4);
        document.getElementById('m_item_vUnTrib').value = formatNum(rowData.vUnTrib || rowData.vUnCom, 4);
        document.getElementById('m_item_cEANTrib').value = rowData.cEANTrib || "SEM GTIN";

        // Dados DI
        document.getElementById('m_item_nDI').value = rowData.nDI || "";
        document.getElementById('m_item_dDI').value = rowData.dDI || "";
        document.getElementById('m_item_xLocDesemb').value = rowData.xLocDesemb || "";
        document.getElementById('m_item_UFDesemb').value = rowData.UFDesemb || "";
        document.getElementById('m_item_dDesemb').value = rowData.dDesemb || "";
        document.getElementById('m_item_tpViaTransp').value = String(rowData.tpViaTransp || "1");
        document.getElementById('m_item_tpIntermedio').value = String(rowData.tpIntermedio || "1");
        document.getElementById('m_item_vAFRMM').value = formatNum(rowData.vAFRMM, 2);
        document.getElementById('m_item_nAdicao').value = String(rowData.nAdicao || "1");
        document.getElementById('m_item_nSeqAdic').value = String(rowData.nSeqAdic || "1");
        document.getElementById('m_item_cFabricante').value = rowData.cFabricante || "";
        document.getElementById('m_item_cExportador').value = rowData.cExportador || "";
        document.getElementById('m_item_moeda_conversao').value = rowData.moeda_conversao || "";
        document.getElementById('m_item_taxa_conversao').value = rowData.taxa_conversao || "";

        // Ativa a primeira aba
        const tabBtn = document.getElementById('tab-item-geral-btn');
        if (tabBtn && window.bootstrap && bootstrap.Tab) {
            bootstrap.Tab.getOrCreateInstance(tabBtn).show();
        }

        // Abre a modal
        const modalEl = document.getElementById('modalItemDetalhe');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
        if (window.validarCamposRegexVisual) setTimeout(window.validarCamposRegexVisual, 50);

        setTimeout(() => {
            const xProd = document.getElementById('m_item_xProd');
            if (xProd) xProd.focus();
        }, 200);
    };

    // SALVAR ITEM (NOVO OU EDITADO)
    function salvarModalItem() {
        const xProd = (document.getElementById('m_item_xProd').value || '').trim();
        const cProd = (document.getElementById('m_item_cProd').value || '').trim();
        const cfop = (document.getElementById('m_item_CFOP').value || '').trim();
        const ncm = (document.getElementById('m_item_NCM').value || '').trim();
        const qCom = parseNum(document.getElementById('m_item_qCom').value);
        const vUnCom = parseNum(document.getElementById('m_item_vUnCom').value);

        if (!xProd) {
            alert('Por favor, informe a Descrição do Produto (xProd).');
            document.getElementById('m_item_xProd').focus();
            return;
        }

        if (!cfop || cfop.length < 4) {
            alert('Por favor, informe um CFOP válido com 4 dígitos.');
            document.getElementById('m_item_CFOP').focus();
            return;
        }

        if (qCom <= 0) {
            alert('A quantidade comercial (qCom) deve ser maior que zero.');
            document.getElementById('m_item_qCom').focus();
            return;
        }

        const vProd = (qCom * vUnCom).toFixed(2);
        const uCom = (document.getElementById('m_item_uCom').value || 'UN').trim().toUpperCase();

        const csosnVal = (document.getElementById('m_item_CSOSN').value || '00').trim();

        // Monta o objeto completo do item
        const itemObj = {
            nItem: document.getElementById('m_item_nItem').value || "1",
            cProd: cProd || String(document.getElementById('m_item_nItem').value).padStart(4, '0'),
            cEAN: document.getElementById('m_item_cEAN').value || "SEM GTIN",
            xProd: xProd,
            NCM: ncm,
            CEST: document.getElementById('m_item_CEST').value || "",
            CFOP: cfop,
            orig: document.getElementById('m_item_orig').value || "0",
            uCom: uCom,
            qCom: qCom.toFixed(4),
            vUnCom: vUnCom.toFixed(4),
            vProd: vProd,
            indTot: "1",
            enquadramento: (itemIndex !== null && itemIndex !== undefined && itemIndex >= 0 && window.itensCache && window.itensCache[itemIndex] && window.itensCache[itemIndex].enquadramento)
                ? window.itensCache[itemIndex].enquadramento
                : (document.getElementById('op_regime')?.value || 'SUSPENSAO'),
            vFrete: formatNum(document.getElementById('m_item_vFrete').value, 2),
            vSeg: formatNum(document.getElementById('m_item_vSeg').value, 2),
            vDesc: formatNum(document.getElementById('m_item_vDesc').value, 2),
            vOutro: formatNum(document.getElementById('m_item_vOutro').value, 2),
            pesoL: (document.getElementById('m_item_pesoL') ? document.getElementById('m_item_pesoL').value : '') || '',
            infAdProd: document.getElementById('m_item_infAdProd').value || (typeof window.montarTextoInfAdProd === 'function' ? window.montarTextoInfAdProd({
                nDI: document.getElementById('m_item_nDI')?.value,
                nAdicao: document.getElementById('m_item_nAdicao')?.value,
                nSeqAdic: document.getElementById('m_item_nSeqAdic')?.value,
                pesoL: document.getElementById('m_item_pesoL')?.value,
                infAdProd: ''
            }) : ""),

            // ICMS
            CSOSN: csosnVal,
            CST_ICMS: csosnVal,
            modBC: "3",
            pRedBC: formatNum(document.getElementById('m_item_pRedBC').value, 2),
            vBC_ICMS: formatNum(document.getElementById('m_item_vBC_ICMS').value, 2),
            pICMS: formatNum(document.getElementById('m_item_pICMS').value, 2),
            vICMS: formatNum(document.getElementById('m_item_vICMS').value, 2),
            motDesICMS: "",
            vICMSDeson: "0.00",

            // IPI
            CST_IPI: document.getElementById('m_item_CST_IPI').value || "99",
            cEnq: document.getElementById('m_item_cEnq').value || "999",
            vBC_IPI: formatNum(document.getElementById('m_item_vBC_IPI').value, 2),
            pIPI: formatNum(document.getElementById('m_item_pIPI').value, 2),
            vIPI: formatNum(document.getElementById('m_item_vIPI').value, 2),

            // PIS
            CST_PIS: document.getElementById('m_item_CST_PIS').value || "01",
            vBC_PIS: formatNum(document.getElementById('m_item_vBC_PIS').value, 2),
            pPIS: formatNum(document.getElementById('m_item_pPIS').value, 2),
            vPIS: formatNum(document.getElementById('m_item_vPIS').value, 2),

            // COFINS
            CST_COFINS: document.getElementById('m_item_CST_COFINS').value || "01",
            vBC_COFINS: formatNum(document.getElementById('m_item_vBC_COFINS').value, 2),
            pCOFINS: formatNum(document.getElementById('m_item_pCOFINS').value, 2),
            vCOFINS: formatNum(document.getElementById('m_item_vCOFINS').value, 2),

            // II
            vBC_II: formatNum(document.getElementById('m_item_vBC_II').value, 2),
            vDespAdu: formatNum(document.getElementById('m_item_vDespAdu').value, 2),
            vII: formatNum(document.getElementById('m_item_vII').value, 2),
            vIOF: formatNum(document.getElementById('m_item_vIOF').value, 2),

            // Tributável
            uTrib: (document.getElementById('m_item_uTrib').value || uCom).trim().toUpperCase(),
            qTrib: formatNum(document.getElementById('m_item_qTrib').value || qCom, 4),
            vUnTrib: formatNum(document.getElementById('m_item_vUnTrib').value || vUnCom, 4),
            cEANTrib: document.getElementById('m_item_cEANTrib').value || "SEM GTIN",
            qTrib_manual: (() => {
                const qTribVal = parseNum(document.getElementById('m_item_qTrib').value);
                const qComVal = parseNum(document.getElementById('m_item_qCom').value);
                const origRow = (currentModalItemIndex >= 0 && getListaItensAtual()[currentModalItemIndex]) ? getListaItensAtual()[currentModalItemIndex] : null;
                if (origRow && (origRow.qTrib_manual === true || origRow.qTrib_manual === 'true' || origRow.qTrib_manual === 1)) {
                    return (qTribVal > 0);
                }
                return (qTribVal > 0 && Math.abs(qTribVal - qComVal) > 0.00001);
            })(),

            // DI / Aduaneiro
            nDI: document.getElementById('m_item_nDI').value || "",
            dDI: document.getElementById('m_item_dDI').value || "",
            xLocDesemb: document.getElementById('m_item_xLocDesemb').value || "",
            UFDesemb: (document.getElementById('m_item_UFDesemb').value || "").toUpperCase(),
            dDesemb: document.getElementById('m_item_dDesemb').value || "",
            tpViaTransp: document.getElementById('m_item_tpViaTransp').value || "1",
            vAFRMM: formatNum(document.getElementById('m_item_vAFRMM').value, 2),
            tpIntermedio: document.getElementById('m_item_tpIntermedio').value || "1",
            CNPJ: "",
            UFTerceiro: "",
            cExportador: document.getElementById('m_item_cExportador').value || "",
            nAdicao: document.getElementById('m_item_nAdicao').value || "1",
            nSeqAdic: document.getElementById('m_item_nSeqAdic').value || "1",
            cFabricante: document.getElementById('m_item_cFabricante').value || "",
            vDescDI: "0.00",
            nDraw: "",
            moeda_conversao: document.getElementById('m_item_moeda_conversao').value || "",
            taxa_conversao: document.getElementById('m_item_taxa_conversao').value || ""
        };

        const lista = getListaItensAtual();
        let targetScrollIdx = -1;

        if (currentModalItemIndex >= 0 && currentModalItemIndex < lista.length) {
            // Editando existente
            lista[currentModalItemIndex] = Object.assign({}, lista[currentModalItemIndex], itemObj);
            targetScrollIdx = currentModalItemIndex;
        } else {
            // Novo item
            lista.push(itemObj);
            targetScrollIdx = lista.length - 1;
        }

        // Re-indexa nItem sequencialmente e atualiza Informações Adicionais
        lista.forEach((it, i) => {
            it.nItem = String(i + 1);
            if (!it.nSeqAdic) it.nSeqAdic = it.nItem;
            if (typeof window.montarTextoInfAdProd === 'function') {
                it.infAdProd = window.montarTextoInfAdProd(it);
            }
        });

        // Aplica a nova lista na grade Tabulator e nos cálculos
        aplicarListaItensAtual(lista, targetScrollIdx);

        // Fecha a modal
        const modalEl = document.getElementById('modalItemDetalhe');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        // Alerta moderno ou aviso de sucesso
        const msg = currentModalItemIndex >= 0 ? `Item #${itemObj.nItem} atualizado com sucesso!` : `Novo item #${itemObj.nItem} adicionado à nota com sucesso!`;
        if (window.nftAlert) {
            window.nftAlert(msg, { type: 'success', title: 'Itens da Nota' });
        }
    }

    // Intercepta e redefine adicionarNovoItem globalmente para abrir o pop-up
    window.adicionarNovoItem = function () {
        window.abrirModalItemNovo();
    };

    // ==========================================
    // IDENTIFICAÇÃO DA IMPORTAÇÃO & SINCRONIZAÇÃO
    // ==========================================
    window.puxarNomeDestinatarioParaExportador = function () {
        const destNome = document.getElementById('dest_xNome');
        const exp = document.getElementById('import_cExportador');
        if (exp) {
            if (destNome && destNome.value) {
                exp.value = destNome.value.trim();
                exp.dataset.autoSynced = 'true';
            } else {
                exp.value = '';
            }
        }
    };

    window.repassarImportacaoParaItens = async function () {
        const nDI = (document.getElementById('import_nDI')?.value || '').trim();
        const dDI = document.getElementById('import_dDI')?.value || '';
        const cExportador = (document.getElementById('import_cExportador')?.value || '').trim();
        const tpViaTransp = document.getElementById('import_tpViaTransp')?.value || '1';
        const tpIntermedio = document.getElementById('import_tpIntermedio')?.value || '1';
        const UFDesemb = (document.getElementById('import_UFDesemb')?.value || '').trim().toUpperCase();
        const xLocDesemb = (document.getElementById('import_xLocDesemb')?.value || '').trim().toUpperCase();
        const dDesemb = document.getElementById('import_dDesemb')?.value || '';

        let lista = getListaItensAtual();

        if (!lista || lista.length === 0) {
            const msgInfo = 'ℹ️ Dados de importação gravados como padrão! Ao adicionar novos itens, esses dados serão herdados automaticamente.';
            if (typeof window.nftAlert === 'function') {
                await window.nftAlert(msgInfo, 'info');
            } else {
                alert(msgInfo);
            }
            return;
        }

        const table = (typeof itensTable !== 'undefined' && itensTable) ? itensTable : window.itensTable;
        let selecionados = (table && typeof table.getSelectedData === 'function') ? table.getSelectedData() : [];

        let alvos = lista;
        if (selecionados.length > 0 && selecionados.length < lista.length) {
            let aplicarSoSelecionados = false;
            if (window.nftConfirm) {
                aplicarSoSelecionados = await window.nftConfirm(
                    `Há ${selecionados.length} item(ns) selecionado(s) na grade.\n\nDeseja repassar os dados da Declaração de Importação (DI):\n• OK / Confirmar: Somente para os ${selecionados.length} itens selecionados\n• Cancelar: Para TODOS os ${lista.length} itens da nota`,
                    {
                        title: "Repassar Dados da DI",
                        type: "question",
                        confirmText: "Somente Selecionados",
                        cancelText: "Todos os Itens"
                    }
                );
            } else {
                aplicarSoSelecionados = confirm(`Deseja repassar para apenas os ${selecionados.length} itens selecionados? (Clique em Cancelar para repassar para todos)`);
            }
            if (aplicarSoSelecionados) {
                alvos = selecionados;
            }
        }

        alvos.forEach(item => {
            item.nDI = nDI;
            item.dDI = dDI;
            item.cExportador = cExportador;
            item.tpViaTransp = tpViaTransp;
            item.tpIntermedio = tpIntermedio;
            item.UFDesemb = UFDesemb;
            item.xLocDesemb = xLocDesemb;
            item.dDesemb = dDesemb;
            if (typeof window.montarTextoInfAdProd === 'function') {
                item.infAdProd = window.montarTextoInfAdProd(item);
            }
        });

        aplicarListaItensAtual(lista);

        const msgSucesso = `✅ Dados de importação (DI ${nDI || 'S/N'}) repassados com sucesso para ${alvos.length === lista.length ? `todos os ${lista.length}` : `${alvos.length}`} itens da nota!`;
        if (typeof window.nftAlert === 'function') {
            await window.nftAlert(msgSucesso, 'success');
        } else {
            alert(msgSucesso);
        }
    };

    window.inicializarSincronizacaoImportacao = function () {
        const destNome = document.getElementById('dest_xNome');
        const exp = document.getElementById('import_cExportador');
        if (destNome && exp) {
            const aoMudarDestNome = function () {
                if (!exp.value || exp.dataset.autoSynced === 'true') {
                    exp.value = destNome.value;
                    exp.dataset.autoSynced = 'true';
                }
            };
            destNome.addEventListener('input', aoMudarDestNome);
            destNome.addEventListener('change', aoMudarDestNome);
            exp.addEventListener('input', function () {
                exp.dataset.autoSynced = 'false';
            });
            if (destNome.value && !exp.value) {
                exp.value = destNome.value.trim();
                exp.dataset.autoSynced = 'true';
            }
        }

        // Sincronização em tempo real de import_nDI com Informações Adicionais dos Itens
        const diInput = document.getElementById('import_nDI');
        if (diInput) {
            if (!diInput.dataset) diInput.dataset = {};
            if (!diInput.dataset.infAdSynced) {
                diInput.dataset.infAdSynced = 'true';
                const aoMudarDI = function () {
                    if (typeof window.sincronizarInfAdProdTodosItens === 'function') {
                        window.sincronizarInfAdProdTodosItens(true);
                    }
                };
                if (typeof diInput.addEventListener === 'function') {
                    diInput.addEventListener('input', aoMudarDI);
                    diInput.addEventListener('change', aoMudarDI);
                }
            }
        }

        // Sincronização de Observações Complementares (infCpl)
        const infCplInput = document.getElementById('infCpl');
        if (infCplInput) {
            if (!infCplInput.dataset) infCplInput.dataset = {};
            if (!infCplInput.dataset.infAdSynced) {
                infCplInput.dataset.infAdSynced = 'true';
                if (typeof infCplInput.addEventListener === 'function') {
                    infCplInput.addEventListener('change', function () {
                        if (typeof window.sincronizarInfAdProdTodosItens === 'function') {
                            window.sincronizarInfAdProdTodosItens(true);
                        }
                    });
                }
            }
        }

        // Sincronização de Peso Líquido do Transporte
        const pesoLTransp = document.getElementById('transp_pesoL');
        if (pesoLTransp) {
            if (!pesoLTransp.dataset) pesoLTransp.dataset = {};
            if (!pesoLTransp.dataset.infAdSynced) {
                pesoLTransp.dataset.infAdSynced = 'true';
                if (typeof pesoLTransp.addEventListener === 'function') {
                    pesoLTransp.addEventListener('change', function () {
                        if (typeof window.sincronizarInfAdProdTodosItens === 'function') {
                            window.sincronizarInfAdProdTodosItens(true);
                        }
                    });
                }
            }
        }
    };

    // Função global de zerar impostos (II, IPI, PIS, COFINS) dos itens com suporte a modal de escopo (Todos vs Selecionados)
    window.zerarImpostosTodosItensComConfirmacao = async function () {
        if (typeof window.abrirModalZerarImpostos === 'function') {
            return await window.abrirModalZerarImpostos();
        }
        const lista = getListaItensAtual();
            if (!lista || lista.length === 0) {
                if (window.nftAlert) {
                    await window.nftAlert("Nenhum item carregado na grade para zerar impostos.", {
                        type: "warning",
                        title: "Nenhum Item Encontrado"
                    });
                } else {
                    alert("Nenhum item carregado na grade para zerar impostos.");
                }
                return;
            }

            const qtd = lista.length;
            const confirmMsg = `Atenção: Esta ação irá alterar os dados da nota fiscal, zerando a Base de Cálculo, Alíquota (%) e Valor dos seguintes impostos em ${qtd === 1 ? '1 item' : `todos os ${qtd} itens`}:\n\n• Imposto de Importação (II): Base de Cálculo e Valor\n• IPI: Base de Cálculo, % Alíquota e Valor\n• PIS: Base de Cálculo, % Alíquota e Valor\n• COFINS: Base de Cálculo, % Alíquota e Valor\n\nTodos os totais da nota fiscal e do rateio serão recalculados automaticamente.\n\nDeseja confirmar a alteração nos dados?`;

            let confirmado = false;
            if (window.nftConfirm) {
                confirmado = await window.nftConfirm(confirmMsg, {
                    title: 'Alerta de Alteração de Dados - Zerar Impostos',
                    type: 'warning',
                    confirmText: 'Confirmar',
                    cancelText: 'Cancelar',
                    icon: 'alert-triangle'
                });
            } else {
                confirmado = confirm(confirmMsg);
            }

            if (!confirmado) return;

            lista.forEach(it => {
                // II (Imposto de Importação)
                it.vBC_II = '0.00';
                it.vII = '0.00';
                if ('pII' in it || it.pII !== undefined) it.pII = '0.00';

                // IPI
                it.vBC_IPI = '0.00';
                it.pIPI = '0.00';
                it.vIPI = '0.00';

                // PIS
                it.vBC_PIS = '0.00';
                it.pPIS = '0.00';
                it.vPIS = '0.00';

                // COFINS
                it.vBC_COFINS = '0.00';
                it.pCOFINS = '0.00';
                it.vCOFINS = '0.00';
            });

            aplicarListaItensAtual(lista);

            if (typeof window.triggerAutoSave === 'function') {
                window.triggerAutoSave();
            }

            if (window.nftAlert) {
                await window.nftAlert(`Impostos (II, IPI, PIS e COFINS) zerados com sucesso em ${qtd === 1 ? '1 item' : `${qtd} itens`}!`, {
                    type: 'success',
                    title: 'Impostos Zerados'
                });
            }
        };

    // APLICA REGIME FISCAL ESPECÍFICO AOS CAMPOS DO ITEM NA MODAL
    window.aplicarRegimeAoItemModal = function (regime) {
        const cfop = (document.getElementById('m_item_CFOP')?.value || '').trim();
        const vProd = parseNum(document.getElementById('m_item_vProd')?.value || 0);
        const vFrete = parseNum(document.getElementById('m_item_vFrete')?.value || 0);
        const vSeg = parseNum(document.getElementById('m_item_vSeg')?.value || 0);
        const vOutro = parseNum(document.getElementById('m_item_vOutro')?.value || 0);
        const baseCalculoCheia = (vProd + vFrete + vSeg + vOutro).toFixed(2);

        if (regime === 'SUSPENSAO') {
            const elCsosn = document.getElementById('m_item_CSOSN');
            if (elCsosn) elCsosn.value = '50';
            document.getElementById('m_item_pRedBC').value = '0.00';
            document.getElementById('m_item_vBC_ICMS').value = '0.00';
            document.getElementById('m_item_pICMS').value = '0.00';
            document.getElementById('m_item_vICMS').value = '0.00';

            const elIpi = document.getElementById('m_item_CST_IPI');
            if (elIpi) {
                elIpi.value = (cfop.startsWith('1') || cfop.startsWith('2')) ? '05' : '55';
            }
            document.getElementById('m_item_cEnq').value = (cfop === '3930') ? '160' : (['5914', '6914', '1914', '2914'].includes(cfop) ? '102' : '160');
            document.getElementById('m_item_vBC_IPI').value = '0.00';
            document.getElementById('m_item_pIPI').value = '0.00';
            document.getElementById('m_item_vIPI').value = '0.00';

            const elPis = document.getElementById('m_item_CST_PIS');
            if (elPis) elPis.value = '08';
            document.getElementById('m_item_vBC_PIS').value = '0.00';
            document.getElementById('m_item_pPIS').value = '0.00';
            document.getElementById('m_item_vPIS').value = '0.00';

            const elCofins = document.getElementById('m_item_CST_COFINS');
            if (elCofins) elCofins.value = '08';
            document.getElementById('m_item_vBC_COFINS').value = '0.00';
            document.getElementById('m_item_pCOFINS').value = '0.00';
            document.getElementById('m_item_vCOFINS').value = '0.00';

            document.getElementById('m_item_vBC_II').value = '0.00';
            document.getElementById('m_item_vII').value = '0.00';
            document.getElementById('m_item_vIOF').value = '0.00';
            document.getElementById('m_item_vDespAdu').value = '0.00';
        } else if (regime === 'ISENCAO') {
            const elCsosn = document.getElementById('m_item_CSOSN');
            if (elCsosn) elCsosn.value = '40';
            document.getElementById('m_item_pRedBC').value = '0.00';
            document.getElementById('m_item_vBC_ICMS').value = '0.00';
            document.getElementById('m_item_pICMS').value = '0.00';
            document.getElementById('m_item_vICMS').value = '0.00';

            const elIpi = document.getElementById('m_item_CST_IPI');
            if (elIpi) elIpi.value = '52';
            document.getElementById('m_item_cEnq').value = '301';
            document.getElementById('m_item_vBC_IPI').value = '0.00';
            document.getElementById('m_item_pIPI').value = '0.00';
            document.getElementById('m_item_vIPI').value = '0.00';

            const elPis = document.getElementById('m_item_CST_PIS');
            if (elPis) elPis.value = '07';
            document.getElementById('m_item_vBC_PIS').value = '0.00';
            document.getElementById('m_item_pPIS').value = '0.00';
            document.getElementById('m_item_vPIS').value = '0.00';

            const elCofins = document.getElementById('m_item_CST_COFINS');
            if (elCofins) elCofins.value = '07';
            document.getElementById('m_item_vBC_COFINS').value = '0.00';
            document.getElementById('m_item_pCOFINS').value = '0.00';
            document.getElementById('m_item_vCOFINS').value = '0.00';

            document.getElementById('m_item_vBC_II').value = '0.00';
            document.getElementById('m_item_vII').value = '0.00';
            document.getElementById('m_item_vIOF').value = '0.00';
            document.getElementById('m_item_vDespAdu').value = '0.00';
        } else if (regime === 'IMUNIDADE') {
            const elCsosn = document.getElementById('m_item_CSOSN');
            if (elCsosn) elCsosn.value = '41';
            document.getElementById('m_item_pRedBC').value = '0.00';
            document.getElementById('m_item_vBC_ICMS').value = '0.00';
            document.getElementById('m_item_pICMS').value = '0.00';
            document.getElementById('m_item_vICMS').value = '0.00';

            const elIpi = document.getElementById('m_item_CST_IPI');
            if (elIpi) elIpi.value = '55';
            document.getElementById('m_item_cEnq').value = '999';
            document.getElementById('m_item_vBC_IPI').value = '0.00';
            document.getElementById('m_item_pIPI').value = '0.00';
            document.getElementById('m_item_vIPI').value = '0.00';

            const elPis = document.getElementById('m_item_CST_PIS');
            if (elPis) elPis.value = '08';
            document.getElementById('m_item_vBC_PIS').value = '0.00';
            document.getElementById('m_item_pPIS').value = '0.00';
            document.getElementById('m_item_vPIS').value = '0.00';

            const elCofins = document.getElementById('m_item_CST_COFINS');
            if (elCofins) elCofins.value = '08';
            document.getElementById('m_item_vBC_COFINS').value = '0.00';
            document.getElementById('m_item_pCOFINS').value = '0.00';
            document.getElementById('m_item_vCOFINS').value = '0.00';

            document.getElementById('m_item_vBC_II').value = '0.00';
            document.getElementById('m_item_vII').value = '0.00';
            document.getElementById('m_item_vIOF').value = '0.00';
            document.getElementById('m_item_vDespAdu').value = '0.00';
        } else if (regime === 'RECOLHIMENTO') {
            const elCsosn = document.getElementById('m_item_CSOSN');
            if (elCsosn) elCsosn.value = '00';
            document.getElementById('m_item_pRedBC').value = '0.00';
            document.getElementById('m_item_vBC_ICMS').value = baseCalculoCheia;
            if (parseNum(document.getElementById('m_item_pICMS').value) === 0) {
                document.getElementById('m_item_pICMS').value = '18.00';
            }
            calcICMS();

            const elIpi = document.getElementById('m_item_CST_IPI');
            if (elIpi) elIpi.value = '49';
            document.getElementById('m_item_cEnq').value = '999';
            document.getElementById('m_item_vBC_IPI').value = vProd.toFixed(2);
            calcIPI();

            const elPis = document.getElementById('m_item_CST_PIS');
            if (elPis) elPis.value = '01';
            document.getElementById('m_item_vBC_PIS').value = baseCalculoCheia;
            document.getElementById('m_item_pPIS').value = '1.65';
            calcPIS();

            const elCofins = document.getElementById('m_item_CST_COFINS');
            if (elCofins) elCofins.value = '01';
            document.getElementById('m_item_vBC_COFINS').value = baseCalculoCheia;
            document.getElementById('m_item_pCOFINS').value = '7.60';
            calcCOFINS();
        }
    };

    // ZERA OS IMPOSTOS DO ITEM ABERTO NA MODAL COM POPUP DE CONFIRMAÇÃO
    window.zerarImpostosItemModal = async function () {
        const confirmMsg = "Atenção: Deseja zerar todas as bases de cálculo, alíquotas (%) e valores de impostos (II, IPI, PIS, COFINS e ICMS) deste item específico?";
        let confirmado = false;
        if (window.nftConfirm) {
            confirmado = await window.nftConfirm(confirmMsg, {
                title: 'Zerar Impostos do Item',
                type: 'warning',
                confirmText: 'Zerar Impostos',
                cancelText: 'Cancelar',
                icon: 'alert-triangle'
            });
        } else {
            confirmado = confirm(confirmMsg);
        }
        if (!confirmado) return;

        document.getElementById('m_item_pRedBC').value = '0.00';
        document.getElementById('m_item_vBC_ICMS').value = '0.00';
        document.getElementById('m_item_pICMS').value = '0.00';
        document.getElementById('m_item_vICMS').value = '0.00';

        document.getElementById('m_item_vBC_IPI').value = '0.00';
        document.getElementById('m_item_pIPI').value = '0.00';
        document.getElementById('m_item_vIPI').value = '0.00';

        document.getElementById('m_item_vBC_PIS').value = '0.00';
        document.getElementById('m_item_pPIS').value = '0.00';
        document.getElementById('m_item_vPIS').value = '0.00';

        document.getElementById('m_item_vBC_COFINS').value = '0.00';
        document.getElementById('m_item_pCOFINS').value = '0.00';
        document.getElementById('m_item_vCOFINS').value = '0.00';

        document.getElementById('m_item_vBC_II').value = '0.00';
        document.getElementById('m_item_vII').value = '0.00';
        document.getElementById('m_item_vIOF').value = '0.00';
        document.getElementById('m_item_vDespAdu').value = '0.00';
    };

    // Inicialização ao carregar o DOM
    document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('itens') || document.getElementById('itens-table')) {
            injectItemModalHTML();
        }
        window.inicializarSincronizacaoImportacao();
    });

    if (document.body) {
        if (document.getElementById('itens') || document.getElementById('itens-table')) {
            injectItemModalHTML();
        }
        window.inicializarSincronizacaoImportacao();
    }

    // === PADRONIZAÇÃO DE INFORMAÇÕES ADICIONAIS DO PRODUTO (infAdProd) ===
    window.montarTextoInfAdProd = function(item) {
        if (!item) return "";
        let nDI = String(item.nDI || document.getElementById('import_nDI')?.value || '').trim();
        if (!nDI) {
            const infCplVal = document.getElementById('infCpl')?.value || '';
            const m = infCplVal.match(/DI:\s*([0-9\/\.\-]+)/i);
            if (m) nDI = m[1].trim();
        }

        let nAdicao = String(item.nAdicao || '1').trim();
        let nSeqAdic = String(item.nSeqAdic || item.nItem || '1').trim();
        let pesoL = String(item.pesoL || item.kg_liquido || item.peso_liquido || '').trim();
        let pesoLNum = 0;
        if (typeof parseNum === 'function') {
            pesoLNum = parseNum(pesoL);
        } else {
            pesoLNum = parseFloat(pesoL.replace(',', '.'));
        }
        if (isNaN(pesoLNum)) pesoLNum = 0;

        let infAd = String(item.infAdProd || '').replace(/^undefined$|^null$/i, '').trim();

        // Extrair qualquer texto personalizado anterior que não seja DI nem Peso
        let textoExtra = infAd;
        textoExtra = textoExtra.replace(/DI:\s*[\w\.\/\-]+(?:\s+(?:Adicao|Adição|Adic)\s*:?\s*\d+)?(?:\s+(?:Item|Seq)\s*:?\s*\d+)?/gi, '');
        textoExtra = textoExtra.replace(/DI:\s*[^;\-\–\—\n\r]+/gi, '');
        textoExtra = textoExtra.replace(/(?:Peso\s*L[ií]q(?:uido)?|Kg\s*L[ií]q(?:uido)?)\s*[:=]?\s*[\d.,]+\s*(?:kg)?/gi, '');
        textoExtra = textoExtra.replace(/[\s\-\–\—;:]{2,}/g, ' - ');
        textoExtra = textoExtra.replace(/^[\s\-\–\—;:,]+|[\s\-\–\—;:,]+$/g, '').trim();

        const partes = [];
        if (nDI) {
            const rawAdic = nAdicao.replace(/\D/g, '').replace(/^0+/, '') || '1';
            const rawSeq = nSeqAdic.replace(/\D/g, '').replace(/^0+/, '') || '1';
            const adicPad = String(rawAdic).padStart(3, '0');
            const seqPad = String(rawSeq).padStart(3, '0');
            partes.push(`DI: ${nDI} Adicao: ${adicPad} Item: ${seqPad}`);
        }

        if (pesoLNum > 0) {
            partes.push(`Peso Liq: ${pesoL} kg`);
        }

        if (textoExtra) {
            partes.push(textoExtra);
        }

        return partes.join(' - ');
    };

    // === SINCRONIZAÇÃO GERAL DE INFORMAÇÕES ADICIONAIS EM TODOS OS ITENS ===
    window.sincronizarInfAdProdTodosItens = function(redesenhar = true) {
        let table = window.itensTable;
        if (!table && window.Tabulator) {
            const arr = window.Tabulator.findTable('#itens-table');
            if (arr && arr.length > 0) table = arr[0];
        }

        let lista = [];
        if (typeof itensCache !== 'undefined' && Array.isArray(itensCache) && itensCache.length > 0) {
            lista = itensCache;
        } else if (window.itensCache && Array.isArray(window.itensCache) && window.itensCache.length > 0) {
            lista = window.itensCache;
        } else if (table && typeof table.getData === 'function') {
            lista = table.getData();
        }

        if (!lista || lista.length === 0) return;

        const diGeral = (document.getElementById('import_nDI')?.value || '').trim();
        let houveAlteracao = false;

        lista.forEach((item, idx) => {
            if (!item.nItem) item.nItem = String(idx + 1);
            if (!item.nSeqAdic) item.nSeqAdic = item.nItem;

            if (diGeral && (!item.nDI || item.nDI.trim() === '')) {
                item.nDI = diGeral;
            }

            const novoTexto = window.montarTextoInfAdProd(item);
            if (item.infAdProd !== novoTexto) {
                item.infAdProd = novoTexto;
                houveAlteracao = true;
            }
        });

        if (houveAlteracao && table) {
            const rows = (typeof table.getRows === 'function') ? table.getRows() : [];
            if (rows && rows.length > 0) {
                rows.forEach((r, idx) => {
                    const rowData = r.getData();
                    const targetItem = lista[idx] || rowData;
                    if (rowData.infAdProd !== targetItem.infAdProd) {
                        r.update({ infAdProd: targetItem.infAdProd });
                    }
                });
            } else {
                table.setData(lista);
            }
            if (redesenhar && typeof table.redraw === 'function') {
                setTimeout(() => table.redraw(true), 30);
            }
        }
    };

    // === SUBSTITUIR UNIDADES PELOS VALORES OFICIAIS ABREVIADOS ===
    window.substituirUnidadesPorAbreviadas = async function() {
        try {
            let table = window.itensTable;
            if (!table && window.Tabulator) {
                const arr = window.Tabulator.findTable('#itens-table');
                if (arr && arr.length > 0) table = arr[0];
            }
            if (!table) {
                alert('Tabela de itens não encontrada!');
                return;
            }

            const itens = table.getData();
            if (!itens || itens.length === 0) {
                if (window.nftAlert) {
                    await window.nftAlert('Nenhum item na tabela para abreviar unidades.', 'info');
                } else {
                    alert('Nenhum item na tabela para abreviar unidades.');
                }
                return;
            }

            const res = await fetch('/api/unidades_tributaveis');
            if (!res.ok) throw new Error('Não foi possível obter a tabela de unidades tributáveis.');
            const unidadesConfig = await res.json();

            function normalizar(txt) {
                if (!txt) return '';
                return String(txt)
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .trim()
                    .toUpperCase();
            }

            const mapaVariacoes = {};
            unidadesConfig.forEach(u => {
                const codOficial = String(u.codigo).trim().toUpperCase();
                mapaVariacoes[normalizar(codOficial)] = codOficial;
                if (Array.isArray(u.variacoes)) {
                    u.variacoes.forEach(v => {
                        const norm = normalizar(v);
                        if (norm) mapaVariacoes[norm] = codOficial;
                    });
                }
            });

            // Popup de confirmação antes de alterar as unidades comercializadas (Un. Com.)
            let alterarUnCom = false;
            if (window.nftConfirm) {
                alterarUnCom = await window.nftConfirm(
                    "Deseja aplicar a padronização oficial de abreviações também nas Unidades Comercializadas (Un. Com.)?\n\n• Sim: Padroniza tanto 'Un. Trib.' quanto 'Un. Com.'\n• Não: Padroniza apenas 'Un. Trib.' (mantém 'Un. Com.' original)",
                    {
                        title: "Padronizar Unidades Fiscais e Comerciais",
                        confirmText: "Sim, padronizar Un. Com.",
                        cancelText: "Apenas Un. Trib.",
                        type: "info",
                        icon: "scale"
                    }
                );
            } else {
                alterarUnCom = confirm("Deseja aplicar a padronização de abreviações também nas Unidades Comercializadas (Un. Com.)?\n\nOK = Sim (Un. Trib e Un. Com)\nCancelar = Apenas Un. Trib");
            }

            let alteradosTrib = 0;
            let alteradosCom = 0;
            let itensAlterados = 0;

            itens.forEach(item => {
                let alterouItem = false;
                if (item.uTrib) {
                    const normTrib = normalizar(item.uTrib);
                    if (mapaVariacoes[normTrib] && item.uTrib !== mapaVariacoes[normTrib]) {
                        item.uTrib = mapaVariacoes[normTrib];
                        alteradosTrib++;
                        alterouItem = true;
                    }
                }
                if (alterarUnCom && item.uCom) {
                    const normCom = normalizar(item.uCom);
                    if (mapaVariacoes[normCom] && item.uCom !== mapaVariacoes[normCom]) {
                        item.uCom = mapaVariacoes[normCom];
                        alteradosCom++;
                        alterouItem = true;
                    }
                }
                if (alterouItem) itensAlterados++;
            });

            await table.setData(itens);
            window.itensCache = itens;
            if (typeof itensCache !== 'undefined') {
                itensCache = itens;
            }
            if (typeof table.redraw === 'function') {
                table.redraw(true);
            }
            if (window.triggerAutoSave) window.triggerAutoSave();

            let msg = '';
            if (itensAlterados > 0) {
                const detalhes = [];
                detalhes.push(`• Un. Trib.: ${alteradosTrib} alteração(ões)`);
                if (alterarUnCom) {
                    detalhes.push(`• Un. Com.: ${alteradosCom} alteração(ões)`);
                } else {
                    detalhes.push(`• Un. Com.: Mantido original (sem alteração)`);
                }
                msg = `✅ Sucesso! Unidades abreviadas em ${itensAlterados} item(ns) conforme o padrão oficial SEFAZ:\n\n${detalhes.join('\n')}`;
            } else {
                msg = `ℹ️ Todas as unidades verificadas já estão nos padrões abreviados oficiais! (Nenhuma alteração necessária).`;
            }

            if (window.nftAlert) {
                await window.nftAlert(msg, itensAlterados > 0 ? 'success' : 'info');
            } else {
                alert(msg);
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao abreviar unidades: ' + e.message);
        }
    };

})();