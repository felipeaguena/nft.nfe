/**
 * NFT Logistics - Gerenciador Avançado de Operações & Enquadramentos Fiscais
 * Módulo para reordenação Drag-and-Drop, busca/filtro e configuração dinâmica de Enquadramentos Fiscais.
 */

(function () {
    'use strict';

    // Cache local das configurações de enquadramentos fiscais
    let regimesConfigCache = null;
    let dragSrcElement = null;

    // Regimes padrões de fallback com suporte a campo de Apelido
    const REGIMES_FALLBACK = {
        SUSPENSAO: {
            codigo: 'SUSPENSAO',
            apelido: 'Suspensão de Impostos',
            nome: 'Suspensão de Impostos',
            icone: '🛡️',
            descricao: 'Admissão Temporária de mercadorias e Remessas/Retornos de Feiras e Exposições.',
            cfop_padrao: '3930',
            tp_nf: '0',
            id_dest: '3',
            csosn_icms: '400',
            c_enq_ipi: '160',
            cst_ipi: '55',
            p_ipi: 0.00,
            aliquota_ii: 0.00,
            cst_pis: '08',
            p_pis: 0.00,
            cst_cofins: '08',
            p_cofins: 0.00,
            t_pag: '90',
            inf_cpl_padrao: 'ADMISSAO TEMPORARIA DE CARGAS AO AMPARO DA IN RFB 1600/2016. SUSPENSAO DE TRIBUTOS FEDERAIS E ESTADUAIS (ICMS, IPI, PIS E COFINS). IPI SUSPENSO CONFORME ART. 43, INCISO I DO DECRETO 7.212/2010 (RIPI).'
        },
        ISENCAO: {
            codigo: 'ISENCAO',
            apelido: 'Isenção Fiscal',
            nome: 'Isenção Fiscal',
            icone: '🌱',
            descricao: 'Importação ou circulação de mercadorias com benefício de isenção legal de tributos.',
            cfop_padrao: '3949',
            tp_nf: '0',
            id_dest: '3',
            csosn_icms: '400',
            c_enq_ipi: '301',
            cst_ipi: '52',
            p_ipi: 0.00,
            aliquota_ii: 0.00,
            cst_pis: '07',
            p_pis: 0.00,
            cst_cofins: '07',
            p_cofins: 0.00,
            t_pag: '90',
            inf_cpl_padrao: 'ENTRADA DE IMPORTACAO COM BENEFICIO FISCAL DE ISENCAO DE TRIBUTOS FEDERAIS E ESTADUAIS CONFORME LEGISLACAO VIGENTE.'
        },
        RECOLHIMENTO: {
            codigo: 'RECOLHIMENTO',
            apelido: 'Recolhimento Integral',
            nome: 'Recolhimento Integral',
            icone: '💰',
            descricao: 'Operações tributadas regularmente com recolhimento integral (II, IPI, PIS, COFINS e ICMS).',
            cfop_padrao: '3949',
            tp_nf: '0',
            id_dest: '3',
            csosn_icms: '900',
            c_enq_ipi: '999',
            cst_ipi: '49',
            p_ipi: 0.00,
            aliquota_ii: 0.00,
            cst_pis: '01',
            p_pis: 1.65,
            cst_cofins: '01',
            p_cofins: 7.60,
            t_pag: '90',
            inf_cpl_padrao: 'ENTRADA DE IMPORTACAO COM TRIBUTACAO REGULAR E RECOLHIMENTO INTEGRAL DE TRIBUTOS (II, IPI, PIS, COFINS E ICMS).'
        },
        IMUNIDADE: {
            codigo: 'IMUNIDADE',
            apelido: 'Imunidade Tributária',
            nome: 'Imunidade Tributária',
            icone: '✈️',
            descricao: 'Reexportação de admissão temporária e exportações com imunidade tributária constitucional.',
            cfop_padrao: '7930',
            tp_nf: '1',
            id_dest: '3',
            csosn_icms: '400',
            c_enq_ipi: '002',
            cst_ipi: '54',
            p_ipi: 0.00,
            aliquota_ii: 0.00,
            cst_pis: '08',
            p_pis: 0.00,
            cst_cofins: '08',
            p_cofins: 0.00,
            t_pag: '90',
            inf_cpl_padrao: 'REEXPORTACAO DE MERCADORIA SOB REGIME ADUANEIRO ESPECIAL DE ADMISSAO TEMPORARIA. IMUNIDADE TRIBUTARIA CONSTITUCIONAL DE EXPORTACAO (ART. 153, PAR. 3, III DA CF/88).'
        }
    };

    // =========================================================================
    // 1. CARREGAMENTO E MANIPULAÇÃO DINÂMICA DE ENQUADRAMENTOS FISCAIS
    // =========================================================================

    async function carregarConfigRegimes(forcar = false) {
        if (regimesConfigCache && !forcar) {
            return regimesConfigCache;
        }
        try {
            const resp = await fetch('/api/config/regimes_tributarios');
            const data = await resp.json();
            if (data && data.status === 'success' && data.regimes && Object.keys(data.regimes).length > 0) {
                regimesConfigCache = data.regimes;
            } else {
                regimesConfigCache = Object.assign({}, REGIMES_FALLBACK);
            }
        } catch (e) {
            console.warn('Erro ao carregar configurações de enquadramentos fiscais:', e);
            regimesConfigCache = Object.assign({}, REGIMES_FALLBACK);
        }

        // Garante que todo enquadramento tenha apelido e código
        Object.keys(regimesConfigCache).forEach(k => {
            const c = regimesConfigCache[k];
            if (!c.codigo) c.codigo = k;
            if (!c.apelido) c.apelido = c.nome || k;
        });

        window.regimesConfigCache = regimesConfigCache;
        window.getRegimesConfigCache = function() { return regimesConfigCache || REGIMES_FALLBACK; };
        window.REGIMES_FALLBACK = REGIMES_FALLBACK;

        atualizarTodosSelectsEnquadramento(regimesConfigCache);
        return regimesConfigCache;
    }

    // Atualiza selects e listas de enquadramentos existentes no sistema (Aba 4, Aba 3 e Modal)
    function atualizarTodosSelectsEnquadramento(configs, valorSelecionado = null) {
        if (!configs) return;
        const chaves = Object.keys(configs);

        // 1. Select da Aba 4 (Formulário da Operação #op_regime)
        const selOpRegime = document.getElementById('op_regime');
        if (selOpRegime) {
            const valAtual = valorSelecionado || selOpRegime.value;
            selOpRegime.innerHTML = '';
            chaves.forEach(k => {
                const conf = configs[k];
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = `(${conf.cfop_padrao || '----'}) ${conf.apelido || conf.nome || k}`;
                selOpRegime.appendChild(opt);
            });
            if (valAtual && configs[valAtual]) {
                selOpRegime.value = valAtual;
            } else if (chaves.length > 0) {
                selOpRegime.value = chaves[0];
            }
            window.atualizarResumoRegimeForm(selOpRegime.value);
        }

        // 2. Lista Lateral do Modal de Configuração (#cfg_enquadramentos_lista)
        renderizarListaConfigRegimes(configs, valorSelecionado);

        const selCfgModal = document.getElementById('cfg_enquadramento_select');
        if (selCfgModal) {
            selCfgModal.value = valorSelecionado || chaves[0] || '';
        }

        // 3. Select do Modal da Aba 3 (#modal_itens_select_enq)
        const selItensModal = document.getElementById('modal_itens_select_enq');
        if (selItensModal) {
            const valAtual = valorSelecionado || selItensModal.value;
            selItensModal.innerHTML = '';
            chaves.forEach(k => {
                const conf = configs[k];
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = `(${conf.cfop_padrao || '----'}) ${conf.apelido || conf.nome || k}`;
                selItensModal.appendChild(opt);
            });
            if (valAtual && configs[valAtual]) {
                selItensModal.value = valAtual;
            } else if (chaves.length > 0) {
                selItensModal.value = chaves[0];
            }
        }

        // 4. Sincroniza a coluna "Enquadramento" na grade Tabulator dos itens
        if (typeof window.atualizarColunaEnquadramentoTabulator === 'function') {
            window.atualizarColunaEnquadramentoTabulator();
        }
    }

    // Sincroniza as opções da coluna "Enquadramento" no Tabulator (Aba 3)
    window.atualizarColunaEnquadramentoTabulator = function () {
        if (!window.itensTable) return;
        const configs = (typeof window.getRegimesConfigCache === 'function') ? window.getRegimesConfigCache() : (window.regimesConfigCache || {});
        const lista = [];
        Object.keys(configs).forEach(k => {
            const c = configs[k];
            const cfopTxt = c.cfop_padrao ? `(${c.cfop_padrao}) ` : '(----) ';
            lista.push({
                label: `${cfopTxt}${c.apelido || c.nome || k}`,
                value: k
            });
        });
        try {
            window.itensTable.updateColumnDefinition("enquadramento", {
                editor: "list",
                editorParams: { values: lista, autocomplete: true, listOnEmpty: true, freetext: false, clearable: false }
            });
            window.itensTable.redraw(true);
        } catch (e) {
            console.warn("Erro ao sincronizar coluna enquadramento no Tabulator:", e);
        }
    };

    // Renderiza a lista de enquadramentos no painel esquerdo do modal de configurações
    function renderizarListaConfigRegimes(configs, codigoAtivo = null) {
        const lista = document.getElementById('cfg_enquadramentos_lista');
        if (!lista) return;

        lista.innerHTML = '';
        const chaves = Object.keys(configs || {});
        chaves.forEach(k => {
            const conf = configs[k];
            const isThis = (k === codigoAtivo);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `list-group-item list-group-item-action py-2 px-2 border rounded mb-1 d-flex align-items-center justify-content-between text-start cfg-enq-item ${isThis ? 'active bg-primary text-white border-primary fw-bold' : ''}`;
            btn.setAttribute('data-codigo', k);
            btn.setAttribute('title', conf.apelido || conf.nome || k);
            btn.innerHTML = `
                <div class="d-flex align-items-center gap-2 text-truncate" style="min-width: 0;">
                    <span class="fw-bold font-monospace cfg-enq-cfop flex-shrink-0 ${isThis ? 'text-white' : 'text-primary'}">(${conf.cfop_padrao || '----'})</span>
                    <span class="text-truncate cfg-enq-txt">${conf.apelido || conf.nome || k}</span>
                </div>
            `;
            btn.onclick = function () {
                window.selecionarEnquadramentoParaEdicao(k);
            };
            lista.appendChild(btn);
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Aplica as regras do enquadramento selecionado aos campos do formulário da operação (Aba 4)
    window.aplicarPresetDoRegimeAoFormOperacao = async function () {
        const regimeEl = document.getElementById('op_regime');
        if (!regimeEl) return;
        const regimeKey = regimeEl.value || 'SUSPENSAO';

        const configs = await carregarConfigRegimes();
        const conf = configs[regimeKey] || REGIMES_FALLBACK[regimeKey];
        if (!conf) return;

        if (typeof setVal === 'function') {
            if (conf.cfop_padrao && !document.getElementById('op_cfop').value) setVal('op_cfop', conf.cfop_padrao);
            if (conf.tp_nf !== undefined) setVal('op_tp_nf', conf.tp_nf);
            if (conf.id_dest !== undefined) setVal('op_id_dest', conf.id_dest);
            if (conf.csosn_icms) setVal('op_csosn', conf.csosn_icms);
            if (conf.c_enq_ipi) setVal('op_c_enq', conf.c_enq_ipi);
            if (conf.cst_ipi) setVal('op_cst_ipi', conf.cst_ipi);
            // Alíquotas IPI, PIS e COFINS não são repassadas: mantém-se o valor que já está nos campos
            if (conf.cst_pis) setVal('op_cst_pis', conf.cst_pis);
            if (conf.cst_cofins) setVal('op_cst_cofins', conf.cst_cofins);
            if (conf.t_pag) setVal('op_t_pag', conf.t_pag);
            if (conf.inf_cpl_padrao && !document.getElementById('op_inf_cpl').value) {
                setVal('op_inf_cpl', conf.inf_cpl_padrao);
            }
        }

        window.atualizarResumoRegimeForm(regimeKey);

        if (window.nftToast) {
            window.nftToast(`Parâmetros do enquadramento "${conf.apelido || conf.nome}" aplicados à operação!`, { type: 'success' });
        }
    };

    // Atualiza o resumo visual logo abaixo do select de regime na operação (Aba 4)
    window.atualizarResumoRegimeForm = async function (regimeKey) {
        const resumoEl = document.getElementById('op_regime_info');
        if (!resumoEl) return;
        const configs = await carregarConfigRegimes();
        const conf = configs[regimeKey] || REGIMES_FALLBACK[regimeKey];
        if (!conf) {
            resumoEl.innerText = '';
            return;
        }

        const cfopTxt = conf.cfop_padrao ? `(${conf.cfop_padrao}) ` : '';
        const apelido = conf.apelido || conf.nome || regimeKey;
        let resumoTxt = `${cfopTxt}${apelido}: cEnq ${conf.c_enq_ipi || '-'} | CST IPI ${conf.cst_ipi || '-'} | CST PIS ${conf.cst_pis || '-'} | CST COFINS ${conf.cst_cofins || '-'} | Pagamento ${conf.t_pag || '90'}`;
        resumoEl.innerText = resumoTxt;
    };

    // =========================================================================
    // 2. MODAL DE CONFIGURAÇÃO DE ENQUADRAMENTOS FISCAIS (SELEÇÃO & NOVO)
    // =========================================================================

    function injetarModalConfigRegimesHTML() {
        if (document.getElementById('modal-config-regimes')) return;

        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.id = 'modal-config-regimes';
        modalDiv.tabIndex = -1;
        modalDiv.setAttribute('aria-hidden', 'true');
        modalDiv.setAttribute('data-bs-backdrop', 'static');
        modalDiv.style.zIndex = '1070';

        modalDiv.addEventListener('shown.bs.modal', function () {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            if (backdrops.length > 1) {
                backdrops[backdrops.length - 1].style.zIndex = '1065';
            }
        });
        modalDiv.addEventListener('hidden.bs.modal', function () {
            const modalItens = document.getElementById('modal-aplicar-enquadramento-itens');
            const modalTipoNota = document.getElementById('modalTipoNota');
            if ((modalItens && modalItens.classList.contains('show')) || (modalTipoNota && modalTipoNota.classList.contains('show'))) {
                document.body.classList.add('modal-open');
            }
        });

        modalDiv.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-dark text-white py-3">
                    <div class="d-flex align-items-center gap-2">
                        <i data-lucide="sliders" class="text-primary"></i>
                        <div>
                            <h5 class="modal-title fw-bold mb-0 text-white">Configurações dos Enquadramentos Fiscais</h5>
                            <small class="text-white-50" style="font-size: 11px;">
                                Crie e edite enquadramentos fiscais personalizados com apelidos para seleção e aplicação direta.
                            </small>
                        </div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-3 p-md-4">
                    <div class="row g-3">
                        <!-- Coluna Esquerda: Lista de Opções Existentes -->
                        <div class="col-lg-4 col-md-5">
                            <div class="card border shadow-sm h-100 d-flex flex-column" style="min-height: 480px;">
                                <div class="card-header py-2 px-3 bg-body-tertiary d-flex justify-content-between align-items-center">
                                    <div class="d-flex align-items-center gap-1">
                                        <i data-lucide="layers" style="width: 15px; height: 15px;" class="text-primary"></i>
                                        <span class="fw-bold small">Enquadramentos</span>
                                    </div>
                                    <div class="d-flex align-items-center gap-1">
                                        <button type="button" class="btn btn-sm btn-success d-inline-flex align-items-center justify-content-center p-1 px-2 shadow-sm" onclick="window.criarNovoEnquadramento()" title="Novo Enquadramento">
                                            <i data-lucide="plus" style="width: 15px; height: 15px;"></i>
                                        </button>
                                        <button type="button" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-1 px-2 shadow-sm" id="btn-excluir-enq" onclick="window.excluirEnquadramentoAtual()" title="Excluir Enquadramento">
                                            <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="card-body p-2 flex-grow-1" style="overflow-y: auto; max-height: 480px;">
                                    <div class="list-group list-group-flush" id="cfg_enquadramentos_lista">
                                        <!-- Preenchido dinamicamente via JS -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Coluna Direita: Formulário de Configuração -->
                        <div class="col-lg-8 col-md-7">
                            <div class="card border shadow-sm h-100 d-flex flex-column">
                                <div class="card-header py-2 px-3 bg-body-tertiary d-flex align-items-center gap-2">
                                    <span class="fw-bold font-monospace text-primary fs-6" id="cfg_header_cfop">(3930)</span>
                                    <h6 class="mb-0 fw-bold text-heading text-truncate" id="cfg_header_apelido">Suspensão de Impostos</h6>
                                </div>
                                <div class="card-body p-3 flex-grow-1" style="overflow-y: auto; max-height: 480px;">
                                    <input type="hidden" id="cfg_enq_codigo" value="">
                                    <input type="hidden" id="cfg_enquadramento_select" value="">
                                    <div class="row g-3">
                                        <!-- Campo para Apelido do Enquadramento -->
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold text-primary mb-1">
                                                <i data-lucide="bookmark" style="width: 13px; height: 13px;"></i>
                                                Apelido do Enquadramento *
                                            </label>
                                            <input type="text" class="form-control form-control-sm fw-bold border-primary" id="cfg_enq_apelido" placeholder="Ex: Suspensão Art. 43, Admissão Temporária, Isenção Feira..." required>
                                            <small class="text-muted" style="font-size: 11px;">Nome amigável exibido nas abas de Operação e Itens</small>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold mb-1">Descrição / Finalidade</label>
                                            <input type="text" class="form-control form-control-sm" id="cfg_enq_descricao" placeholder="Finalidade ou fundamentação resumida desta operação...">
                                            <small class="text-muted" style="font-size: 11px;">Ex: Amparo legal da IN RFB 1600/2016 ou Decreto 7.212/2010</small>
                                        </div>

                                        <!-- Parâmetros da NF -->
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">CFOP Sugerido</label>
                                            <input type="text" class="form-control form-control-sm font-monospace fw-bold" id="cfg_enq_cfop" placeholder="Ex: 3930, 3949, 7930">
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">Tipo da NF (tpNF)</label>
                                            <select class="form-select form-select-sm" id="cfg_enq_tp_nf">
                                                <option value="0">0 - Entrada</option>
                                                <option value="1">1 - Saída</option>
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">Destino (idDest)</label>
                                            <select class="form-select form-select-sm" id="cfg_enq_id_dest">
                                                <option value="1">1 - Interna</option>
                                                <option value="2">2 - Interestadual</option>
                                                <option value="3" selected>3 - Exterior</option>
                                            </select>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small fw-bold">Pagamento</label>
                                            <select class="form-select form-select-sm fw-bold" id="cfg_enq_t_pag">
                                                <option value="90">90 - Sem Pagamento (SEFAZ vPag=0)</option>
                                                <option value="99">99 - Outros (Câmbio / Exterior)</option>
                                                <option value="01">01 - Dinheiro</option>
                                                <option value="15">15 - Boleto Bancário</option>
                                                <option value="17">17 - PIX</option>
                                            </select>
                                        </div>

                                        <!-- Tributos Federais e Estaduais Padrão -->
                                        <div class="col-12"><h6 class="border-bottom pb-1 mb-1 mt-2 fw-bold text-heading">Tributos Federais e Estaduais Padrão</h6></div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">CSOSN / CST ICMS</label>
                                            <select class="form-select form-select-sm font-monospace" id="cfg_enq_csosn"></select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">IPI - cEnq</label>
                                            <select class="form-select form-select-sm font-monospace fw-bold" id="cfg_enq_c_enq"></select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small fw-bold">CST IPI</label>
                                            <select class="form-select form-select-sm font-monospace" id="cfg_enq_cst_ipi"></select>
                                        </div>

                                        <!-- PIS & COFINS -->
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold">CST PIS</label>
                                            <select class="form-select form-select-sm font-monospace" id="cfg_enq_cst_pis"></select>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label small fw-bold">CST COFINS</label>
                                            <select class="form-select form-select-sm font-monospace" id="cfg_enq_cst_cofins"></select>
                                        </div>

                                        <!-- Fundamentação Legal infCpl -->
                                        <div class="col-12">
                                            <label class="form-label small fw-bold">Texto Padrão de Fundamentação Legal (infCpl sugerido no rodapé)</label>
                                            <textarea class="form-control form-control-sm" id="cfg_enq_inf_cpl" rows="2" placeholder="Fundamentação legal sugerida para esta nota..."></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer d-flex justify-content-between py-2 bg-body-tertiary">
                    <button type="button" class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" onclick="restaurarConfigRegimesPadrao()">
                        <i data-lucide="rotate-ccw"></i>
                        <span>Restaurar Padrões Fiscais</span>
                    </button>
                    <div class="d-flex align-items-center gap-2">
                        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Fechar</button>
                        <button type="button" class="btn btn-primary btn-sm fw-bold d-flex align-items-center gap-1 shadow-sm" onclick="salvarConfigRegimesTributarios()">
                            <i data-lucide="save"></i>
                            <span>Salvar Enquadramento</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.appendChild(modalDiv);

        // Preenche as opções oficiais dos dropdowns de tributos federais e estaduais
        popularOpcoesTributosModalConfig(modalDiv);

        // Listeners para sincronizar título do cabeçalho e item da lista em tempo real
        const apelidoInput = modalDiv.querySelector('#cfg_enq_apelido');
        if (apelidoInput) {
            apelidoInput.addEventListener('input', function () {
                const val = this.value.trim();
                const hApelido = document.getElementById('cfg_header_apelido');
                if (hApelido) hApelido.innerText = val || 'Novo Enquadramento';
                const ativoTxt = document.querySelector('#cfg_enquadramentos_lista .cfg-enq-item.active .cfg-enq-txt');
                if (ativoTxt) ativoTxt.innerText = val || 'Novo Enquadramento';
            });
        }
        const cfopInput = modalDiv.querySelector('#cfg_enq_cfop');
        if (cfopInput) {
            cfopInput.addEventListener('input', function () {
                const val = this.value.trim();
                const hCfop = document.getElementById('cfg_header_cfop');
                if (hCfop) hCfop.innerText = `(${val || '----'})`;
                const ativoCfop = document.querySelector('#cfg_enquadramentos_lista .cfg-enq-item.active .cfg-enq-cfop');
                if (ativoCfop) ativoCfop.innerText = `(${val || '----'})`;
            });
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Helper para definir valor em <select> ou adicionar <option> dinâmica caso o valor não exista
    function setSelectValueOrAdd(selectEl, val) {
        if (!selectEl) return;
        const sVal = (val !== null && val !== undefined) ? String(val).trim() : '';
        if (!sVal) {
            selectEl.value = '';
            return;
        }
        let found = false;
        for (let i = 0; i < selectEl.options.length; i++) {
            if (selectEl.options[i].value === sVal) {
                selectEl.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            const opt = new Option(`${sVal} (Personalizado)`, sVal);
            selectEl.appendChild(opt);
            selectEl.value = sVal;
        }
    }

    // Popula os 5 dropdowns de tributos com as opções oficiais da emissão de NF-e
    const CENQ_IPI_OFICIAIS = [
        { codigo: "001", grupo: "Imunidade", resumo: "Livros jornais e periódicos", descricao: "Livros, jornais, periódicos e o papel destinado à sua impressão – Art. 18 Inciso I do Decreto 7.212/2010", csts: "CST 04 (Entrada imune) e 54 (Saída imune) – códigos de 001 a 099" },
        { codigo: "002", grupo: "Imunidade", resumo: "Produtos destinados ao exterior", descricao: "Produtos industrializados destinados ao exterior – Art. 18 Inciso II do Decreto 7.212/2010", csts: "CST 04 (Entrada imune) e 54 (Saída imune) – códigos de 001 a 099" },
        { codigo: "003", grupo: "Imunidade", resumo: "Ouro como ativo financeiro", descricao: "Ouro, definido em lei como ativo financeiro ou instrumento cambial – Art. 18 Inciso III do Decreto 7.212/2010", csts: "CST 04 (Entrada imune) e 54 (Saída imune) – códigos de 001 a 099" },
        { codigo: "004", grupo: "Imunidade", resumo: "Energia elétrica e combustíveis", descricao: "Energia elétrica, derivados de petróleo, combustíveis e minerais do País – Art. 18 Inciso IV do Decreto 7.212/2010", csts: "CST 04 (Entrada imune) e 54 (Saída imune) – códigos de 001 a 099" },
        { codigo: "005", grupo: "Imunidade", resumo: "Exportação petróleo e gás", descricao: "Exportação de produtos nacionais – sem saída do território brasileiro – venda para empresa sediada no exterior – atividades de pesquisa ou lavra de jazidas de petróleo e de gás natural – Art. 19 Inciso I do Decreto 7.212/2010", csts: "CST 04 (Entrada imune) e 54 (Saída imune) – códigos de 001 a 099" },
        { codigo: "006", grupo: "Imunidade", resumo: "Exportação produto final Brasil", descricao: "Exportação de produtos nacionais – sem saída do território brasileiro – venda para empresa sediada no exterior – incorporados a produto final exportado para o Brasil – Art. 19 Inciso II do Decreto 7.212/2010", csts: "CST 04 (Entrada imune) e 54 (Saída imune) – códigos de 001 a 099" },
        { codigo: "007", grupo: "Imunidade", resumo: "Exportação organismo internacional", descricao: "Exportação de produtos nacionais – sem saída do território brasileiro – venda para órgão ou entidade de governo estrangeiro ou organismo internacional de que o Brasil seja membro, para ser entregue, no País, à ordem do comprador – Art. 19 Inciso III do Decreto 7.212/2010", csts: "CST 04 (Entrada imune) e 54 (Saída imune) – códigos de 001 a 099" },
        { codigo: "101", grupo: "Suspensão", resumo: "Óleo de menta bruto", descricao: "Óleo de menta em bruto, produzido por lavradores – Art. 43 Inciso I do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "102", grupo: "Suspensão", resumo: "Feiras e exposições", descricao: "Produtos remetidos à exposição em feiras de amostras e promoções semelhantes – Art. 43 Inciso II do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "103", grupo: "Suspensão", resumo: "Depósitos fechados e armazéns", descricao: "Produtos remetidos a depósitos fechados ou armazéns-gerais, bem assim aqueles devolvidos ao remetente – Art. 43 Inciso III do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "104", grupo: "Suspensão", resumo: "Drawback empresa exportadora", descricao: "Produtos industrializados, que com matérias-primas (MP), produtos intermediários (PI) e material de embalagem (ME) importados submetidos a regime aduaneiro especial (drawback – suspensão/isenção), remetidos diretamente a empresas industriais exportadoras – Art. 43 Inciso IV do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "105", grupo: "Suspensão", resumo: "Remessa empresa comercial exportadora", descricao: "Produtos, destinados à exportação, que saiam do estabelecimento industrial para empresas comerciais exportadoras, com o fim específico de exportação – Art. 43, Inciso V, alínea “a” do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "106", grupo: "Suspensão", resumo: "Remessa recinto alfandegado exportação", descricao: "Produtos, destinados à exportação, que saiam do estabelecimento industrial para recintos alfandegados onde se processe o despacho aduaneiro de exportação – Art. 43, Inciso V, alíneas “b” do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "107", grupo: "Suspensão", resumo: "Remessa outros locais exportação", descricao: "Produtos, destinados à exportação, que saiam do estabelecimento industrial para outros locais onde se processe o despacho aduaneiro de exportação – Art. 43, Inciso V, alíneas “c” do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "108", grupo: "Suspensão", resumo: "Insumos para industrialização encomenda", descricao: "Matérias-primas (MP), produtos intermediários (PI) e material de embalagem (ME) destinados ao executor de industrialização por encomenda – Art. 43 Inciso VI do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "109", grupo: "Suspensão", resumo: "Retorno industrialização por encomenda", descricao: "Produtos industrializados por encomenda remetidos ao estabelecimento de origem – Art. 43 Inciso VII do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "110", grupo: "Suspensão", resumo: "Insumos fora do estabelecimento", descricao: "Matérias-primas ou produtos intermediários remetidos para emprego em operação industrial realizada pelo remetente fora do estabelecimento – Art. 43 Inciso VIII do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "111", grupo: "Suspensão", resumo: "Provas de engenharia fabricante", descricao: "Veículo, aeronave ou embarcação destinados a emprego em provas de engenharia pelo fabricante – Art. 43 Inciso IX do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "112", grupo: "Suspensão", resumo: "Transferência entre estabelecimentos", descricao: "Produtos remetidos, para industrialização ou comércio, de um para outro estabelecimento da mesma firma – Art. 43 Inciso X do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "113", grupo: "Suspensão", resumo: "Ativo permanente processo industrial", descricao: "Bens do ativo permanente remetidos a outro estabelecimento da mesma firma, para serem utilizados no processo industrial do recebedor – Art. 43 Inciso XI do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "114", grupo: "Suspensão", resumo: "Ativo permanente encomenda remetente", descricao: "Bens do ativo permanente remetidos a outro estabelecimento, para serem utilizados no processo industrial de produtos encomendados pelo remetente – Art. 43 Inciso XII do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "115", grupo: "Suspensão", resumo: "Peças para reparo garantia", descricao: "Partes e peças destinadas ao reparo de produtos com defeito de fabricação, quando a operação for executada gratuitamente, em virtude de garantia – Art. 43 Inciso XIII do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "116", grupo: "Suspensão", resumo: "Insumos produtos para exportação", descricao: "Matérias-primas (MP), produtos intermediários (PI) e material de embalagem (ME) de fabricação nacional, vendidos a estabelecimento industrial, para industrialização de produtos destinados à exportação ou a estabelecimento comercial, para industrialização em outro estabelecimento da mesma firma ou de terceiro, de produto destinado à exportação – Art. 43 Inciso XIV do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "117", grupo: "Suspensão", resumo: "Insumos elaboração produto exportado", descricao: "Produtos para emprego ou consumo na industrialização ou elaboração de produto a ser exportado, adquiridos no mercado interno ou importados – Art. 43 Inciso XV do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "118", grupo: "Suspensão", resumo: "Bebidas alcoólicas a granel", descricao: "Bebidas alcoólicas e demais produtos de produção nacional acondicionados em recipientes de capacidade superior ao limite máximo permitido para venda a varejo – Art. 44 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "119", grupo: "Suspensão", resumo: "Bebidas outros estabelecimentos", descricao: "Produtos classificados NCM 21.06.90.10 Ex 02, 22.01, 22.02, exceto os Ex 01 e Ex 02 do Código 22.02.90.00 e 22.03 saídos de estabelecimento industrial destinado a comercial equiparado a industrial – Art. 45 Inciso I do Decreto7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "120", grupo: "Suspensão", resumo: "Bebidas saída varejista atacadista", descricao: "Produtos classificados NCM 21.06.90.10 Ex 02, 22.01, 22.02, exceto os Ex 01 e Ex 02 do Código 22.02.90.00 e 22.03 saídos de estabelecimento comercial equiparado a industrial destinado a equiparado a industrial – Art. 45 Inciso II do Decreto7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "121", grupo: "Suspensão", resumo: "Bebidas insumos para industrialização", descricao: "Produtos classificados NCM 21.06.90.10 Ex 02, 22.01, 22.02, exceto os Ex 01 e Ex 02 do Código 22.02.90.00 e 22.03 saídos de importador destinado a equiparado a industrial – Art. 45 Inciso III do Decreto7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "122", grupo: "Suspensão", resumo: "Insumos bens de capital", descricao: "Matérias-primas (MP), produtos intermediários (PI) e material de embalagem (ME) destinados a estabelecimento que se dedique à elaboração de produtos classificados nos códigos previstos no art. 25 da Lei 10.684/2003 – Art. 46 Inciso I do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "123", grupo: "Suspensão", resumo: "Insumos linha branca", descricao: "Matérias-primas (MP), produtos intermediários (PI) e material de embalagem (ME) adquiridos por estabelecimentos industriais fabricantes de partes e peças destinadas a estabelecimento industrial fabricante de produto classificado no Capítulo 88 da Tipi – Art. 46 Inciso II do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "124", grupo: "Suspensão", resumo: "Insumos móveis e painéis", descricao: "Matérias-primas (MP), produtos intermediários (PI) e material de embalagem (ME) adquiridos por pessoas jurídicas preponderantemente exportadoras – Art. 46 Inciso III do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "125", grupo: "Suspensão", resumo: "Materiais para embarcações registradas", descricao: "Materiais e equipamentos destinados a embarcações pré-registradas ou registradas no Registro Especial Brasileira – REB quando adquiridos por estaleiros navais brasileiros – Art. 46 Inciso IV do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "126", grupo: "Suspensão", resumo: "Regime aduaneiro suspensivo tributos", descricao: "Aquisição por beneficiário de regime aduaneiro suspensivo do imposto, destinado a industrialização para exportação – Art. 47 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "127", grupo: "Suspensão", resumo: "Importação para lojas francas", descricao: "Desembaraço de produtos de procedência estrangeira importados por lojas francas – Art. 48 Inciso I do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "128", grupo: "Suspensão", resumo: "Desembaraço bens de capital", descricao: "Desembaraço de maquinas, equipamentos, veículos, aparelhos e instrumentos sem similar nacional importados por empresas nacionais de engenharia, destinados à execução de obras no exterior – Art. 48 Inciso II do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "129", grupo: "Suspensão", resumo: "Desembaraço saída repartição aduaneira", descricao: "Desembaraço de produtos de procedência estrangeira com saída de repartições aduaneiras com suspensão do Imposto de Importação – Art. 48 Inciso III do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "130", grupo: "Suspensão", resumo: "Desembaraço insumos para exportação", descricao: "Desembaraço de matérias-primas, produtos intermediários e materiais de embalagem, importados diretamente por estabelecimento de que tratam os incisos I a III do caput do Decreto 7.212/2010 – Art. 48 Inciso IV do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "131", grupo: "Suspensão", resumo: "Remessa ZFM consumo interno", descricao: "Remessa de produtos para a ZFM destinados ao seu consumo interno, utilização ou industrialização – Art. 84 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "132", grupo: "Suspensão", resumo: "Remessa ZFM para exportação", descricao: "Remessa de produtos para a ZFM destinados à exportação – Art. 85 Inciso I do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "133", grupo: "Suspensão", resumo: "Remessa entrepostos da ZFM", descricao: "Produtos que, antes de sua remessa à ZFM, forem enviados pelo seu fabricante a outro estabelecimento, para industrialização adicional, por conta e ordem do destinatário – Art. 85 Inciso II do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "134", grupo: "Suspensão", resumo: "Desembaraço importação pela ZFM", descricao: "Desembaraço de produtos de procedência estrangeira importados pela ZFM quando ali consumidos ou utilizados, exceto armas, munições, fumo, bebidas alcoólicas e automóveis de passageiros. – Art. 86 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "135", grupo: "Suspensão", resumo: "Remessa para Amazônia Ocidental", descricao: "Remessa de produtos para a Amazônia Ocidental destinados ao seu consumo interno ou utilização – Art. 96 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "136", grupo: "Suspensão", resumo: "Livre Comércio de Tabatinga", descricao: "Entrada de produtos estrangeiros na Área de Livre Comércio de Tabatinga – ALCT destinados ao seu consumo interno ou utilização – Art. 106 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "137", grupo: "Suspensão", resumo: "Livre Comércio Guajará-Mirim", descricao: "Entrada de produtos estrangeiros na Área de Livre Comércio de Guajará-Mirim – ALCGM destinados ao seu consumo interno ou utilização – Art. 109 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "138", grupo: "Suspensão", resumo: "Livre Comércio Boa Vista", descricao: "Entrada de produtos estrangeiros nas Áreas de Livre Comércio de Boa Vista – ALCBV e Bomfim – ALCB destinados a seu consumo interno ou utilização – Art. 112 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "139", grupo: "Suspensão", resumo: "Livre Comércio Macapá Santana", descricao: "Entrada de produtos estrangeiros na Área de Livre Comércio de Macapá e Santana – ALCMS destinados a seu consumo interno ou utilização – Art. 116 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "140", grupo: "Suspensão", resumo: "Livre Comércio Brasiléia Cruzeiro", descricao: "Entrada de produtos estrangeiros nas Áreas de Livre Comércio de Brasiléia – ALCB e de Cruzeiro do Sul – ALCCS destinados a seu consumo interno ou utilização – Art. 119 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "141", grupo: "Suspensão", resumo: "Remessa para ZPE", descricao: "Remessa para Zona de Processamento de Exportação – ZPE – Art. 121 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "142", grupo: "Suspensão", resumo: "Automotivo regime aduaneiro especial", descricao: "Setor Automotivo – Desembaraço aduaneiro, chassis e outros – regime aduaneiro especial industrialização 87.01 a 87.05 – Art. 136, I do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "143", grupo: "Suspensão", resumo: "Automotivo industrialização por encomenda", descricao: "Setor Automotivo – Do estabelecimento industrial produtos 87.01 a 87.05 da TIPI – mercado interno – empresa comercial atacadista controlada por PJ encomendante do exterior. – Art. 136, II do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "144", grupo: "Suspensão", resumo: "Automotivo insumos de terceiros", descricao: "Setor Automotivo – Do estabelecimento industrial – chassis e outros classificados nas posições 84.29, 84.32, 84.33, 87.01 a 87.06 e 87.11 da TIPI. – Art. 136, III do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "145", grupo: "Suspensão", resumo: "Automotivo faturamento direto montadora", descricao: "Setor Automotivo – Desembaraço aduaneiro, chassis e outros classificados nas posições 84.29, 84.32, 84.33, 87.01 a 87.06 e 87.11 da TIPI quando importados diretamente por estabelecimento industrial – Art. 136, IV do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "146", grupo: "Suspensão", resumo: "Automotivo tratores e colheitadeiras", descricao: "Setor Automotivo – do estabelecimento industrial matérias-primas, os produtos intermediários e os materiais de embalagem, adquiridos por fabricantes, preponderantemente, de componentes, chassis e outros classificados nos Códigos 84.29, 8432.40.00, 8432.80.00, 8433.20, 8433.30.00, 8433.40.00, 8433.5 e 87.01 a 87.06 da TIPI – Art. 136, V do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "147", grupo: "Suspensão", resumo: "REIDI infraestrutura e transportes", descricao: "Setor Automotivo – Desembaraço aduaneiro, as matérias-primas, os produtos intermediários e os materiais de embalagem, importados diretamente por fabricantes, preponderantemente, de componentes, chassis e outros classificados nos Códigos 84.29, 8432.40.00, 8432.80.00, 8433.20, 8433.30.00, 8433.40.00, 8433.5 e 87.01 a 87.06 da TIPI – Art. 136, VI do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "148", grupo: "Suspensão", resumo: "REPENEC petróleo e petroquímica", descricao: "Bens de Informática e Automação – matérias-primas, os produtos intermediários e os materiais de embalagem, quando adquiridos por estabelecimentos industriais fabricantes dos referidos bens. – Art. 148 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "149", grupo: "Suspensão", resumo: "RETAERO indústria aeroespacial", descricao: "Reporto – Saída de Estabelecimento de máquinas e outros quando adquiridos por beneficiários do REPORTO – Art. 166, I do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "150", grupo: "Suspensão", resumo: "RECOPI papel para imprensa", descricao: "Reporto – Desembaraço aduaneiro de máquinas e outros quando adquiridos por beneficiários do REPORTO – Art. 166, II do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "151", grupo: "Suspensão", resumo: "RECINE indústria cinematográfica", descricao: "Repes – Desembaraço aduaneiro – bens sem similar nacional importados por beneficiários do REPES – Art. 171 do Decreto 7.212/2010", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "152", grupo: "Suspensão", resumo: "REICOMP redes de computadores", descricao: "Recine – Saída para beneficiário do regime – Art. 14, III da Lei 12.599/2012", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "153", grupo: "Suspensão", resumo: "REIF indústria ferroviária nacional", descricao: "Recine – Desembaraço aduaneiro por beneficiário do regime – Art. 14, IV da Lei 12.599/2012", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "154", grupo: "Suspensão", resumo: "RETID tecnologia de defesa", descricao: "Reif – Saída para beneficiário do regime – Lei 12.794/1013, art. 8, III", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "155", grupo: "Suspensão", resumo: "Desperdícios e sucatas industriais", descricao: "Reif – Desembaraço aduaneiro por beneficiário do regime – Lei 12.794/1013, art. 8, IV", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "156", grupo: "Suspensão", resumo: "Embalagens e recipientes bebidas", descricao: "Repnbl-Redes – Saída para beneficiário do regime – Lei nº 12.715/2012, art. 30, II", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "157", grupo: "Suspensão", resumo: "Cosméticos e higiene pessoal", descricao: "Recompe – Saída de matérias-primas e produtos intermediários para beneficiários do regime – Decreto nº 7.243/2010, art. 5º, I", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "158", grupo: "Suspensão", resumo: "Embarcações e materiais navais", descricao: "Recompe – Saída de matérias-primas e produtos intermediários destinados a industrialização de equipamentos – Programa Estímulo Universidade-Empresa – Apoio à Inovação – Decreto nº 7.243/2010, art. 5º, III", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "159", grupo: "Suspensão", resumo: "Drawback suspensão integrado", descricao: "Rio 2016 – Produtos nacionais, duráveis, uso e consumo dos eventos, adquiridos pelas pessoas jurídicas mencionadas no § 2o do art. 4o da Lei nº 12.780/2013 – Lei nº 12.780/2013, Art. 13", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "160", grupo: "Suspensão", resumo: "Admissão Temporária IN 1361", descricao: "Regime Especial de Admissão Temporária nos Termos do Art. 2o da IN 1361/2013", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "161", grupo: "Suspensão", resumo: "Entreposto aduaneiro na importação", descricao: "Regime Especial de Admissão Temporária nos termos do art. 5o da IN 1361/2013", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "162", grupo: "Suspensão", resumo: "Entreposto industrial RECOF", descricao: "Regime Especial de Admissão Temporária nos termos do art. 7o da IN 1361/2013 (Suspensão com pagamento de tributos diferidos até a duração do regime, limitado a 100% do valor original)", csts: "CST 05 (Entrada com suspensão) e 55 (Saída com suspensão) – códigos de 101 a 199" },
        { codigo: "301", grupo: "Isenção", resumo: "Amostras grátis diminuto valor", descricao: "Produtos industrializados por instituições de educação ou de assistência social, destinados a uso próprio ou a distribuição gratuita a seus educandos ou assistidos – Art. 54 Inciso I do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "302", grupo: "Isenção", resumo: "Mala direta e propaganda", descricao: "Produtos industrializados por estabelecimentos públicos e autárquicos da União, dos Estados, do Distrito Federal e dos Municípios, não destinados a comércio – Art. 54 Inciso II do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "303", grupo: "Isenção", resumo: "Prospectos e cartazes turísticos", descricao: "Amostras de produtos para distribuição gratuita, de diminuto ou nenhum valor comercial – Art. 54 Inciso III do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "304", grupo: "Isenção", resumo: "Caixas e embalagens usadas", descricao: "Amostras de tecidos sem valor comercial – Art. 54 Inciso IV do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "305", grupo: "Isenção", resumo: "Peças para embarcações aeronaves", descricao: "Pés isolados de calçados – Art. 54 Inciso V do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "306", grupo: "Isenção", resumo: "Material bélico Forças Armadas", descricao: "Aeronaves de uso militar e suas partes e peças, vendidas à União – Art. 54 Inciso VI do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "307", grupo: "Isenção", resumo: "Produtos agrícolas artesanais próprios", descricao: "Caixões funerários – Art. 54 Inciso VII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "308", grupo: "Isenção", resumo: "Roupas e calçados tropeiro", descricao: "Papel destinado à impressão de músicas – Art. 54 Inciso VIII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "309", grupo: "Isenção", resumo: "Artefatos domésticos fabricação caseira", descricao: "Panelas e outros artefatos semelhantes, de uso doméstico, de fabricação rústica, de pedra ou barro bruto – Art. 54 Inciso IX do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "310", grupo: "Isenção", resumo: "Chapéus e roupas tropeiro", descricao: "Chapéus, roupas e proteção, de couro, próprios para tropeiros – Art. 54 Inciso X do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "311", grupo: "Isenção", resumo: "Material bélico vendido União", descricao: "Material bélico, de uso privativo das Forças Armadas, vendido à União – Art. 54 Inciso XI do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "312", grupo: "Isenção", resumo: "Automóveis missões diplomáticas estrangeiras", descricao: "Automóvel adquirido diretamente a fabricante nacional, pelas missões diplomáticas e repartições consulares de caráter permanente, ou seus integrantes, bem assim pelas representações internacionais ou regionais de que o Brasil seja membro, e seus funcionários, peritos, técnicos e consultores, de nacionalidade estrangeira, que exerçam funções de caráter permanente – Art. 54 Inciso XII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "313", grupo: "Isenção", resumo: "Veículos diplomatas e consulados", descricao: "Veículo de fabricação nacional adquirido por funcionário das missões diplomáticas acreditadas junto ao Governo Brasileiro – Art. 54 Inciso XIII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "314", grupo: "Isenção", resumo: "Venda direta lojas francas", descricao: "Produtos nacionais saídos diretamente para Lojas Francas – Art. 54 Inciso XIV do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "315", grupo: "Isenção", resumo: "Equipamentos Itaipu Binacional", descricao: "Materiais e equipamentos destinados a Itaipu Binacional – Art. 54 Inciso XV do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "316", grupo: "Isenção", resumo: "Importação corpo diplomático consular", descricao: "Produtos Importados por missões diplomáticas, consulados ou organismo internacional – Art. 54 Inciso XVI do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "317", grupo: "Isenção", resumo: "Bagagem passageiros isenção II", descricao: "Bagagem de passageiros desembaraçada com isenção do II. – Art. 54 Inciso XVII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "318", grupo: "Isenção", resumo: "Bagagem passageiros tributada II", descricao: "Bagagem de passageiros desembaraçada com pagamento do II. – Art. 54 Inciso XVIII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "319", grupo: "Isenção", resumo: "Remessas postais internacionais simplificadas", descricao: "Remessas postais internacionais sujeitas a tributação simplificada. – Art. 54 Inciso XIX do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "320", grupo: "Isenção", resumo: "Máquinas pesquisa científica tecnológica", descricao: "Máquinas e outros destinados à pesquisa científica e tecnológica – Art. 54 Inciso XX do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "321", grupo: "Isenção", resumo: "Produtos estrangeiros isenção II", descricao: "Produtos de procedência estrangeira, isentos do II conforme Lei nº 8032/1990. – Art. 54 Inciso XXI do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "322", grupo: "Isenção", resumo: "Bens eventos esportivos internacionais", descricao: "Produtos de procedência estrangeira utilizados em eventos esportivos – Art. 54 Inciso XXII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "323", grupo: "Isenção", resumo: "Máquinas e veículos especiais", descricao: "Veículos automotores, máquinas, equipamentos, bem assim suas partes e peças separadas, destinadas à utilização nas atividades dos Corpos de Bombeiros – Art. 54 Inciso XXIII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "324", grupo: "Isenção", resumo: "Consumo feiras congressos internacionais", descricao: "Produtos importados para consumo em congressos, feiras e exposições – Art. 54 Inciso XXIV do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "325", grupo: "Isenção", resumo: "Bens de informática insumos", descricao: "Bens de informática, Matéria Prima, produtos intermediários e embalagem destinados a Urnas eletrônicas – TSE – Art. 54 Inciso XXV do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "326", grupo: "Isenção", resumo: "Aparelhos e equipamentos hospitalares", descricao: "Materiais, equipamentos, máquinas, aparelhos e instrumentos, bem assim os respectivos acessórios, sobressalentes e ferramentas, que os acompanhem, destinados à construção do Gasoduto Brasil – Bolívia – Art. 54 Inciso XXVI do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "327", grupo: "Isenção", resumo: "Peças para estaleiros navais", descricao: "Partes, peças e componentes, adquiridos por estaleiros navais brasileiros, destinados ao emprego na conservação, modernização, conversão ou reparo de embarcações registradas no Registro Especial Brasileiro – REB – Art. 54 Inciso XXVII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "328", grupo: "Isenção", resumo: "Transmissores receptores de rádio", descricao: "Aparelhos transmissores e receptores de radiotelefonia e radiotelegrafia; veículos para patrulhamento policial; armas e munições, destinados a órgãos de segurança pública da União, dos Estados e do Distrito Federal – Art. 54 Inciso XXVIII do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "329", grupo: "Isenção", resumo: "Automóveis para uso táxi", descricao: "Automóveis de passageiros de fabricação nacional destinados à utilização como táxi adquiridos por motoristas profissionais – Art. 55 Inciso I do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "330", grupo: "Isenção", resumo: "Automóveis cooperativas de táxi", descricao: "Automóveis de passageiros de fabricação nacional destinados à utilização como táxi por impedidos de exercer atividade por destruição, furto ou roubo do veículo adquiridos por motoristas profissionais. – Art. 55 Inciso II do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "331", grupo: "Isenção", resumo: "Automóveis para transporte escolar", descricao: "Automóveis de passageiros de fabricação nacional destinados à utilização como táxi adquiridos por cooperativas de trabalho. – Art. 55 Inciso II do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "332", grupo: "Isenção", resumo: "Automóveis pessoas com deficiência", descricao: "Automóveis de passageiros de fabricação nacional, destinados a pessoas portadoras de deficiência física, visual, mental severa ou profunda, ou autistas – Art. 55 Inciso IV do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "333", grupo: "Isenção", resumo: "Doações representações diplomáticas leilão", descricao: "Produtos estrangeiros, recebidos em doação de representações diplomáticas estrangeiras sediadas no País, vendidos em feiras, bazares e eventos semelhantes por entidades beneficentes – Art. 67 do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "334", grupo: "Isenção", resumo: "Produtos fabricados na ZFM", descricao: "Produtos industrializados na Zona Franca de Manaus – ZFM, destinados ao seu consumo interno – Art. 81 Inciso I do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "335", grupo: "Isenção", resumo: "ZFM projetos aprovados SUFRAMA", descricao: "Produtos industrializados na ZFM, por estabelecimentos com projetos aprovados pela SUFRAMA, destinados a comercialização em qualquer outro ponto do Território Nacional Art. 81 Inciso II do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "336", grupo: "Isenção", resumo: "Nacionais entrada na ZFM", descricao: "Produtos nacionais destinados à entrada na ZFM, para seu consumo interno, utilização ou industrialização, ou ainda, para serem remetidos, por intermédio de seus entrepostos, à Amazônia Ocidental – Art. 81 Inciso III do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "337", grupo: "Isenção", resumo: "Amazônia Ocidental projetos aprovados", descricao: "Produtos industrializados por estabelecimentos com projetos aprovados pela SUFRAMA, consumidos ou utilizados na Amazônia Ocidental, ou adquiridos através da ZFM ou de seus entrepostos na referida região – Art. 95 Inciso I do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "338", grupo: "Isenção", resumo: "Produtos estrangeiros saída ZFM", descricao: "Produtos de procedência estrangeira, relacionados na legislação, oriundos da ZFM e que derem entrada na Amazônia Ocidental para ali serem consumidos ou utilizados: – Art. 95 Inciso II do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "339", grupo: "Isenção", resumo: "Matérias-primas agrícolas regionais ZFM", descricao: "Produtos elaborados com matérias-primas agrícolas e extrativas vegetais de produção regional, por estabelecimentos industriais localizados na Amazônia Ocidental, com projetos aprovados pela SUFRAMA – Art. 95 Inciso III do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "340", grupo: "Isenção", resumo: "Industrializados Área Livre Comércio", descricao: "Produtos industrializados em Área de Livre Comércio – Art. 105 do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "341", grupo: "Isenção", resumo: "Entrada Área Livre Tabatinga", descricao: "Produtos nacionais ou nacionalizados, destinados à entrada na Área de Livre Comércio de Tabatinga – ALCT – Art. 107 do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "342", grupo: "Isenção", resumo: "Entrada Área Livre Guajará-Mirim", descricao: "Produtos nacionais ou nacionalizados, destinados à entrada na Área de Livre Comércio de Guajará-Mirim – ALCGM – Art. 110 do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "343", grupo: "Isenção", resumo: "Entrada Área Livre Boa Vista", descricao: "Produtos nacionais ou nacionalizados, destinados à entrada nas Áreas de Livre Comércio de Boa Vista – ALCBV e Bonfim – ALCB – Art. 113 do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "344", grupo: "Isenção", resumo: "Entrada Área Livre Macapá", descricao: "Produtos nacionais ou nacionalizados, destinados à entrada na Área de Livre Comércio de Macapá e Santana – ALCMS – Art. 117 do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "345", grupo: "Isenção", resumo: "Entrada Área Livre Brasiléia", descricao: "Produtos nacionais ou nacionalizados, destinados à entrada nas Áreas de Livre Comércio de Brasiléia – ALCB e de Cruzeiro do Sul – ALCCS – Art. 120 do Decreto 7.212/2010", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "346", grupo: "Isenção", resumo: "RECOMPE equipamentos informática escolas", descricao: "Recompe – equipamentos de informática – de beneficiário do regime para escolas das redes públicas de ensino federal, estadual, distrital, municipal ou nas escolas sem fins lucrativos de atendimento a pessoas com deficiência – Decreto nº 7.243/2010, art. 7º", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "347", grupo: "Isenção", resumo: "Rio 2016 materiais jogos", descricao: "Rio 2016 – Importação de materiais para os jogos (medalhas, troféus, impressos, bens não duráveis, etc.) – Lei nº 12.780/2013, Art. 4º, §1º, I", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "348", grupo: "Isenção", resumo: "Rio 2016 conversão suspensão", descricao: "Rio 2016 – Suspensão convertida em Isenção – Lei nº 12.780/2013, Art. 6º, I", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "349", grupo: "Isenção", resumo: "Rio 2016 empresas vinculadas", descricao: "Rio 2016 – Empresas vinculadas ao CIO – Lei nº 12.780/2013, Art. 9º, I, d", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "350", grupo: "Isenção", resumo: "Rio 2016 produtos importados", descricao: "Rio 2016 – Saída de produtos importados pelo RIO 2016 – Lei nº 12.780/2013, Art. 10, I, d", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "351", grupo: "Isenção", resumo: "Rio 2016 bens não duráveis", descricao: "Rio 2016 – Produtos nacionais, não duráveis, uso e consumo dos eventos, adquiridos pelas pessoas jurídicas mencionadas no § 2o do art. 4o da Lei nº 12.780/2013, Art. 12", csts: "CST 02 (Entrada isenta) e 52 (Saída isenta) – códigos de 301 a 399" },
        { codigo: "601", grupo: "Redução", resumo: "Pesquisa desenvolvimento tecnológico redução", descricao: "Equipamentos e outros destinados à pesquisa e ao desenvolvimento tecnológico – Art. 72 do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "602", grupo: "Redução", resumo: "Empresas habilitadas PDTI PDTA", descricao: "Equipamentos e outros destinados à empresas habilitadas no PDTI e PDTA utilizados em pesquisa e ao desenvolvimento tecnológico – Art. 73 do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "603", grupo: "Redução", resumo: "Informática até 11k Centro-Oeste", descricao: "Microcomputadores e outros de até R$11.000,00, unidades de disco, circuitos, etc, destinados a bens de informática ou automação. Centro-Oeste SUDAM SUDENE – Art. 142, I do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "604", grupo: "Redução", resumo: "Informática até 11k Geral", descricao: "Microcomputadores e outros de até R$11.000,00, unidades de disco, circuitos, etc, destinados a bens de informática ou automação. – Art. 142, I do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "605", grupo: "Redução", resumo: "Informática SUDAM SUDENE Centro-Oeste", descricao: "Bens de informática não incluídos no art. 142 do Decreto 7.212/2010 – Produzidos no CentroOeste, SUDAM, SUDENE – Art. 143, I do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "606", grupo: "Redução", resumo: "Bens informática demais regiões", descricao: "Bens de informática não incluídos no art. 142 do Decreto 7.212/2010 – Art. 143, II do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "607", grupo: "Redução", resumo: "PADIS semicondutores e displays", descricao: "Padis – Art. 150 do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "608", grupo: "Redução", resumo: "PATVD televisão digital", descricao: "Patvd – Art. 158 do Decreto 7.212/2010", csts: "601 a 608 – para redução" },
        { codigo: "999", grupo: "Outros", resumo: "Tributação Normal ou Outros", descricao: "Tributação normal IPI; Outros;", csts: "601 a 608 – para redução" }
    ];

    function popularOpcoesTributosModalConfig(container = document) {
        // 1. CSOSN / CST ICMS
        const selCsosn = container.querySelector('#cfg_enq_csosn');
        if (selCsosn && selCsosn.options.length === 0) {
            const grpCsosn = document.createElement('optgroup');
            grpCsosn.label = 'Simples Nacional (CSOSN)';
            const opcoesCsosn = [
                { cod: '101', desc: '101 - Tributada com permissão de crédito' },
                { cod: '102', desc: '102 - Tributada sem permissão de crédito' },
                { cod: '103', desc: '103 - Isenção do ICMS para faixa de receita' },
                { cod: '201', desc: '201 - Com permissão de crédito e cobrança do ICMS por ST' },
                { cod: '202', desc: '202 - Sem permissão de crédito e cobrança do ICMS por ST' },
                { cod: '203', desc: '203 - Isenção e cobrança do ICMS por ST' },
                { cod: '300', desc: '300 - Imune (Exportação)' },
                { cod: '400', desc: '400 - Não tributada pelo Simples Nacional' },
                { cod: '500', desc: '500 - ICMS cobrado anteriormente por ST ou antecipação' },
                { cod: '900', desc: '900 - Outros (Importação / Exportação / Outros)' }
            ];
            opcoesCsosn.forEach(o => grpCsosn.appendChild(new Option(o.desc, o.cod)));

            const grpIcms = document.createElement('optgroup');
            grpIcms.label = 'Regime Normal (CST ICMS)';
            const opcoesIcms = [
                { cod: '00', desc: '00 - Tributada integralmente' },
                { cod: '10', desc: '10 - Tributada e com cobrança do ICMS por ST' },
                { cod: '20', desc: '20 - Com redução de base de cálculo' },
                { cod: '30', desc: '30 - Isenta ou não tributada e com cobrança de ST' },
                { cod: '40', desc: '40 - Isenta' },
                { cod: '41', desc: '41 - Não tributada (Exportação / Imunidade)' },
                { cod: '50', desc: '50 - Suspensão' },
                { cod: '51', desc: '51 - Diferimento' },
                { cod: '60', desc: '60 - ICMS cobrado anteriormente por ST' },
                { cod: '70', desc: '70 - Com redução de BC e cobrança de ST' },
                { cod: '90', desc: '90 - Outras' }
            ];
            opcoesIcms.forEach(o => grpIcms.appendChild(new Option(o.desc, o.cod)));

            selCsosn.appendChild(grpCsosn);
            selCsosn.appendChild(grpIcms);
        }

        // 2. IPI - cEnq (Tabela Oficial Anexo XIV NT 2015.002 / EGS Sistemas)
        const selCEnq = container.querySelector('#cfg_enq_c_enq');
        if (selCEnq && selCEnq.options.length === 0) {
            const grupos = {
                'Imunidade': document.createElement('optgroup'),
                'Suspensão': document.createElement('optgroup'),
                'Isenção': document.createElement('optgroup'),
                'Redução': document.createElement('optgroup'),
                'Outros': document.createElement('optgroup')
            };
            grupos['Imunidade'].label = 'Imunidade (CST 04/54) - Códigos 001 a 099';
            grupos['Suspensão'].label = 'Suspensão (CST 05/55) - Códigos 101 a 199';
            grupos['Isenção'].label = 'Isenção (CST 02/52) - Códigos 301 a 399';
            grupos['Redução'].label = 'Redução - Códigos 601 a 608';
            grupos['Outros'].label = 'Tributação Normal / Outros';

            CENQ_IPI_OFICIAIS.forEach(item => {
                const textoResumido = item.resumo || item.descricao;
                const opt = new Option(`${item.codigo} - ${textoResumido}`, item.codigo);
                opt.title = `${item.codigo} - ${item.descricao}${item.csts ? ' (' + item.csts + ')' : ''}`;
                const grpEl = grupos[item.grupo] || grupos['Outros'];
                grpEl.appendChild(opt);
            });

            Object.values(grupos).forEach(grpEl => {
                if (grpEl.children.length > 0) selCEnq.appendChild(grpEl);
            });
        }

        // 3. CST IPI
        const selCstIpi = container.querySelector('#cfg_enq_cst_ipi');
        if (selCstIpi && selCstIpi.options.length === 0) {
            const grpEnt = document.createElement('optgroup');
            grpEnt.label = 'Entradas / Importação';
            const opcoesEnt = [
                { cod: '00', desc: '00 - Entrada com recuperação de crédito' },
                { cod: '01', desc: '01 - Entrada tributada com alíquota zero' },
                { cod: '02', desc: '02 - Entrada isenta' },
                { cod: '03', desc: '03 - Entrada não-tributada' },
                { cod: '04', desc: '04 - Entrada imune' },
                { cod: '05', desc: '05 - Entrada com suspensão' },
                { cod: '49', desc: '49 - Outras entradas' }
            ];
            opcoesEnt.forEach(o => grpEnt.appendChild(new Option(o.desc, o.cod)));

            const grpSai = document.createElement('optgroup');
            grpSai.label = 'Saídas / Exportação';
            const opcoesSai = [
                { cod: '50', desc: '50 - Saída tributada' },
                { cod: '51', desc: '51 - Saída tributável com alíquota zero' },
                { cod: '52', desc: '52 - Saída isenta' },
                { cod: '53', desc: '53 - Saída não-tributada' },
                { cod: '54', desc: '54 - Saída imune' },
                { cod: '55', desc: '55 - Saída com suspensão' },
                { cod: '99', desc: '99 - Outras saídas' }
            ];
            opcoesSai.forEach(o => grpSai.appendChild(new Option(o.desc, o.cod)));

            selCstIpi.appendChild(grpEnt);
            selCstIpi.appendChild(grpSai);
        }

        // 4 & 5. CST PIS e CST COFINS
        ['#cfg_enq_cst_pis', '#cfg_enq_cst_cofins'].forEach(selId => {
            const sel = container.querySelector(selId);
            if (sel && sel.options.length === 0) {
                const grpSai = document.createElement('optgroup');
                grpSai.label = 'Saídas / Exportação';
                const opcoesSai = [
                    { cod: '01', desc: '01 - Operação tributável com alíquota básica' },
                    { cod: '02', desc: '02 - Operação tributável com alíquota diferenciada' },
                    { cod: '03', desc: '03 - Operação tributável por unidade de medida' },
                    { cod: '04', desc: '04 - Operação tributável monofásica (Alíquota Zero)' },
                    { cod: '05', desc: '05 - Operação tributável por ST' },
                    { cod: '06', desc: '06 - Operação tributável a alíquota zero' },
                    { cod: '07', desc: '07 - Operação isenta da contribuição' },
                    { cod: '08', desc: '08 - Operação sem incidência (Exportação)' },
                    { cod: '09', desc: '09 - Operação com suspensão da contribuição' },
                    { cod: '49', desc: '49 - Outras operações de saída' }
                ];
                opcoesSai.forEach(o => grpSai.appendChild(new Option(o.desc, o.cod)));

                const grpEnt = document.createElement('optgroup');
                grpEnt.label = 'Entradas / Importação';
                const opcoesEnt = [
                    { cod: '50', desc: '50 - Direito a crédito (mercado interno)' },
                    { cod: '51', desc: '51 - Direito a crédito (não-tributada mercado interno)' },
                    { cod: '52', desc: '52 - Direito a crédito (exportação)' },
                    { cod: '53', desc: '53 - Direito a crédito (trib. e não-trib. interno)' },
                    { cod: '54', desc: '54 - Direito a crédito (trib. interno e exportação)' },
                    { cod: '55', desc: '55 - Direito a crédito (não-trib. e exportação)' },
                    { cod: '56', desc: '56 - Direito a crédito (múltiplos tipos)' },
                    { cod: '60', desc: '60 - Crédito presumido (mercado interno)' },
                    { cod: '61', desc: '61 - Crédito presumido (não-trib. interno)' },
                    { cod: '62', desc: '62 - Crédito presumido (exportação)' },
                    { cod: '63', desc: '63 - Crédito presumido (trib. e não-trib.)' },
                    { cod: '64', desc: '64 - Crédito presumido (trib. e exportação)' },
                    { cod: '65', desc: '65 - Crédito presumido (não-trib. e exportação)' },
                    { cod: '66', desc: '66 - Crédito presumido (múltiplas receitas)' },
                    { cod: '67', desc: '67 - Crédito presumido (outras operações)' },
                    { cod: '70', desc: '70 - Aquisição sem direito a crédito' },
                    { cod: '71', desc: '71 - Aquisição com isenção' },
                    { cod: '72', desc: '72 - Aquisição com suspensão (Admissão Temp. / Drawback)' },
                    { cod: '73', desc: '73 - Aquisição a alíquota zero' },
                    { cod: '74', desc: '74 - Aquisição sem incidência' },
                    { cod: '75', desc: '75 - Aquisição por ST' },
                    { cod: '98', desc: '98 - Outras operações de entrada' },
                    { cod: '99', desc: '99 - Outras operações' }
                ];
                opcoesEnt.forEach(o => grpEnt.appendChild(new Option(o.desc, o.cod)));

                sel.appendChild(grpSai);
                sel.appendChild(grpEnt);
            }
        });
    }

    // Abre a modal de configuração e seleciona o enquadramento desejado
    window.abrirModalConfigRegimes = async function (codigoParaSelecionar = null) {
        injetarModalConfigRegimesHTML();
        popularOpcoesTributosModalConfig();
        const configs = await carregarConfigRegimes();

        const chaves = Object.keys(configs);
        if (chaves.length === 0) {
            regimesConfigCache = Object.assign({}, REGIMES_FALLBACK);
        }

        const selModal = document.getElementById('cfg_enquadramento_select');
        const codigoAlvo = codigoParaSelecionar || (selModal ? selModal.value : '') || chaves[0] || 'SUSPENSAO';

        atualizarTodosSelectsEnquadramento(regimesConfigCache, codigoAlvo);
        window.selecionarEnquadramentoParaEdicao(codigoAlvo);

        const modalEl = document.getElementById('modal-config-regimes');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            modalEl.style.zIndex = '1070';
            const m = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            m.show();
            setTimeout(() => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 1) {
                    backdrops[backdrops.length - 1].style.zIndex = '1065';
                }
            }, 30);
        }
    };

    // Preenche os campos do formulário com as informações do enquadramento selecionado
    window.selecionarEnquadramentoParaEdicao = function (codigo) {
        if (!regimesConfigCache) return;
        const conf = regimesConfigCache[codigo] || REGIMES_FALLBACK[codigo];
        if (!conf) return;

        const elCod = document.getElementById('cfg_enq_codigo');
        if (elCod) elCod.value = conf.codigo || codigo;

        const elApelido = document.getElementById('cfg_enq_apelido');
        if (elApelido) elApelido.value = conf.apelido || conf.nome || '';

        const elDesc = document.getElementById('cfg_enq_descricao');
        if (elDesc) elDesc.value = conf.descricao || '';

        const elCfop = document.getElementById('cfg_enq_cfop');
        if (elCfop) elCfop.value = conf.cfop_padrao || '';

        const elTpNf = document.getElementById('cfg_enq_tp_nf');
        if (elTpNf) elTpNf.value = conf.tp_nf || '0';

        const elIdDest = document.getElementById('cfg_enq_id_dest');
        if (elIdDest) elIdDest.value = conf.id_dest || '3';

        const elTPag = document.getElementById('cfg_enq_t_pag');
        if (elTPag) elTPag.value = conf.t_pag || '90';

        const elCsosn = document.getElementById('cfg_enq_csosn');
        if (elCsosn) setSelectValueOrAdd(elCsosn, conf.csosn_icms || '400');

        const elCEnq = document.getElementById('cfg_enq_c_enq');
        if (elCEnq) setSelectValueOrAdd(elCEnq, conf.c_enq_ipi || '108');

        const elCstIpi = document.getElementById('cfg_enq_cst_ipi');
        if (elCstIpi) setSelectValueOrAdd(elCstIpi, conf.cst_ipi || '55');

        const elCstPis = document.getElementById('cfg_enq_cst_pis');
        if (elCstPis) setSelectValueOrAdd(elCstPis, conf.cst_pis || '08');

        const elCstCofins = document.getElementById('cfg_enq_cst_cofins');
        if (elCstCofins) setSelectValueOrAdd(elCstCofins, conf.cst_cofins || '08');

        const elInfCpl = document.getElementById('cfg_enq_inf_cpl');
        if (elInfCpl) elInfCpl.value = conf.inf_cpl_padrao || '';

        const selModal = document.getElementById('cfg_enquadramento_select');
        if (selModal) selModal.value = codigo;

        // Atualiza título do cabeçalho
        const hCfop = document.getElementById('cfg_header_cfop');
        if (hCfop) hCfop.innerText = `(${conf.cfop_padrao || '----'})`;

        const hApelido = document.getElementById('cfg_header_apelido');
        if (hApelido) hApelido.innerText = conf.apelido || conf.nome || codigo;

        // Atualiza item ativo na lista lateral
        document.querySelectorAll('#cfg_enquadramentos_lista .cfg-enq-item').forEach(el => {
            const isThis = el.getAttribute('data-codigo') === codigo;
            el.classList.toggle('active', isThis);
            el.classList.toggle('bg-primary', isThis);
            el.classList.toggle('text-white', isThis);
            el.classList.toggle('border-primary', isThis);
            el.classList.toggle('fw-bold', isThis);
            const spanCfop = el.querySelector('span.cfg-enq-cfop');
            if (spanCfop) {
                spanCfop.classList.toggle('text-white', isThis);
                spanCfop.classList.toggle('text-primary', !isThis);
            }
        });

        const btnExcluir = document.getElementById('btn-excluir-enq');
        if (btnExcluir) {
            btnExcluir.style.display = 'inline-flex';
        }
    };

    // Prepara formulário para criar um novo enquadramento
    window.criarNovoEnquadramento = function () {
        const elCod = document.getElementById('cfg_enq_codigo');
        if (elCod) elCod.value = '';

        const elApelido = document.getElementById('cfg_enq_apelido');
        if (elApelido) {
            elApelido.value = '';
            elApelido.focus();
        }

        const elDesc = document.getElementById('cfg_enq_descricao');
        if (elDesc) elDesc.value = '';

        const elCfop = document.getElementById('cfg_enq_cfop');
        if (elCfop) elCfop.value = '3930';

        const elTpNf = document.getElementById('cfg_enq_tp_nf');
        if (elTpNf) elTpNf.value = '0';

        const elIdDest = document.getElementById('cfg_enq_id_dest');
        if (elIdDest) elIdDest.value = '3';

        const elTPag = document.getElementById('cfg_enq_t_pag');
        if (elTPag) elTPag.value = '90';

        const elCsosn = document.getElementById('cfg_enq_csosn');
        if (elCsosn) setSelectValueOrAdd(elCsosn, '400');

        const elCEnq = document.getElementById('cfg_enq_c_enq');
        if (elCEnq) setSelectValueOrAdd(elCEnq, '160');

        const elCstIpi = document.getElementById('cfg_enq_cst_ipi');
        if (elCstIpi) setSelectValueOrAdd(elCstIpi, '55');

        const elCstPis = document.getElementById('cfg_enq_cst_pis');
        if (elCstPis) setSelectValueOrAdd(elCstPis, '08');

        const elCstCofins = document.getElementById('cfg_enq_cst_cofins');
        if (elCstCofins) setSelectValueOrAdd(elCstCofins, '08');

        const elInfCpl = document.getElementById('cfg_enq_inf_cpl');
        if (elInfCpl) elInfCpl.value = '';

        const selModal = document.getElementById('cfg_enquadramento_select');
        if (selModal) selModal.value = '';

        // Atualiza cabeçalho do formulário
        const hCfop = document.getElementById('cfg_header_cfop');
        if (hCfop) hCfop.innerText = '(3930)';

        const hApelido = document.getElementById('cfg_header_apelido');
        if (hApelido) hApelido.innerText = 'Novo Enquadramento';

        // Remove seleção ativa da lista lateral
        document.querySelectorAll('#cfg_enquadramentos_lista .cfg-enq-item').forEach(el => {
            el.classList.remove('active', 'bg-primary', 'text-white', 'border-primary', 'fw-bold');
            const spanCfop = el.querySelector('span.cfg-enq-cfop');
            if (spanCfop) {
                spanCfop.classList.remove('text-white');
                spanCfop.classList.add('text-primary');
            }
        });

        const btnExcluir = document.getElementById('btn-excluir-enq');
        if (btnExcluir) btnExcluir.style.display = 'none';

        if (window.nftToast) {
            window.nftToast('Preencha os dados do novo enquadramento e clique em Salvar.', { type: 'info' });
        }
    };

    // Salva o enquadramento configurado (criação ou edição)
    window.salvarConfigRegimesTributarios = async function () {
        const apelido = (document.getElementById('cfg_enq_apelido')?.value || '').trim();
        if (!apelido) {
            if (window.nftAlert) {
                await window.nftAlert('Por favor, informe o Apelido do enquadramento fiscal.', { type: 'warning', title: 'Apelido Obrigatório' });
            } else {
                alert('Por favor, informe o Apelido do enquadramento fiscal.');
            }
            document.getElementById('cfg_enq_apelido')?.focus();
            return;
        }

        let codigo = (document.getElementById('cfg_enq_codigo')?.value || '').trim();
        if (!codigo) {
            // Gera um código único baseado no apelido
            const slug = apelido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 20);
            codigo = `ENQ_${slug}_${Date.now().toString(36).toUpperCase()}`;
        }

        if (!regimesConfigCache) regimesConfigCache = {};

        const existente = regimesConfigCache[codigo] || {};

        const novoEnq = {
            codigo: codigo,
            apelido: apelido,
            nome: apelido,
            icone: existente.icone || '⚡',
            descricao: (document.getElementById('cfg_enq_descricao')?.value || '').trim(),
            cfop_padrao: (document.getElementById('cfg_enq_cfop')?.value || '').trim(),
            tp_nf: document.getElementById('cfg_enq_tp_nf')?.value || '0',
            id_dest: document.getElementById('cfg_enq_id_dest')?.value || '3',
            t_pag: document.getElementById('cfg_enq_t_pag')?.value || '90',
            csosn_icms: (document.getElementById('cfg_enq_csosn')?.value || '').trim(),
            c_enq_ipi: (document.getElementById('cfg_enq_c_enq')?.value || '').trim(),
            cst_ipi: (document.getElementById('cfg_enq_cst_ipi')?.value || '').trim(),
            p_ipi: existente.p_ipi !== undefined ? existente.p_ipi : 0.00,
            aliquota_ii: existente.aliquota_ii !== undefined ? existente.aliquota_ii : 0.00,
            cst_pis: (document.getElementById('cfg_enq_cst_pis')?.value || '').trim(),
            p_pis: existente.p_pis !== undefined ? existente.p_pis : 0.00,
            cst_cofins: (document.getElementById('cfg_enq_cst_cofins')?.value || '').trim(),
            p_cofins: existente.p_cofins !== undefined ? existente.p_cofins : 0.00,
            inf_cpl_padrao: (document.getElementById('cfg_enq_inf_cpl')?.value || '').trim()
        };

        regimesConfigCache[codigo] = novoEnq;

        try {
            const resp = await fetch('/api/config/regimes_tributarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regimes: regimesConfigCache })
            });
            const data = await resp.json();
            if (data.status === 'success') {
                regimesConfigCache = data.regimes;
                atualizarTodosSelectsEnquadramento(regimesConfigCache, codigo);
                window.selecionarEnquadramentoParaEdicao(codigo);

                if (window.nftToast) {
                    window.nftToast(`Enquadramento "${apelido}" salvo com sucesso!`, { type: 'success' });
                } else {
                    alert(`Enquadramento "${apelido}" salvo com sucesso!`);
                }
            } else {
                alert('Erro ao salvar enquadramento: ' + (data.message || 'Erro desconhecido'));
            }
        } catch (e) {
            console.error('Falha ao salvar enquadramento tributario:', e);
            alert('Falha na comunicação com o servidor para salvar enquadramento.');
        }
    };

    // Exclui o enquadramento selecionado
    window.excluirEnquadramentoAtual = async function () {
        const codigo = (document.getElementById('cfg_enq_codigo')?.value || '').trim();
        if (!codigo || !regimesConfigCache || !regimesConfigCache[codigo]) return;

        const apelido = regimesConfigCache[codigo].apelido || regimesConfigCache[codigo].nome || codigo;
        const confirmar = await (window.nftConfirm
            ? window.nftConfirm(`Deseja realmente excluir o enquadramento fiscal "${apelido}"?`, {
                title: 'Excluir Enquadramento',
                type: 'danger',
                confirmText: 'Sim, Excluir',
                cancelText: 'Cancelar'
            })
            : confirm(`Deseja realmente excluir o enquadramento fiscal "${apelido}"?`));

        if (!confirmar) return;

        delete regimesConfigCache[codigo];

        try {
            const resp = await fetch('/api/config/regimes_tributarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regimes: regimesConfigCache })
            });
            const data = await resp.json();
            if (data.status === 'success') {
                regimesConfigCache = data.regimes;
                const chaves = Object.keys(regimesConfigCache);
                const proxCodigo = chaves.length > 0 ? chaves[0] : null;

                atualizarTodosSelectsEnquadramento(regimesConfigCache, proxCodigo);
                if (proxCodigo) {
                    window.selecionarEnquadramentoParaEdicao(proxCodigo);
                } else {
                    window.criarNovoEnquadramento();
                }

                if (window.nftToast) {
                    window.nftToast(`Enquadramento "${apelido}" excluído com sucesso!`, { type: 'info' });
                }
            }
        } catch (e) {
            console.error('Falha ao excluir enquadramento:', e);
            alert('Erro ao excluir enquadramento fiscal.');
        }
    };

    // Restaura padrões fiscais
    window.restaurarConfigRegimesPadrao = async function () {
        const confirmar = await (window.nftConfirm
            ? window.nftConfirm(
                'Deseja restaurar todas as regras dos Enquadramentos Fiscais para os padrões fiscais oficiais (RIPI Art. 43, IN 1600, etc.)?',
                {
                    title: 'Restaurar Padrões Fiscais',
                    type: 'warning',
                    confirmText: 'Sim, Restaurar',
                    cancelText: 'Cancelar',
                    icon: 'rotate-ccw'
                }
            )
            : confirm('Deseja restaurar todas as regras dos Enquadramentos Fiscais para os padrões fiscais oficiais?'));

        if (!confirmar) return;

        try {
            const resp = await fetch('/api/config/regimes_tributarios/reset', { method: 'POST' });
            const data = await resp.json();
            if (data.status === 'success') {
                regimesConfigCache = data.regimes;
                atualizarTodosSelectsEnquadramento(regimesConfigCache);
                window.abrirModalConfigRegimes();
                if (window.nftToast) {
                    window.nftToast('Padrões fiscais restaurados com sucesso!', { type: 'info' });
                }
            }
        } catch (e) {
            console.error('Erro ao restaurar padrões:', e);
        }
    };

    // =========================================================================
    // 3. MODAL POPUP PARA APLICAR ENQUADRAMENTO FISCAL AOS ITENS (ABA 3)
    // =========================================================================

    function injetarModalAplicarEnquadramentoItensHTML() {
        if (document.getElementById('modal-aplicar-enquadramento-itens')) return;

        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.id = 'modal-aplicar-enquadramento-itens';
        modalDiv.tabIndex = -1;
        modalDiv.setAttribute('aria-hidden', 'true');
        modalDiv.setAttribute('data-bs-backdrop', 'static');

        modalDiv.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-dark text-white py-3">
                    <div class="d-flex align-items-center gap-2">
                        <i data-lucide="shield-check" class="text-primary"></i>
                        <div>
                            <h5 class="modal-title fw-bold mb-0 text-white">Aplicar Enquadramento Fiscal aos Itens</h5>
                            <small class="text-white-50" style="font-size: 11px;">
                                Escolha uma opção para visualizar o resumo detalhado antes de repassar os dados para os itens.
                            </small>
                        </div>
                    </div>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-3 p-md-4">
                    <div class="row g-3">
                        <!-- Coluna Esquerda: Escolha da Opção e Alvo -->
                        <div class="col-md-5 border-end">
                            <h6 class="fw-bold mb-2 text-heading d-flex align-items-center gap-1">
                                <i data-lucide="list" style="width: 15px; height: 15px;"></i>
                                <span>1. Escolha o Enquadramento</span>
                            </h6>
                            <label class="form-label small text-muted mb-1">Enquadramentos Disponíveis:</label>
                            <select id="modal_itens_select_enq" class="form-select form-select-sm fw-bold border-primary mb-3" onchange="window.atualizarResumoModalEnquadramento(this.value)">
                                <!-- Opções com Apelido -->
                            </select>

                            <h6 class="fw-bold mb-2 text-heading d-flex align-items-center gap-1">
                                <i data-lucide="target" style="width: 15px; height: 15px;"></i>
                                <span>2. Repassar Para:</span>
                            </h6>
                            <div class="card bg-body-tertiary border p-2 mb-3">
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="radio" name="modal_itens_escopo" id="modal_itens_escopo_todos" value="todos" checked onchange="window.atualizarEscopoModalEnquadramento()">
                                    <label class="form-check-label fw-semibold small cursor-pointer" for="modal_itens_escopo_todos" id="lbl_modal_itens_todos">
                                        Todos os Itens (<span id="modal_itens_qtd_todos">0</span>)
                                    </label>
                                    <div class="text-muted" style="font-size: 11px; margin-left: 2px;">
                                        Aplica a todos os produtos da grade atual.
                                    </div>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="modal_itens_escopo" id="modal_itens_escopo_selecionados" value="selecionados" onchange="window.atualizarEscopoModalEnquadramento()">
                                    <label class="form-check-label fw-semibold small cursor-pointer" for="modal_itens_escopo_selecionados" id="lbl_modal_itens_selecionados">
                                        Somente Itens Selecionados (<span id="modal_itens_qtd_selecionados">0</span>)
                                    </label>
                                    <div class="text-muted" style="font-size: 11px; margin-left: 2px;" id="modal_itens_selecionados_hint">
                                        Aplica apenas às linhas marcadas na grade.
                                    </div>
                                </div>
                            </div>

                            <div class="card bg-primary-subtle border border-primary-subtle p-2 mb-3">
                                <small class="text-primary fw-bold d-block mb-1">
                                    <i data-lucide="package-check" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i>
                                    Impacto da Aplicação:
                                </small>
                                <strong id="modal_itens_impacto_txt" class="text-primary fs-7">Será aplicado a todos os itens</strong>
                                <small class="text-muted mt-1" style="font-size: 11px;">
                                    CSTs, CSOSN e cEnq serão atualizados. Alíquotas e valores existentes são mantidos.
                                </small>
                            </div>

                            <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none text-primary d-flex align-items-center gap-1" onclick="window.abrirModalConfigRegimes(document.getElementById('modal_itens_select_enq')?.value)">
                                <i data-lucide="sliders" style="width: 13px; height: 13px;"></i>
                                <span>⚙️ Gerenciar / Criar Enquadramentos</span>
                            </button>
                        </div>

                        <!-- Coluna Direita: Resumo das Configurações do Enquadramento Solicitado -->
                        <div class="col-md-7 ps-md-3">
                            <h6 class="fw-bold mb-2 text-heading d-flex align-items-center gap-1">
                                <i data-lucide="file-text" style="width: 15px; height: 15px;"></i>
                                <span>3. Resumo das Configurações</span>
                            </h6>
                            <div class="card border border-primary-subtle shadow-sm p-3 bg-light-subtle">
                                <div class="d-flex align-items-center justify-content-between mb-1">
                                    <strong class="fs-6 text-primary" id="resumo_enq_apelido">-</strong>
                                    <span class="badge bg-secondary-subtle text-secondary" id="resumo_enq_tipo_dest">0-Entrada</span>
                                </div>
                                <small class="text-muted d-block mb-2" id="resumo_enq_desc"></small>

                                <!-- Parâmetros Fiscais -->
                                <div class="table-responsive">
                                    <table class="table table-sm table-borderless mb-0" style="font-size: 12px;">
                                        <tbody>
                                            <tr>
                                                <td class="text-muted py-1" style="width: 40%;">CFOP Sugerido:</td>
                                                <td class="py-1 fw-bold font-monospace" id="resumo_enq_cfop">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">Pagamento:</td>
                                                <td class="py-1 fw-bold" id="resumo_enq_tpag">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CSOSN / CST ICMS:</td>
                                                <td class="py-1 fw-bold font-monospace text-primary" id="resumo_enq_csosn">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">IPI - cEnq:</td>
                                                <td class="py-1 fw-bold font-monospace text-primary" id="resumo_enq_cenq">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CST IPI:</td>
                                                <td class="py-1 fw-bold font-monospace" id="resumo_enq_ipi">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CST PIS:</td>
                                                <td class="py-1 fw-bold font-monospace" id="resumo_enq_pis">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CST COFINS:</td>
                                                <td class="py-1 fw-bold font-monospace" id="resumo_enq_cofins">-</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Fundamentação infCpl -->
                                <div class="mt-2 pt-2 border-top">
                                    <small class="text-muted fw-bold d-block">Fundamentação Legal (infCpl sugerido):</small>
                                    <div class="small text-muted font-monospace p-2 bg-body rounded mt-1 border text-break" style="max-height: 75px; overflow-y: auto; font-size: 11px;" id="resumo_enq_infcpl">
                                        -
                                    </div>
                                </div>

                                <div class="alert alert-info py-2 px-3 small mt-2 mb-0 d-flex align-items-center gap-2" id="resumo_enq_alerta_impostos">
                                    <i data-lucide="info" style="width: 16px; height: 16px;" class="flex-shrink-0"></i>
                                    <span id="resumo_enq_alerta_txt" style="font-size: 11px;">Ao confirmar, os CSTs, CSOSN e cEnq configurados serão aplicados. As alíquotas e valores já existentes nos itens serão mantidos.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer d-flex justify-content-between py-2 bg-body-tertiary">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary btn-sm fw-bold shadow-sm d-flex align-items-center gap-1" id="btn_confirmar_aplicar_enq" onclick="window.confirmarEAplicarEnquadramentoAosItens()">
                        <i data-lucide="check-circle"></i>
                        <span id="btn_confirmar_aplicar_enq_txt">Confirmar e Repassar aos Itens</span>
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.appendChild(modalDiv);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Atualiza os textos e badges com base no escopo selecionado (Todos os Itens vs Somente Selecionados)
    window.atualizarEscopoModalEnquadramento = function () {
        const radioSel = document.getElementById('modal_itens_escopo_selecionados');
        const isSelecionados = radioSel && radioSel.checked;

        const table = (typeof itensTable !== 'undefined' && itensTable) ? itensTable : window.itensTable;
        const totalItens = (table && typeof table.getData === 'function')
            ? table.getData().length
            : ((typeof itensCache !== 'undefined' && Array.isArray(itensCache)) ? itensCache.length : (window.itensCache || []).length);

        const qtdSel = (table && typeof table.getSelectedRows === 'function') ? table.getSelectedRows().length : 0;

        const impactoEl = document.getElementById('modal_itens_impacto_txt');
        const btnTxtEl = document.getElementById('btn_confirmar_aplicar_enq_txt');

        if (isSelecionados) {
            if (impactoEl) {
                impactoEl.innerText = `Será aplicado a ${qtdSel} ite${qtdSel === 1 ? 'm selecionado' : 'ns selecionados'}`;
            }
            if (btnTxtEl) {
                btnTxtEl.innerText = `Confirmar e Repassar aos ${qtdSel} Itens Selecionados`;
            }
        } else {
            if (impactoEl) {
                impactoEl.innerText = `Será aplicado a todos os ${totalItens} itens da grade`;
            }
            if (btnTxtEl) {
                btnTxtEl.innerText = `Confirmar e Repassar a Todos os ${totalItens} Itens`;
            }
        }
    };

    // Abre o popup na Aba 3 para o usuário selecionar a opção e ver o resumo antes de aplicar
    window.abrirModalAplicarEnquadramentoItens = async function () {
        injetarModalAplicarEnquadramentoItensHTML();
        const configs = await carregarConfigRegimes();

        const table = (typeof itensTable !== 'undefined' && itensTable) ? itensTable : window.itensTable;
        const totalItens = (table && typeof table.getData === 'function')
            ? table.getData().length
            : ((typeof itensCache !== 'undefined' && Array.isArray(itensCache)) ? itensCache.length : (window.itensCache || []).length);

        const qtdSelecionados = (table && typeof table.getSelectedRows === 'function')
            ? table.getSelectedRows().length
            : 0;

        const qtdTodosEl = document.getElementById('modal_itens_qtd_todos');
        if (qtdTodosEl) qtdTodosEl.innerText = totalItens;

        const qtdSelEl = document.getElementById('modal_itens_qtd_selecionados');
        if (qtdSelEl) qtdSelEl.innerText = qtdSelecionados;

        const radioTodos = document.getElementById('modal_itens_escopo_todos');
        const radioSel = document.getElementById('modal_itens_escopo_selecionados');
        const hintSel = document.getElementById('modal_itens_selecionados_hint');

        if (qtdSelecionados > 0) {
            if (radioSel) radioSel.checked = true;
            if (hintSel) hintSel.innerText = `${qtdSelecionados} ite${qtdSelecionados === 1 ? 'm marcado' : 'ns marcados'} na grade.`;
        } else {
            if (radioTodos) radioTodos.checked = true;
            if (hintSel) hintSel.innerText = 'Nenhum item marcado na grade (use a caixa de seleção da tabela).';
        }

        // Popula select e determina seleção padrão
        const chaves = Object.keys(configs);
        const selOpRegime = document.getElementById('op_regime');
        const selAlvo = (selOpRegime && selOpRegime.value && configs[selOpRegime.value])
            ? selOpRegime.value
            : (chaves[0] || 'SUSPENSAO');

        atualizarTodosSelectsEnquadramento(configs, selAlvo);
        window.atualizarResumoModalEnquadramento(selAlvo);
        window.atualizarEscopoModalEnquadramento();

        const modalEl = document.getElementById('modal-aplicar-enquadramento-itens');
        if (modalEl) {
            const bModal = (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal : (typeof bootstrap !== 'undefined' ? bootstrap.Modal : null);
            if (bModal) {
                const m = (typeof bModal.getOrCreateInstance === 'function')
                    ? bModal.getOrCreateInstance(modalEl)
                    : (bModal.getInstance(modalEl) || new bModal(modalEl));
                if (m) m.show();
            } else if (typeof $ !== 'undefined' && typeof $(modalEl).modal === 'function') {
                $(modalEl).modal('show');
            } else {
                modalEl.style.display = 'block';
                modalEl.classList.add('show');
            }
        }
    };

    // Atualiza o resumo visual exibido ao lado no popup da Aba 3
    window.atualizarResumoModalEnquadramento = function (codigo) {
        if (!regimesConfigCache) return;
        const conf = regimesConfigCache[codigo] || REGIMES_FALLBACK[codigo];
        if (!conf) return;

        const elApelido = document.getElementById('resumo_enq_apelido');
        if (elApelido) elApelido.innerText = conf.apelido || conf.nome || codigo;

        const elTipoDest = document.getElementById('resumo_enq_tipo_dest');
        if (elTipoDest) {
            const tpTxt = (conf.tp_nf == '1') ? '1-Saída' : '0-Entrada';
            const destTxt = (conf.id_dest == '1') ? 'Interna' : (conf.id_dest == '2' ? 'Interestadual' : 'Exterior');
            elTipoDest.innerText = `${tpTxt} • ${destTxt}`;
        }

        const elDesc = document.getElementById('resumo_enq_desc');
        if (elDesc) elDesc.innerText = conf.descricao || 'Enquadramento Fiscal Customizado';

        const elCfop = document.getElementById('resumo_enq_cfop');
        if (elCfop) elCfop.innerText = conf.cfop_padrao || '-';

        const elTPag = document.getElementById('resumo_enq_tpag');
        if (elTPag) {
            elTPag.innerText = conf.t_pag === '90' ? '90 - Sem Pagamento (SEFAZ)' : `${conf.t_pag || '90'} - Com Pagamento`;
        }

        const elCsosn = document.getElementById('resumo_enq_csosn');
        if (elCsosn) elCsosn.innerText = conf.csosn_icms || '-';

        const elCEnq = document.getElementById('resumo_enq_cenq');
        if (elCEnq) {
            const itemOficial = CENQ_IPI_OFICIAIS.find(x => x.codigo === conf.c_enq_ipi);
            if (itemOficial) {
                elCEnq.innerText = `${itemOficial.codigo} - ${itemOficial.resumo || itemOficial.descricao}`;
                elCEnq.title = itemOficial.descricao;
            } else {
                elCEnq.innerText = conf.c_enq_ipi || '-';
            }
        }

        const elIpi = document.getElementById('resumo_enq_ipi');
        if (elIpi) {
            elIpi.innerText = `CST ${conf.cst_ipi || '-'}`;
        }

        const elPis = document.getElementById('resumo_enq_pis');
        if (elPis) {
            elPis.innerText = `CST ${conf.cst_pis || '-'}`;
        }

        const elCofins = document.getElementById('resumo_enq_cofins');
        if (elCofins) {
            elCofins.innerText = `CST ${conf.cst_cofins || '-'}`;
        }

        const elInfCpl = document.getElementById('resumo_enq_infcpl');
        if (elInfCpl) {
            elInfCpl.innerText = conf.inf_cpl_padrao || '(Nenhum texto de fundamentação legal configurado)';
        }

        const elAlertaTxt = document.getElementById('resumo_enq_alerta_txt');
        if (elAlertaTxt) {
            elAlertaTxt.innerHTML = '<strong>Preservação Tributária:</strong> Ao confirmar, os CSTs, CSOSN e cEnq serão aplicados. As alíquotas e valores de impostos existentes nos itens serão mantidos sem repasse.';
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    };

    // Aplica as regras do enquadramento escolhido aos itens da nota fiscal (todos ou somente selecionados)
    window.confirmarEAplicarEnquadramentoAosItens = async function () {
        const table = (typeof itensTable !== 'undefined' && itensTable) ? itensTable : window.itensTable;
        const itens = (typeof itensCache !== 'undefined' && Array.isArray(itensCache) && itensCache.length > 0)
            ? itensCache
            : ((table && typeof table.getData === 'function') ? table.getData() : (window.itensCache || []));

        if (!itens || itens.length === 0) {
            if (window.nftAlert) {
                await window.nftAlert("Nenhum item carregado na grade para aplicar o enquadramento fiscal.", {
                    type: "warning",
                    title: "Grade Vazia"
                });
            } else {
                alert("Nenhum item carregado na grade para aplicar o enquadramento fiscal.");
            }
            return;
        }

        const radioSel = document.getElementById('modal_itens_escopo_selecionados');
        const aplicarSomenteSelecionados = radioSel && radioSel.checked;

        let selectedRows = [];
        if (aplicarSomenteSelecionados) {
            if (table && typeof table.getSelectedRows === 'function') {
                selectedRows = table.getSelectedRows();
            }
            if (!selectedRows || selectedRows.length === 0) {
                if (window.nftAlert) {
                    await window.nftAlert("Nenhum item foi selecionado na grade. Selecione ao menos uma linha usando as caixas de seleção da tabela ou marque a opção 'Todos os Itens'.", {
                        type: "warning",
                        title: "Nenhum Item Selecionado"
                    });
                } else {
                    alert("Nenhum item foi selecionado na grade. Selecione ao menos uma linha usando as caixas de seleção da tabela ou marque a opção 'Todos os Itens'.");
                }
                return;
            }
        }

        const selModal = document.getElementById('modal_itens_select_enq');
        const codigo = selModal ? selModal.value : 'SUSPENSAO';
        const conf = (regimesConfigCache && regimesConfigCache[codigo]) ? regimesConfigCache[codigo] : REGIMES_FALLBACK[codigo];
        if (!conf) return;

        const apelido = conf.apelido || conf.nome || codigo;

        if (aplicarSomenteSelecionados) {
            // 1. Aplica somente aos itens selecionados
            const selectedDataList = [];
            selectedRows.forEach(row => {
                const item = row.getData();
                item.enquadramento = codigo;
                if (conf.csosn_icms) item.CSOSN = conf.csosn_icms;
                if (conf.c_enq_ipi) item.cEnq = conf.c_enq_ipi;
                if (conf.cst_ipi) item.CST_IPI = conf.cst_ipi;
                if (conf.cst_pis) item.CST_PIS = conf.cst_pis;
                if (conf.cst_cofins) item.CST_COFINS = conf.cst_cofins;
                // Alíquotas e valores de impostos existentes nos itens não são alterados
                row.update(item);
                selectedDataList.push(item);
            });

            // Sincroniza itensCache
            if (typeof itensCache !== 'undefined' && Array.isArray(itensCache)) {
                itensCache.forEach(it => {
                    if (selectedDataList.some(sel => (sel.nItem && sel.nItem === it.nItem) || (sel.id && sel.id === it.id) || sel === it)) {
                        it.enquadramento = codigo;
                        if (conf.csosn_icms) it.CSOSN = conf.csosn_icms;
                        if (conf.c_enq_ipi) it.cEnq = conf.c_enq_ipi;
                        if (conf.cst_ipi) it.CST_IPI = conf.cst_ipi;
                        if (conf.cst_pis) it.CST_PIS = conf.cst_pis;
                        if (conf.cst_cofins) it.CST_COFINS = conf.cst_cofins;
                    }
                });
            }
        } else {
            // 2. Aplica a todos os itens
            if (table && typeof table.getRows === 'function') {
                const allRows = table.getRows();
                allRows.forEach(row => {
                    const item = row.getData();
                    item.enquadramento = codigo;
                    if (conf.csosn_icms) item.CSOSN = conf.csosn_icms;
                    if (conf.c_enq_ipi) item.cEnq = conf.c_enq_ipi;
                    if (conf.cst_ipi) item.CST_IPI = conf.cst_ipi;
                    if (conf.cst_pis) item.CST_PIS = conf.cst_pis;
                    if (conf.cst_cofins) item.CST_COFINS = conf.cst_cofins;
                    row.update(item);
                });
            } else {
                itens.forEach(item => {
                    item.enquadramento = codigo;
                    if (conf.csosn_icms) item.CSOSN = conf.csosn_icms;
                    if (conf.c_enq_ipi) item.cEnq = conf.c_enq_ipi;
                    if (conf.cst_ipi) item.CST_IPI = conf.cst_ipi;
                    if (conf.cst_pis) item.CST_PIS = conf.cst_pis;
                    if (conf.cst_cofins) item.CST_COFINS = conf.cst_cofins;
                });
                if (table) table.setData(itens);
            }

            if (typeof itensCache !== 'undefined' && Array.isArray(itensCache)) {
                itensCache.forEach(it => {
                    it.enquadramento = codigo;
                    if (conf.csosn_icms) it.CSOSN = conf.csosn_icms;
                    if (conf.c_enq_ipi) it.cEnq = conf.c_enq_ipi;
                    if (conf.cst_ipi) it.CST_IPI = conf.cst_ipi;
                    if (conf.cst_pis) it.CST_PIS = conf.cst_pis;
                    if (conf.cst_cofins) it.CST_COFINS = conf.cst_cofins;
                });
            }
        }

        // Atualiza meio de pagamento se configurado
        if (conf.t_pag && typeof window.aoMudarMeioPagamento === 'function') {
            window.aoMudarMeioPagamento(conf.t_pag);
        }

        if (table && typeof table.redraw === 'function') {
            table.redraw(true);
        }

        if (typeof window.recalcularTotaisDosItens === 'function') {
            window.recalcularTotaisDosItens(true);
        }

        // Fecha modal
        const modalEl = document.getElementById('modal-aplicar-enquadramento-itens');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            const m = bootstrap.Modal.getInstance(modalEl);
            if (m) m.hide();
        }

        const qtdAfetados = aplicarSomenteSelecionados ? selectedRows.length : itens.length;
        const msgSucesso = aplicarSomenteSelecionados
            ? `Enquadramento "${apelido}" aplicado com sucesso aos ${qtdAfetados} ite${qtdAfetados === 1 ? 'm selecionado' : 'ns selecionados'}!`
            : `Enquadramento "${apelido}" aplicado com sucesso a todos os ${qtdAfetados} itens!`;

        if (window.nftToast) {
            window.nftToast(msgSucesso, { type: 'success' });
        } else {
            alert(msgSucesso);
        }
    };


    // =========================================================================
    // 5. MODAL POPUP PARA ZERAR IMPOSTOS DOS ITENS (TODOS VS SELECIONADOS)
    // =========================================================================

    function injetarModalZerarImpostosHTML() {
        if (document.getElementById('modal-zerar-impostos-itens')) return;

        const modalDiv = document.createElement('div');
        modalDiv.className = 'modal fade';
        modalDiv.id = 'modal-zerar-impostos-itens';
        modalDiv.tabIndex = -1;
        modalDiv.setAttribute('aria-hidden', 'true');
        modalDiv.setAttribute('data-bs-backdrop', 'static');

        modalDiv.innerHTML = `
        <div class="modal-dialog modal-dialog-centered" style="max-width: 520px;">
            <div class="modal-content border-0 shadow-lg">
                <div class="modal-header bg-warning text-dark py-3">
                    <div class="d-flex align-items-center gap-2">
                        <i data-lucide="percent" style="width: 22px; height: 22px;"></i>
                        <div>
                            <h5 class="modal-title fw-bold mb-0">Zerar Impostos dos Itens</h5>
                            <small class="text-dark-50" style="font-size: 11px;">
                                Zera Base de Cálculo, Alíquota (%) e Valores de II, IPI, PIS e COFINS.
                            </small>
                        </div>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-3 p-md-4">
                    <div class="mb-3">
                        <label class="form-label fw-bold small text-muted mb-2 d-flex align-items-center gap-1">
                            <i data-lucide="target" style="width: 15px; height: 15px;"></i>
                            <span>Escolha a Forma de Repasse:</span>
                        </label>

                        <div class="card bg-body-tertiary border p-3">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="modal_zerar_escopo" id="modal_zerar_escopo_todos" value="todos" checked onchange="window.atualizarEscopoModalZerarImpostos()">
                                <label class="form-check-label fw-semibold cursor-pointer" for="modal_zerar_escopo_todos" id="lbl_modal_zerar_todos">
                                    Zerar Todos os Itens (<span id="modal_zerar_qtd_todos">0</span>)
                                </label>
                                <div class="text-muted" style="font-size: 11px; margin-left: 2px;">
                                    Zera os impostos de todos os itens cadastrados na nota.
                                </div>
                            </div>

                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="modal_zerar_escopo" id="modal_zerar_escopo_selecionados" value="selecionados" onchange="window.atualizarEscopoModalZerarImpostos()">
                                <label class="form-check-label fw-semibold cursor-pointer" for="modal_zerar_escopo_selecionados" id="lbl_modal_zerar_selecionados">
                                    Zerar Itens Selecionados (<span id="modal_zerar_qtd_selecionados">0</span>)
                                </label>
                                <div class="text-muted" style="font-size: 11px; margin-left: 2px;" id="modal_zerar_selecionados_hint">
                                    Zera os impostos apenas dos itens marcados com checkbox na tabela.
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Quadro de Alerta / Detalhes dos Impostos Zerados -->
                    <div class="card bg-warning-subtle border border-warning-subtle p-3 mb-2">
                        <strong class="text-warning-emphasis d-flex align-items-center gap-1 mb-2" style="font-size: 13px;">
                            <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i>
                            <span id="modal_zerar_impacto_titulo">Impacto: Zerar Todos os Itens</span>
                        </strong>
                        <ul class="mb-2 ps-3 text-secondary" style="font-size: 12px; line-height: 1.5;">
                            <li><strong>II:</strong> Base de Cálculo = 0.00, % = 0.00, Valor = 0.00</li>
                            <li><strong>IPI:</strong> Base de Cálculo = 0.00, % = 0.00, Valor = 0.00</li>
                            <li><strong>PIS:</strong> Base de Cálculo = 0.00, % = 0.00, Valor = 0.00</li>
                            <li><strong>COFINS:</strong> Base de Cálculo = 0.00, % = 0.00, Valor = 0.00</li>
                        </ul>
                        <small class="text-muted" style="font-size: 11px;">
                            <i data-lucide="info" style="width: 12px; height: 12px; display: inline-block;"></i>
                            Todos os totais da nota fiscal e do rateio serão recalculados automaticamente.
                        </small>
                    </div>
                </div>
                <div class="modal-footer bg-light py-2 px-3 d-flex justify-content-between">
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-sm btn-warning fw-bold d-flex align-items-center gap-1 shadow-sm" id="btn_confirmar_zerar_impostos" onclick="window.confirmarZerarImpostosModal()">
                        <i data-lucide="check" style="width: 15px; height: 15px;"></i>
                        <span id="btn_confirmar_zerar_txt">Confirmar e Zerar Impostos</span>
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.appendChild(modalDiv);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    window.abrirModalZerarImpostos = async function () {
        injetarModalZerarImpostosHTML();

        const table = (typeof itensTable !== 'undefined' && itensTable) ? itensTable : window.itensTable;
        const totalItens = (table && typeof table.getData === 'function')
            ? table.getData().length
            : ((typeof itensCache !== 'undefined' && Array.isArray(itensCache)) ? itensCache.length : (window.itensCache || []).length);

        if (!totalItens || totalItens === 0) {
            if (window.nftAlert) {
                await window.nftAlert("Nenhum item carregado na grade para zerar impostos.", {
                    type: "warning",
                    title: "Grade Vazia"
                });
            } else {
                alert("Nenhum item carregado na grade para zerar impostos.");
            }
            return;
        }

        const qtdSelecionados = (table && typeof table.getSelectedRows === 'function')
            ? table.getSelectedRows().length
            : 0;

        const qtdTodosEl = document.getElementById('modal_zerar_qtd_todos');
        if (qtdTodosEl) qtdTodosEl.innerText = totalItens;

        const qtdSelEl = document.getElementById('modal_zerar_qtd_selecionados');
        if (qtdSelEl) qtdSelEl.innerText = qtdSelecionados;

        const radioTodos = document.getElementById('modal_zerar_escopo_todos');
        const radioSel = document.getElementById('modal_zerar_escopo_selecionados');
        const hintSel = document.getElementById('modal_zerar_selecionados_hint');

        if (qtdSelecionados > 0) {
            if (radioSel) radioSel.checked = true;
            if (hintSel) hintSel.innerText = `${qtdSelecionados} ite${qtdSelecionados === 1 ? 'm marcado' : 'ns marcados'} na grade.`;
        } else {
            if (radioTodos) radioTodos.checked = true;
            if (hintSel) hintSel.innerText = 'Nenhum item marcado na grade (use as caixas de seleção da tabela).';
        }

        window.atualizarEscopoModalZerarImpostos();

        const modalEl = document.getElementById('modal-zerar-impostos-itens');
        if (modalEl) {
            const bModal = (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal : (typeof bootstrap !== 'undefined' ? bootstrap.Modal : null);
            if (bModal) {
                const m = (typeof bModal.getOrCreateInstance === 'function')
                    ? bModal.getOrCreateInstance(modalEl)
                    : (bModal.getInstance(modalEl) || new bModal(modalEl));
                if (m) m.show();
            } else if (typeof $ !== 'undefined' && typeof $(modalEl).modal === 'function') {
                $(modalEl).modal('show');
            } else {
                modalEl.style.display = 'block';
                modalEl.classList.add('show');
            }
        }
    };

    window.atualizarEscopoModalZerarImpostos = function () {
        const radioSel = document.getElementById('modal_zerar_escopo_selecionados');
        const isSelecionados = radioSel && radioSel.checked;

        const table = (typeof itensTable !== 'undefined' && itensTable) ? itensTable : window.itensTable;
        const totalItens = (table && typeof table.getData === 'function')
            ? table.getData().length
            : ((typeof itensCache !== 'undefined' && Array.isArray(itensCache)) ? itensCache.length : (window.itensCache || []).length);

        const qtdSel = (table && typeof table.getSelectedRows === 'function') ? table.getSelectedRows().length : 0;

        const tituloEl = document.getElementById('modal_zerar_impacto_titulo');
        const btnTxtEl = document.getElementById('btn_confirmar_zerar_txt');

        if (isSelecionados) {
            if (tituloEl) {
                tituloEl.innerText = qtdSel > 0
                    ? `Impacto: Zerar impostos de ${qtdSel} ite${qtdSel === 1 ? 'm selecionado' : 'ns selecionados'}`
                    : 'Nenhum item selecionado na grade';
            }
            if (btnTxtEl) {
                btnTxtEl.innerText = qtdSel > 0
                    ? `Confirmar e Zerar Selecionados (${qtdSel})`
                    : 'Confirmar e Zerar (0 itens)';
            }
        } else {
            if (tituloEl) {
                tituloEl.innerText = `Impacto: Zerar impostos de todos os ${totalItens} itens`;
            }
            if (btnTxtEl) {
                btnTxtEl.innerText = `Confirmar e Zerar Todos (${totalItens})`;
            }
        }
    };

    window.confirmarZerarImpostosModal = async function () {
        const table = (typeof itensTable !== 'undefined' && itensTable) ? itensTable : window.itensTable;
        const totalItens = (table && typeof table.getData === 'function')
            ? table.getData().length
            : ((typeof itensCache !== 'undefined' && Array.isArray(itensCache)) ? itensCache.length : (window.itensCache || []).length);

        if (!totalItens || totalItens === 0) return;

        const radioSel = document.getElementById('modal_zerar_escopo_selecionados');
        const zerarSomenteSelecionados = radioSel && radioSel.checked;

        let selectedRows = [];
        if (zerarSomenteSelecionados) {
            if (table && typeof table.getSelectedRows === 'function') {
                selectedRows = table.getSelectedRows();
            }
            if (!selectedRows || selectedRows.length === 0) {
                if (window.nftAlert) {
                    await window.nftAlert("Nenhum item foi selecionado na grade. Selecione ao menos uma linha usando as caixas de seleção da tabela ou marque a opção 'Zerar Todos os Itens'.", {
                        type: "warning",
                        title: "Nenhum Item Selecionado"
                    });
                } else {
                    alert("Nenhum item foi selecionado na grade. Selecione ao menos uma linha usando as caixas de seleção da tabela ou marque a opção 'Zerar Todos os Itens'.");
                }
                return;
            }
        }

        const zerarObjeto = (it) => {
            // II (Imposto de Importação)
            it.vBC_II = '0.00';
            it.vII = '0.00';
            it.pII = '0.00';
            it.aliquota_ii = '0.00';

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
        };

        let qtdAfetados = 0;

        if (zerarSomenteSelecionados) {
            const selectedDataList = [];
            selectedRows.forEach(row => {
                const item = row.getData();
                zerarObjeto(item);
                row.update(item);
                selectedDataList.push(item);
            });
            qtdAfetados = selectedDataList.length;

            if (typeof itensCache !== 'undefined' && Array.isArray(itensCache)) {
                itensCache.forEach(it => {
                    if (selectedDataList.some(sel => (sel.nItem && sel.nItem === it.nItem) || (sel.id && sel.id === it.id) || sel === it)) {
                        zerarObjeto(it);
                    }
                });
            }
        } else {
            if (table && typeof table.getRows === 'function') {
                const allRows = table.getRows();
                allRows.forEach(row => {
                    const item = row.getData();
                    zerarObjeto(item);
                    row.update(item);
                });
                qtdAfetados = allRows.length;
            }

            if (typeof itensCache !== 'undefined' && Array.isArray(itensCache)) {
                itensCache.forEach(it => zerarObjeto(it));
                qtdAfetados = itensCache.length;
            }
            if (table && typeof table.setData === 'function' && (!table.getRows || table.getRows().length === 0)) {
                table.setData(window.itensCache || itensCache);
            }
        }

        if (table && typeof table.redraw === 'function') {
            table.redraw(true);
        }

        if (typeof window.recalcularTotaisDosItens === 'function') {
            window.recalcularTotaisDosItens(true);
        }
        if (typeof window.atualizarBadgesRateioEItens === 'function') {
            window.atualizarBadgesRateioEItens();
        }
        if (typeof window.triggerAutoSave === 'function') {
            window.triggerAutoSave();
        }

        // Fecha modal
        const modalEl = document.getElementById('modal-zerar-impostos-itens');
        if (modalEl) {
            const bModal = (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal : (typeof bootstrap !== 'undefined' ? bootstrap.Modal : null);
            if (bModal) {
                const m = bModal.getInstance ? bModal.getInstance(modalEl) : null;
                if (m) m.hide();
            } else if (typeof $ !== 'undefined' && typeof $(modalEl).modal === 'function') {
                $(modalEl).modal('hide');
            } else {
                modalEl.style.display = 'none';
                modalEl.classList.remove('show');
            }
        }

        const msgSucesso = zerarSomenteSelecionados
            ? `Impostos (II, IPI, PIS e COFINS) zerados com sucesso em ${qtdAfetados} ite${qtdAfetados === 1 ? 'm selecionado' : 'ns selecionados'}!`
            : `Impostos (II, IPI, PIS e COFINS) zerados com sucesso em todos os ${qtdAfetados} itens!`;

        if (window.nftToast) {
            window.nftToast(msgSucesso, { type: 'success' });
        } else if (window.nftAlert) {
            await window.nftAlert(msgSucesso, { type: 'success', title: 'Impostos Zerados' });
        } else {
            alert(msgSucesso);
        }
    };

    // Aponta a chamada global de zerar impostos para o novo popup interativo
    window.zerarImpostosTodosItensComConfirmacao = function () {
        window.abrirModalZerarImpostos();
    };

    // Retrocompatibilidade para chamadas diretas anteriores
    window.aplicarRegimeAosItensComConfirmacao = async function (regime) {
        window.abrirModalAplicarEnquadramentoItens();
    };

    // =========================================================================
    // 4. REORGANIZAÇÃO COM CLICK E ARRASTE (DRAG-AND-DROP) & FILTRO DE OPERAÇÕES
    // =========================================================================

    // Renderiza a lista de operações com suporte a drag-and-drop e filtro
    window.renderizarListaOperacoesCadastradas = function (operacoesParaExibir) {
        const lista = document.getElementById('lista-operacoes');
        if (!lista) return;

        const termoFiltro = (document.getElementById('filtro-operacoes')?.value || '').toLowerCase().trim();
        if (Array.isArray(operacoesParaExibir)) {
            window.operacoesCache = operacoesParaExibir;
        }
        const ops = Array.isArray(operacoesParaExibir) ? operacoesParaExibir : (window.operacoesCache || []);

        lista.innerHTML = '';

        // Filtra por nome, CFOP ou regime se houver busca
        const opsFiltradas = ops.filter(op => {
            if (!termoFiltro) return true;
            const nome = (op.nome_operacao || '').toLowerCase();
            const cfop = (op.cfop_padrao || '').toLowerCase();
            const regime = (op.regime_tributario || '').toLowerCase();
            return nome.includes(termoFiltro) || cfop.includes(termoFiltro) || regime.includes(termoFiltro);
        });

        // Atualiza contador de operações
        const badgeContador = document.getElementById('badge-total-operacoes');
        if (badgeContador) {
            badgeContador.innerText = `${opsFiltradas.length} operação${opsFiltradas.length !== 1 ? 'ões' : ''}`;
        }

        if (opsFiltradas.length === 0) {
            lista.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i data-lucide="search-x" class="mb-2" style="width: 28px; height: 28px;"></i>
                    <p class="mb-0 small">Nenhuma operação localizada para "${termoFiltro}".</p>
                </div>
            `;
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
            return;
        }

        opsFiltradas.forEach((op, index) => {
            const item = document.createElement('div');
            item.className = 'list-group-item list-group-item-action py-2 px-3 border rounded mb-1 op-drag-item';
            item.setAttribute('draggable', termoFiltro ? 'false' : 'true');
            item.setAttribute('data-id', op.id);
            item.setAttribute('data-index', index);
            item.style.cursor = 'pointer';
            item.style.transition = 'all 0.15s ease-in-out';

            // Badge de regime/enquadramento padronizada
            let regimeBadge = '';
            const regRaw = (op.regime_tributario || '').trim();
            const regUpper = regRaw.toUpperCase();

            let apelidoBadge = regRaw;
            let corBadge = 'bg-secondary-subtle text-secondary border border-secondary-subtle';

            const confCache = window.regimesConfigCache || regimesConfigCache;
            if (confCache && confCache[regRaw]) {
                apelidoBadge = confCache[regRaw].apelido || confCache[regRaw].nome || regRaw;
            } else if (confCache && confCache[regUpper]) {
                apelidoBadge = confCache[regUpper].apelido || confCache[regUpper].nome || regRaw;
            } else if (REGIMES_FALLBACK && REGIMES_FALLBACK[regUpper]) {
                apelidoBadge = REGIMES_FALLBACK[regUpper].apelido || REGIMES_FALLBACK[regUpper].nome || regRaw;
            }

            const compUpper = (apelidoBadge + ' ' + regUpper).toUpperCase();
            if (compUpper.includes('SUSPENS') || compUpper.includes('SUSPENSAO')) {
                corBadge = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
            } else if (compUpper.includes('ISENC') || compUpper.includes('ISENÇÃO') || compUpper.includes('ISENCAO')) {
                corBadge = 'bg-success-subtle text-success-emphasis border border-success-subtle';
            } else if (compUpper.includes('RECOLH') || compUpper.includes('RECOLHIMENTO')) {
                corBadge = 'bg-primary-subtle text-primary border border-primary-subtle';
            } else if (compUpper.includes('IMUN') || compUpper.includes('IMUNIDADE')) {
                corBadge = 'bg-info-subtle text-info-emphasis border border-info-subtle';
            }

            if (apelidoBadge) {
                const displayTxt = apelidoBadge.length > 20 ? (apelidoBadge.slice(0, 18) + '…') : apelidoBadge;
                regimeBadge = `<span class="badge rounded-pill fw-semibold ${corBadge}" style="font-size: 10px; max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle;" title="${apelidoBadge}">${displayTxt}</span>`;
            }

            const tipoTxt = (op.tp_nf == '1') ? '1-Saída' : '0-Entrada';
            const destTxt = (op.id_dest == '1') ? 'Interna' : (op.id_dest == '2' ? 'Interestadual' : 'Exterior');

            item.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-2" style="min-width: 0;">
                        ${!termoFiltro ? '<i data-lucide="grip-vertical" class="text-muted grip-handle cursor-grab flex-shrink-0" title="Arraste para reordenar" style="cursor: grab; width: 16px; height: 16px;"></i>' : ''}
                        <div class="text-truncate">
                            <span class="fw-bold font-monospace text-primary">(${op.cfop_padrao})</span>
                            <span class="fw-bold text-heading ms-1">${op.nome_operacao}</span>
                        </div>
                    </div>
                    <div class="flex-shrink-0 ms-2">
                        ${regimeBadge}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2 mt-1 text-muted" style="font-size: 11px;">
                    <span>${tipoTxt}</span>
                    <span>•</span>
                    <span>Dest: ${destTxt}</span>
                    <span>•</span>
                    <span>cEnq: ${op.c_enq_ipi || '108'}</span>
                    <span>•</span>
                    <span>CST IPI: ${op.cst_ipi || '55'}</span>
                    <span>•</span>
                    <span>tPag: ${op.t_pag || '90'}</span>
                </div>
            `;

            item.onclick = function (e) {
                if (item.classList.contains('dragging')) return;
                if (typeof selecionarOperacaoParaEdicao === 'function') {
                    selecionarOperacaoParaEdicao(op);
                }
                document.querySelectorAll('#lista-operacoes .op-drag-item').forEach(el => el.classList.remove('active', 'border-primary', 'active-op-item', 'bg-light'));
                item.classList.add('border-primary', 'active-op-item');
            };

            if (!termoFiltro) {
                item.addEventListener('dragstart', handleDragStart);
                item.addEventListener('dragover', handleDragOver);
                item.addEventListener('dragleave', handleDragLeave);
                item.addEventListener('drop', handleDrop);
                item.addEventListener('dragend', handleDragEnd);
            }

            lista.appendChild(item);
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    };

    // Handlers Drag and Drop
    function handleDragStart(e) {
        dragSrcElement = this;
        this.classList.add('dragging');
        this.style.opacity = '0.4';
        this.style.borderColor = '#0d6efd';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
    }

    function handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (this !== dragSrcElement) {
            this.classList.add('op-drag-target-over');
            this.style.borderTop = '2px solid #0d6efd';
        }
        return false;
    }

    function handleDragLeave() {
        this.classList.remove('op-drag-target-over');
        this.style.borderTop = '';
    }

    async function handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();
        this.classList.remove('op-drag-target-over');
        this.style.borderTop = '';

        if (dragSrcElement && dragSrcElement !== this) {
            const srcId = parseInt(dragSrcElement.getAttribute('data-id'));
            const targetId = parseInt(this.getAttribute('data-id'));

            if (Array.isArray(window.operacoesCache)) {
                const srcIdx = window.operacoesCache.findIndex(o => o.id === srcId);
                const targetIdx = window.operacoesCache.findIndex(o => o.id === targetId);

                if (srcIdx >= 0 && targetIdx >= 0) {
                    const itemMovido = window.operacoesCache.splice(srcIdx, 1)[0];
                    window.operacoesCache.splice(targetIdx, 0, itemMovido);

                    window.renderizarListaOperacoesCadastradas(window.operacoesCache);
                    atualizarSelectOperacoesComNovaOrdem(window.operacoesCache);

                    const ordemIds = window.operacoesCache.map(o => o.id);
                    try {
                        await fetch('/api/operacoes/reordenar', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ordem_ids: ordemIds })
                        });
                        if (window.nftToast) {
                            window.nftToast('Ordem das operações atualizada!', { type: 'success' });
                        }
                    } catch (err) {
                        console.error('Falha ao salvar ordem de operações:', err);
                    }
                }
            }
        }
        return false;
    }

    function handleDragEnd() {
        this.classList.remove('dragging');
        this.style.opacity = '1';
        this.style.borderColor = '';
        document.querySelectorAll('#lista-operacoes .op-drag-item').forEach(el => {
            el.classList.remove('op-drag-target-over');
            el.style.borderTop = '';
        });
    }

    function atualizarSelectOperacoesComNovaOrdem(novaLista) {
        const sel = document.getElementById('select_operacao');
        if (!sel || !Array.isArray(novaLista) || novaLista.length === 0) return;
        const valorAtual = sel.value;

        sel.innerHTML = '<option value="">-- Selecione a Operação Fiscal --</option>';
        novaLista.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op.nome_operacao;
            opt.text = `(${op.cfop_padrao}) ${op.nome_operacao}`;
            sel.appendChild(opt);
        });

        if (valorAtual) sel.value = valorAtual;
    }

    // Filtro em tempo real
    window.filtrarOperacoesCadastradas = function (termo) {
        window.renderizarListaOperacoesCadastradas(window.operacoesCache);
    };

    window.limparFiltroOperacoes = function () {
        const inp = document.getElementById('filtro-operacoes');
        if (inp) {
            inp.value = '';
            window.renderizarListaOperacoesCadastradas(window.operacoesCache);
            inp.focus();
        }
    };

    // Inicialização ao carregar o DOM
    document.addEventListener('DOMContentLoaded', function () {
        injetarModalConfigRegimesHTML();
        injetarModalAplicarEnquadramentoItensHTML();
        injetarModalZerarImpostosHTML();
        carregarConfigRegimes();

        const selRegimeOp = document.getElementById('op_regime');
        if (selRegimeOp) {
            selRegimeOp.addEventListener('change', function () {
                window.atualizarResumoRegimeForm(this.value);
            });
        }
    });

    if (document.body) {
        injetarModalConfigRegimesHTML();
        injetarModalAplicarEnquadramentoItensHTML();
        injetarModalZerarImpostosHTML();
        carregarConfigRegimes();
    }
})();


    // Expõe atalho global para abrir o Modal de Tipo de Nota
    window.abrirModalTipoNota = function () {
        const modalEl = document.getElementById('modalTipoNota');
        if (!modalEl) return;
        const bModal = (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal : (typeof bootstrap !== 'undefined' ? bootstrap.Modal : null);
        if (bModal) {
            const m = bModal.getOrCreateInstance(modalEl);
            m.show();
        }
        setTimeout(() => {
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }, 120);
    };
