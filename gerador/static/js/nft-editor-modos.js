/**
 * Configuração e comportamento específico por modo do Editor NF-e Unificado:
 * - rascunho (/rascunho, /editor)
 * - nova_nf  (/nova_nf)
 * - di_duimp (/di_duimp, /duimp)
 */
(function (global) {
    'use strict';

    const MODOS = {
        rascunho: {
            key: 'rascunho',
            nomeModulo: 'XML Rascunho',
            moduloConfig: 'rascunho',
            badgeClass: 'badge-origem-rasc',
            uploadEndpoint: '/upload_xml',
            defaultArquivoNome: 'Rascunho.xml',
            defaultCategoria: 'Geral',
            requireXmlOrItems: true,
            emptyItemsTitle: 'XML Não Carregado',
            emptyItemsMsg: 'Por favor, faça o upload de um XML de modelo ou carregue um rascunho com itens antes de gerar!',
            impostoDefaults: {
                csosn: '400',
                c_enq: '108',
                cst_ipi: '55',
                cst_pis: '08',
                cst_cofins: '08'
            },
            isRascunhoCompativel: function (origemRascunho) {
                if (!origemRascunho) return true;
                return origemRascunho === 'XML Rascunho';
            },
            onUploadSuccess: function (data, ctx) {
                const c = data.cabecalho || {};
                const r = data.rodape || {};
                const rateio = data.resumo_rateio || {};
                const infCplXml = (r && r.infCpl) ? r.infCpl : ((c && c.infCpl) ? c.infCpl : '');
                const matchPtax = infCplXml.match(/CAMBIO\s+PTAX\s*:\s*1\s+([A-Z]{3})\s*=\s*R\$\s*([\d.,]+)/i);
                if (matchPtax) {
                    const moedaDet = matchPtax[1].toUpperCase();
                    const taxaDet = matchPtax[2].trim();
                    if (typeof ctx.definirMoedaSelecionada === 'function') ctx.definirMoedaSelecionada(moedaDet);
                    ctx.setVal('ptax_taxa_utilizada', taxaDet);
                    if (!ctx.getVal('ptax_cotacao_venda')) {
                        ctx.setVal('ptax_cotacao_venda', taxaDet);
                    }
                } else if (rateio.ptax_cotacao_venda || c.ptax_cotacao_venda) {
                    const taxaC = rateio.ptax_cotacao_venda || c.ptax_cotacao_venda;
                    ctx.setVal('ptax_taxa_utilizada', taxaC);
                    ctx.setVal('ptax_cotacao_venda', taxaC);
                }
            }
        },

        nova_nf: {
            key: 'nova_nf',
            nomeModulo: 'Nova NF',
            moduloConfig: 'nova_nf',
            badgeClass: 'badge-origem-nova',
            uploadEndpoint: null,
            defaultArquivoNome: 'Nova_Nota.xml',
            defaultCategoria: 'Geral',
            requireXmlOrItems: false,
            emptyItemsTitle: 'Nenhum Item',
            emptyItemsMsg: 'A nota não possui nenhum item cadastrado. Adicione ou importe itens antes de gerar o XML!',
            impostoDefaults: {
                csosn: '102',
                c_enq: '102',
                cst_ipi: '05',
                cst_pis: '07',
                cst_cofins: '07'
            },
            isRascunhoCompativel: function (origemRascunho) {
                if (!origemRascunho) return true;
                return origemRascunho === 'Nova NF' || origemRascunho.includes('Nova');
            }
        },

        di_duimp: {
            key: 'di_duimp',
            nomeModulo: 'XML da DI ou DUIMP',
            moduloConfig: 'di_duimp',
            badgeClass: 'badge-origem-di',
            uploadEndpoint: '/upload_di_duimp',
            defaultArquivoNome: 'DI_DUIMP.xml',
            defaultCategoria: 'Importação',
            requireXmlOrItems: false,
            emptyItemsTitle: 'Nenhum Item',
            emptyItemsMsg: 'A nota não possui nenhum item cadastrado ou importado. Importe uma DI ou DUIMP antes de gerar o XML!',
            impostoDefaults: {
                csosn: '102',
                c_enq: '102',
                cst_ipi: '05',
                cst_pis: '07',
                cst_cofins: '07'
            },
            isRascunhoCompativel: function (origemRascunho) {
                if (!origemRascunho) return true;
                return origemRascunho === 'XML da DI ou DUIMP' ||
                    origemRascunho.includes('DI') ||
                    origemRascunho.includes('DUIMP');
            },
            onBeforeFillHeader: function (data, c) {
                if (c.referencia_interna || c.nDI || c.import_nDI) {
                    if (typeof global.definirReferenciaInterna === 'function') {
                        global.definirReferenciaInterna(c.referencia_interna || c.nDI || c.import_nDI);
                    }
                }
            },
            onUploadSuccess: function (data, ctx) {
                const c = data.cabecalho || {};
                const rateio = data.resumo_rateio || {};
                if (rateio.ptax_moeda || c.ptax_moeda) {
                    if (typeof ctx.definirMoedaSelecionada === 'function') {
                        ctx.definirMoedaSelecionada(rateio.ptax_moeda || c.ptax_moeda);
                    }
                }
                if (rateio.ptax_cotacao_venda || c.ptax_cotacao_venda) {
                    const taxaC = rateio.ptax_cotacao_venda || c.ptax_cotacao_venda;
                    ctx.setVal('ptax_cotacao_venda', taxaC);
                    ctx.setVal('ptax_taxa_utilizada', rateio.ptax_taxa_utilizada || taxaC);
                }
                if (!ctx.getVal('ptax_cotacao_venda') && typeof ctx.consultarCotacaoPtax === 'function') {
                    ctx.consultarCotacaoPtax(true);
                }
            }
        }
    };

    function detectarModoAtual() {
        if (global.NFT_EDITOR_MODO && MODOS[global.NFT_EDITOR_MODO]) {
            return MODOS[global.NFT_EDITOR_MODO];
        }
        const path = (global.location && global.location.pathname) ? global.location.pathname : '';
        if (path.includes('di_duimp') || path.includes('duimp')) return MODOS.di_duimp;
        if (path.includes('nova_nf')) return MODOS.nova_nf;
        return MODOS.rascunho;
    }

    global.NFT_EDITOR_MODOS = MODOS;
    global.getEditorModoConfig = detectarModoAtual;
    global.NOME_MODULO_ORIGEM = detectarModoAtual().nomeModulo;
})(window);
