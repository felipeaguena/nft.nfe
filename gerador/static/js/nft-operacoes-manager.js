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
            c_enq_ipi: '108',
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
            c_enq_ipi: '999',
            cst_ipi: '55',
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

    // Atualiza selects de enquadramentos existentes no sistema (Aba 4, Aba 3 e Modal)
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
                opt.textContent = conf.apelido || conf.nome || k;
                selOpRegime.appendChild(opt);
            });
            if (valAtual && configs[valAtual]) {
                selOpRegime.value = valAtual;
            } else if (chaves.length > 0) {
                selOpRegime.value = chaves[0];
            }
            window.atualizarResumoRegimeForm(selOpRegime.value);
        }

        // 2. Select do Modal de Configuração (#cfg_enquadramento_select)
        const selCfgModal = document.getElementById('cfg_enquadramento_select');
        if (selCfgModal) {
            const valAtual = valorSelecionado || selCfgModal.value;
            selCfgModal.innerHTML = '';
            chaves.forEach(k => {
                const conf = configs[k];
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = `${conf.apelido || conf.nome || k} (cEnq ${conf.c_enq_ipi || '-'})`;
                selCfgModal.appendChild(opt);
            });
            if (valAtual && configs[valAtual]) {
                selCfgModal.value = valAtual;
            } else if (chaves.length > 0) {
                selCfgModal.value = chaves[0];
            }
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
                opt.textContent = `${conf.apelido || conf.nome || k} (cEnq ${conf.c_enq_ipi || '-'})`;
                selItensModal.appendChild(opt);
            });
            if (valAtual && configs[valAtual]) {
                selItensModal.value = valAtual;
            } else if (chaves.length > 0) {
                selItensModal.value = chaves[0];
            }
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
            if (conf.p_ipi !== undefined) setVal('op_p_ipi', Number(conf.p_ipi || 0).toFixed(2));
            if (conf.aliquota_ii !== undefined) setVal('op_aliquota_ii', Number(conf.aliquota_ii || 0).toFixed(2));
            if (conf.cst_pis) setVal('op_cst_pis', conf.cst_pis);
            if (conf.p_pis !== undefined) setVal('op_p_pis', Number(conf.p_pis || 0).toFixed(2));
            if (conf.cst_cofins) setVal('op_cst_cofins', conf.cst_cofins);
            if (conf.p_cofins !== undefined) setVal('op_p_cofins', Number(conf.p_cofins || 0).toFixed(2));
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

        const apelido = conf.apelido || conf.nome || regimeKey;
        let resumoTxt = `${apelido}: cEnq ${conf.c_enq_ipi || '-'} | CST IPI ${conf.cst_ipi || '-'} | PIS ${conf.cst_pis || '-'} | COFINS ${conf.cst_cofins || '-'} | Pagamento ${conf.t_pag || '90'}`;
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
            if (modalItens && modalItens.classList.contains('show')) {
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
                    <!-- Barra de Seleção e Botão Novo Enquadramento -->
                    <div class="card bg-body-tertiary border p-3 mb-3 shadow-sm">
                        <div class="row align-items-center g-2">
                            <div class="col-md-7 col-lg-8">
                                <label class="form-label small fw-bold text-secondary mb-1 d-flex align-items-center gap-1">
                                    <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
                                    <span>Selecionar Enquadramento Cadastrado:</span>
                                </label>
                                <select class="form-select form-select-sm fw-bold border-primary" id="cfg_enquadramento_select" onchange="window.selecionarEnquadramentoParaEdicao(this.value)">
                                    <!-- Preenchido dinamicamente com opções cadastradas -->
                                </select>
                            </div>
                            <div class="col-md-5 col-lg-4 d-flex align-items-end justify-content-md-end gap-2 pt-2 pt-md-0">
                                <button type="button" class="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-1 shadow-sm flex-fill flex-md-grow-0" onclick="window.criarNovoEnquadramento()">
                                    <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                                    <span>+ Novo Enquadramento</span>
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 flex-fill flex-md-grow-0" id="btn-excluir-enq" onclick="window.excluirEnquadramentoAtual()" title="Excluir este enquadramento">
                                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                                    <span>Excluir</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Formulário de Edição do Enquadramento Selecionado -->
                    <div class="card border p-3 shadow-sm">
                        <input type="hidden" id="cfg_enq_codigo" value="">
                        <div class="row g-3">
                            <!-- Campo para Apelido do Enquadramento -->
                            <div class="col-md-6">
                                <label class="form-label small fw-bold text-primary mb-1">
                                    <i data-lucide="bookmark" style="width: 13px; height: 13px;"></i>
                                    Apelido do Enquadramento (Nome de exibição rápida) *
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
                                <label class="form-label small fw-bold">Meio de Pagamento (tPag)</label>
                                <select class="form-select form-select-sm fw-bold" id="cfg_enq_t_pag">
                                    <option value="90">90 - Sem Pagamento (SEFAZ vPag=0)</option>
                                    <option value="99">99 - Outros (Câmbio / Exterior)</option>
                                    <option value="01">01 - Dinheiro</option>
                                    <option value="15">15 - Boleto Bancário</option>
                                    <option value="17">17 - PIX</option>
                                </select>
                            </div>

                            <!-- ICMS & IPI -->
                            <div class="col-12"><h6 class="border-bottom pb-1 mb-1 mt-2 fw-bold text-heading">Tributos Federais e Estaduais Padrão</h6></div>
                            <div class="col-md-4">
                                <label class="form-label small">CSOSN / CST ICMS</label>
                                <input type="text" class="form-control form-control-sm font-monospace" id="cfg_enq_csosn" placeholder="Ex: 400, 900, 102">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small">Código de Enquadramento IPI (cEnq)</label>
                                <input type="text" class="form-control form-control-sm font-monospace fw-bold" id="cfg_enq_c_enq" placeholder="Ex: 108, 107, 301, 999">
                            </div>
                            <div class="col-md-2">
                                <label class="form-label small">CST IPI</label>
                                <input type="text" class="form-control form-control-sm font-monospace" id="cfg_enq_cst_ipi" placeholder="Ex: 55, 05, 52, 49">
                            </div>
                            <div class="col-md-2">
                                <label class="form-label small">Alíquota IPI (%)</label>
                                <input type="number" step="0.01" class="form-control form-control-sm" id="cfg_enq_p_ipi" value="0.00">
                            </div>

                            <!-- PIS, COFINS & II -->
                            <div class="col-md-3">
                                <label class="form-label small">CST PIS</label>
                                <input type="text" class="form-control form-control-sm font-monospace" id="cfg_enq_cst_pis" placeholder="Ex: 08, 07, 01">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label small">Alíquota PIS (%)</label>
                                <input type="number" step="0.01" class="form-control form-control-sm" id="cfg_enq_p_pis" value="0.00">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label small">CST COFINS</label>
                                <input type="text" class="form-control form-control-sm font-monospace" id="cfg_enq_cst_cofins" placeholder="Ex: 08, 07, 01">
                            </div>
                            <div class="col-md-3">
                                <label class="form-label small">Alíquota COFINS (%)</label>
                                <input type="number" step="0.01" class="form-control form-control-sm" id="cfg_enq_p_cofins" value="0.00">
                            </div>

                            <!-- Fundamentação Legal infCpl -->
                            <div class="col-12">
                                <label class="form-label small fw-bold">Texto Padrão de Fundamentação Legal (infCpl sugerido no rodapé)</label>
                                <textarea class="form-control form-control-sm" id="cfg_enq_inf_cpl" rows="2" placeholder="Fundamentação legal sugerida para esta nota..."></textarea>
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
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // Abre a modal de configuração e seleciona o enquadramento desejado
    window.abrirModalConfigRegimes = async function (codigoParaSelecionar = null) {
        injetarModalConfigRegimesHTML();
        const configs = await carregarConfigRegimes();

        const chaves = Object.keys(configs);
        if (chaves.length === 0) {
            regimesConfigCache = Object.assign({}, REGIMES_FALLBACK);
        }

        atualizarTodosSelectsEnquadramento(regimesConfigCache, codigoParaSelecionar);

        const selModal = document.getElementById('cfg_enquadramento_select');
        const codigoAlvo = codigoParaSelecionar || (selModal ? selModal.value : '') || chaves[0] || 'SUSPENSAO';

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
        if (elCsosn) elCsosn.value = conf.csosn_icms || '';

        const elCEnq = document.getElementById('cfg_enq_c_enq');
        if (elCEnq) elCEnq.value = conf.c_enq_ipi || '';

        const elCstIpi = document.getElementById('cfg_enq_cst_ipi');
        if (elCstIpi) elCstIpi.value = conf.cst_ipi || '';

        const elPIpi = document.getElementById('cfg_enq_p_ipi');
        if (elPIpi) elPIpi.value = Number(conf.p_ipi || 0).toFixed(2);

        const elCstPis = document.getElementById('cfg_enq_cst_pis');
        if (elCstPis) elCstPis.value = conf.cst_pis || '';

        const elPPis = document.getElementById('cfg_enq_p_pis');
        if (elPPis) elPPis.value = Number(conf.p_pis || 0).toFixed(2);

        const elCstCofins = document.getElementById('cfg_enq_cst_cofins');
        if (elCstCofins) elCstCofins.value = conf.cst_cofins || '';

        const elPCofins = document.getElementById('cfg_enq_p_cofins');
        if (elPCofins) elPCofins.value = Number(conf.p_cofins || 0).toFixed(2);

        const elInfCpl = document.getElementById('cfg_enq_inf_cpl');
        if (elInfCpl) elInfCpl.value = conf.inf_cpl_padrao || '';

        const selModal = document.getElementById('cfg_enquadramento_select');
        if (selModal && selModal.value !== codigo) selModal.value = codigo;

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
        if (elCsosn) elCsosn.value = '400';

        const elCEnq = document.getElementById('cfg_enq_c_enq');
        if (elCEnq) elCEnq.value = '108';

        const elCstIpi = document.getElementById('cfg_enq_cst_ipi');
        if (elCstIpi) elCstIpi.value = '55';

        const elPIpi = document.getElementById('cfg_enq_p_ipi');
        if (elPIpi) elPIpi.value = '0.00';

        const elCstPis = document.getElementById('cfg_enq_cst_pis');
        if (elCstPis) elCstPis.value = '08';

        const elPPis = document.getElementById('cfg_enq_p_pis');
        if (elPPis) elPPis.value = '0.00';

        const elCstCofins = document.getElementById('cfg_enq_cst_cofins');
        if (elCstCofins) elCstCofins.value = '08';

        const elPCofins = document.getElementById('cfg_enq_p_cofins');
        if (elPCofins) elPCofins.value = '0.00';

        const elInfCpl = document.getElementById('cfg_enq_inf_cpl');
        if (elInfCpl) elInfCpl.value = '';

        const selModal = document.getElementById('cfg_enquadramento_select');
        if (selModal) selModal.value = '';

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

        const novoEnq = {
            codigo: codigo,
            apelido: apelido,
            nome: apelido,
            icone: '⚡',
            descricao: (document.getElementById('cfg_enq_descricao')?.value || '').trim(),
            cfop_padrao: (document.getElementById('cfg_enq_cfop')?.value || '').trim(),
            tp_nf: document.getElementById('cfg_enq_tp_nf')?.value || '0',
            id_dest: document.getElementById('cfg_enq_id_dest')?.value || '3',
            t_pag: document.getElementById('cfg_enq_t_pag')?.value || '90',
            csosn_icms: (document.getElementById('cfg_enq_csosn')?.value || '').trim(),
            c_enq_ipi: (document.getElementById('cfg_enq_c_enq')?.value || '').trim(),
            cst_ipi: (document.getElementById('cfg_enq_cst_ipi')?.value || '').trim(),
            p_ipi: parseFloat(document.getElementById('cfg_enq_p_ipi')?.value || 0),
            aliquota_ii: 0.00,
            cst_pis: (document.getElementById('cfg_enq_cst_pis')?.value || '').trim(),
            p_pis: parseFloat(document.getElementById('cfg_enq_p_pis')?.value || 0),
            cst_cofins: (document.getElementById('cfg_enq_cst_cofins')?.value || '').trim(),
            p_cofins: parseFloat(document.getElementById('cfg_enq_p_cofins')?.value || 0),
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
                        <!-- Coluna Esquerda: Escolha da Opção -->
                        <div class="col-md-5 border-end">
                            <h6 class="fw-bold mb-2 text-heading d-flex align-items-center gap-1">
                                <i data-lucide="list" style="width: 15px; height: 15px;"></i>
                                <span>1. Escolha o Enquadramento</span>
                            </h6>
                            <label class="form-label small text-muted mb-1">Enquadramentos Disponíveis:</label>
                            <select id="modal_itens_select_enq" class="form-select form-select-sm fw-bold border-primary mb-3" onchange="window.atualizarResumoModalEnquadramento(this.value)">
                                <!-- Opções com Apelido -->
                            </select>

                            <div class="card bg-body-tertiary border p-2 mb-3">
                                <small class="text-muted d-block mb-1">Impacto na Nota Fiscal:</small>
                                <div class="d-flex align-items-center gap-2">
                                    <i data-lucide="package-check" class="text-success" style="width: 18px; height: 18px;"></i>
                                    <strong id="modal_itens_total_count" class="text-primary fs-6">0 itens na grade</strong>
                                </div>
                                <small class="text-muted mt-1" style="font-size: 11px;">
                                    Todos os itens receberão os CSTs, alíquotas e cEnq configurados.
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
                                <span>2. Resumo das Configurações</span>
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
                                                <td class="text-muted py-1">Meio de Pagamento:</td>
                                                <td class="py-1 fw-bold" id="resumo_enq_tpag">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CSOSN / CST ICMS:</td>
                                                <td class="py-1 fw-bold font-monospace text-primary" id="resumo_enq_csosn">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">Código Enquadramento (cEnq):</td>
                                                <td class="py-1 fw-bold font-monospace text-primary" id="resumo_enq_cenq">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CST IPI / Alíquota:</td>
                                                <td class="py-1 fw-bold font-monospace" id="resumo_enq_ipi">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CST PIS / Alíquota:</td>
                                                <td class="py-1 fw-bold font-monospace" id="resumo_enq_pis">-</td>
                                            </tr>
                                            <tr>
                                                <td class="text-muted py-1">CST COFINS / Alíquota:</td>
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
                                    <span id="resumo_enq_alerta_txt" style="font-size: 11px;">Ao confirmar, os valores e alíquotas serão recalculados na grade.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer d-flex justify-content-between py-2 bg-body-tertiary">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary btn-sm fw-bold shadow-sm d-flex align-items-center gap-1" onclick="window.confirmarEAplicarEnquadramentoAosItens()">
                        <i data-lucide="check-circle"></i>
                        <span>Confirmar e Repassar Dados aos Itens</span>
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

    // Abre o popup na Aba 3 para o usuário selecionar a opção e ver o resumo antes de aplicar
    window.abrirModalAplicarEnquadramentoItens = async function () {
        injetarModalAplicarEnquadramentoItensHTML();
        const configs = await carregarConfigRegimes();

        // Atualiza quantidade de itens
        const itens = (typeof itensCache !== 'undefined' && Array.isArray(itensCache) && itensCache.length > 0)
            ? itensCache
            : ((typeof itensTable !== 'undefined' && itensTable) ? itensTable.getData() : (window.itensCache || []));

        const countEl = document.getElementById('modal_itens_total_count');
        if (countEl) {
            countEl.innerText = `${itens.length} ite${itens.length === 1 ? 'm' : 'ns'} na grade`;
        }

        // Popula select e determina seleção padrão
        const chaves = Object.keys(configs);
        const selOpRegime = document.getElementById('op_regime');
        const selAlvo = (selOpRegime && selOpRegime.value && configs[selOpRegime.value])
            ? selOpRegime.value
            : (chaves[0] || 'SUSPENSAO');

        atualizarTodosSelectsEnquadramento(configs, selAlvo);
        window.atualizarResumoModalEnquadramento(selAlvo);

        const modalEl = document.getElementById('modal-aplicar-enquadramento-itens');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            const m = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            m.show();
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
        if (elCEnq) elCEnq.innerText = conf.c_enq_ipi || '-';

        const elIpi = document.getElementById('resumo_enq_ipi');
        if (elIpi) {
            const pIpi = Number(conf.p_ipi || 0);
            elIpi.innerText = `CST ${conf.cst_ipi || '-'} (${pIpi.toFixed(2)}%)`;
        }

        const elPis = document.getElementById('resumo_enq_pis');
        if (elPis) {
            const pPis = Number(conf.p_pis || 0);
            elPis.innerText = `CST ${conf.cst_pis || '-'} (${pPis.toFixed(2)}%)`;
        }

        const elCofins = document.getElementById('resumo_enq_cofins');
        if (elCofins) {
            const pCofins = Number(conf.p_cofins || 0);
            elCofins.innerText = `CST ${conf.cst_cofins || '-'} (${pCofins.toFixed(2)}%)`;
        }

        const elInfCpl = document.getElementById('resumo_enq_infcpl');
        if (elInfCpl) {
            elInfCpl.innerText = conf.inf_cpl_padrao || '(Nenhum texto de fundamentação legal configurado)';
        }

        const elAlertaTxt = document.getElementById('resumo_enq_alerta_txt');
        if (elAlertaTxt) {
            const pIpi = Number(conf.p_ipi || 0);
            const pPis = Number(conf.p_pis || 0);
            const pCofins = Number(conf.p_cofins || 0);
            if (pIpi === 0 && pPis === 0 && pCofins === 0) {
                elAlertaTxt.innerHTML = '<strong>Regime com Não-Incidência / Suspensão:</strong> Os valores de impostos federais serão zerados nos itens.';
            } else {
                elAlertaTxt.innerHTML = '<strong>Regime Tributado:</strong> As bases de cálculo e valores de impostos serão apurados conforme as alíquotas configuradas.';
            }
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    };

    // Aplica as regras do enquadramento escolhido aos itens da nota fiscal
    window.confirmarEAplicarEnquadramentoAosItens = async function () {
        const itens = (typeof itensCache !== 'undefined' && Array.isArray(itensCache) && itensCache.length > 0)
            ? itensCache
            : ((typeof itensTable !== 'undefined' && itensTable) ? itensTable.getData() : (window.itensCache || []));

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

        const selModal = document.getElementById('modal_itens_select_enq');
        const codigo = selModal ? selModal.value : 'SUSPENSAO';
        const conf = (regimesConfigCache && regimesConfigCache[codigo]) ? regimesConfigCache[codigo] : REGIMES_FALLBACK[codigo];
        if (!conf) return;

        const apelido = conf.apelido || conf.nome || codigo;
        const pIpi = parseFloat(conf.p_ipi || 0);
        const pPis = parseFloat(conf.p_pis || 0);
        const pCofins = parseFloat(conf.p_cofins || 0);
        const pII = parseFloat(conf.aliquota_ii || 0);

        function pNum(v) {
            if (!v) return 0;
            const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
            return isNaN(n) ? 0 : n;
        }

        itens.forEach(item => {
            if (conf.csosn_icms) item.CSOSN = conf.csosn_icms;
            if (conf.c_enq_ipi) item.cEnq = conf.c_enq_ipi;
            if (conf.cst_ipi) item.CST_IPI = conf.cst_ipi;
            item.pIPI = pIpi;

            if (conf.cst_pis) item.CST_PIS = conf.cst_pis;
            item.pPIS = pPis;

            if (conf.cst_cofins) item.CST_COFINS = conf.cst_cofins;
            item.pCOFINS = pCofins;

            item.aliquota_ii = pII;

            // Recálculo de IPI
            const vp = pNum(item.vProd);
            if (pIpi === 0 || ['05', '55', '52', '02', '53', '03', '54', '04'].includes(String(item.CST_IPI).trim())) {
                item.vBC_IPI = '0.00';
                item.vIPI = '0.00';
            } else {
                item.vBC_IPI = vp.toFixed(2);
                item.vIPI = (vp * (pIpi / 100)).toFixed(2);
            }

            // Recálculo de PIS e COFINS
            const vf = pNum(item.vFrete);
            const vs = pNum(item.vSeg);
            const vo = pNum(item.vOutro);
            const baseTributos = vp + vf + vs + vo;

            if (pPis === 0 || ['08', '07', '04', '06', '09'].includes(String(item.CST_PIS).trim())) {
                item.vBC_PIS = '0.00';
                item.vPIS = '0.00';
            } else {
                item.vBC_PIS = baseTributos.toFixed(2);
                item.vPIS = (baseTributos * (pPis / 100)).toFixed(2);
            }

            if (pCofins === 0 || ['08', '07', '04', '06', '09'].includes(String(item.CST_COFINS).trim())) {
                item.vBC_COFINS = '0.00';
                item.vCOFINS = '0.00';
            } else {
                item.vBC_COFINS = baseTributos.toFixed(2);
                item.vCOFINS = (baseTributos * (pCofins / 100)).toFixed(2);
            }

            // Recálculo de II
            if (pII === 0) {
                item.vBC_II = '0.00';
                item.vII = '0.00';
            }

            // Recálculo de ICMS
            if (['400', '300'].includes(String(item.CSOSN).trim())) {
                item.vBC = '0.00';
                item.vICMS = '0.00';
                item.pICMS = 0.00;
            } else if (['900', '102', '00'].includes(String(item.CSOSN).trim())) {
                item.vBC = baseTributos.toFixed(2);
                if (pNum(item.pICMS) === 0) item.pICMS = 18.00;
                item.vICMS = (baseTributos * (pNum(item.pICMS) / 100)).toFixed(2);
            }
        });

        // Atualiza meio de pagamento se configurado
        if (conf.t_pag && typeof window.aoMudarMeioPagamento === 'function') {
            window.aoMudarMeioPagamento(conf.t_pag);
        }

        // Atualiza grade Tabulator
        if (typeof itensTable !== 'undefined' && itensTable) {
            itensTable.setData(itens);
        }
        if (typeof itensCache !== 'undefined') itensCache = itens;
        window.itensCache = itens;

        if (typeof window.recalcularTotaisDosItens === 'function') {
            window.recalcularTotaisDosItens(true);
        }

        // Fecha modal
        const modalEl = document.getElementById('modal-aplicar-enquadramento-itens');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            const m = bootstrap.Modal.getInstance(modalEl);
            if (m) m.hide();
        }

        if (window.nftToast) {
            window.nftToast(`Enquadramento "${apelido}" aplicado com sucesso a todos os ${itens.length} itens!`, { type: 'success' });
        } else {
            alert(`Enquadramento "${apelido}" aplicado com sucesso a todos os ${itens.length} itens!`);
        }
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
        carregarConfigRegimes();
    }
})();
