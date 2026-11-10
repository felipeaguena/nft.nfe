/**
 * NFT LOGISTICS - GERENCIADOR DO MENU LATERAL (SIDEBAR) & CONTROLE DO SERVIDOR
 */

// === 1. CONTROLE DE ENCERRAMENTO DO SERVIDOR E FECHAMENTO DE JANELAS ===
(function() {
    let isShuttingDown = false;

    // Ajusta a proporção da janela do sistema para 1440x900 ao carregar
    try {
        if (!sessionStorage.getItem('nft_window_resized')) {
            if (window.resizeTo && (!window.outerWidth || window.outerWidth !== 1440 || window.outerHeight !== 900)) {
                window.resizeTo(1440, 900);
            }
            sessionStorage.setItem('nft_window_resized', 'true');
        }
    } catch(e) {}

    window.fecharJanelaCompleta = function() {
        window._nftIsShuttingDown = true;
        window.onbeforeunload = null;

        // Se houver qualquer elemento focado (ex: input digitando), desfoca para evitar bloqueio do navegador
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            try { document.activeElement.blur(); } catch(e) {}
        }

        // Tenta fechar a aba/janela por multiplas abordagens
        try { window.close(); } catch(e) {}
        try { window.open('', '_self', ''); window.close(); } catch(e) {}
        try { window.opener = null; window.open('', '_self'); window.close(); } catch(e) {}
        try { self.close(); } catch(e) {}
        try { if (window.top) window.top.close(); } catch(e) {}
        try { open(location, '_self').close(); } catch(e) {}

        // Fallback: se o navegador ainda assim bloquear o fechamento forçado, redireciona para tela em branco
        setTimeout(() => {
            try {
                window.location.replace("about:blank");
                window.close();
            } catch(e) {}
        }, 100);
    };

    window.showShutdownOverlay = function(title, msg, isSuccess) {
        let overlay = document.getElementById('nft-shutdown-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'nft-shutdown-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(8px);
                z-index: 999999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
                text-align: center;
                animation: fadeIn 0.25s ease-out;
            `;
            const parent = document.body || document.documentElement;
            if (parent) parent.appendChild(overlay);
        }

        const iconColor = isSuccess ? '#ef4444' : '#f59e0b';
        overlay.innerHTML = `
            <div style="background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px 44px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); max-width: 440px; margin: 16px;">
                <div style="width: 68px; height: 68px; border-radius: 50%; background: rgba(239,68,68,0.15); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: ${iconColor};">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                        <line x1="12" y1="2" x2="12" y2="12"></line>
                    </svg>
                </div>
                <h3 style="font-size: 21px; font-weight: 800; margin-bottom: 10px; color: #f8fafc;">${title}</h3>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">${msg}</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="fecharJanelaCompleta()" style="background: #ef4444; color: #fff; border: none; padding: 11px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                        Fechar Janela
                    </button>
                </div>
            </div>
        `;
    };

    window.encerrarServidor = async function() {
        const confirmar = await window.nftConfirm("Deseja realmente desligar o servidor do Emissor NF-e?", {
            title: "Desligar Servidor",
            type: "danger",
            confirmText: "Sim, Desligar",
            cancelText: "Cancelar",
            icon: "power"
        });
        if (confirmar) {
            window._nftIsShuttingDown = true;
            window.onbeforeunload = null;
            isShuttingDown = true;

            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                try { document.activeElement.blur(); } catch(e) {}
            }

            window.showShutdownOverlay("Encerrando Servidor...", "O backend na porta 1652 está sendo finalizado. Fechando a janela...", true);
            
            fetch('/api/shutdown', { method: 'POST' })
                .catch(() => {})
                .finally(() => {
                    setTimeout(() => {
                        window.fecharJanelaCompleta();
                    }, 300);
                });
        }
    };

    window.logoutSistema = async function() {
        try {
            sessionStorage.removeItem('nft_auth_user');
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch(e) {}
        window.location.href = '/login';
    };

    // Monitora a conexão do servidor (Heartbeat apenas em ambiente Desktop local)
    const isLocalDesktop = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalDesktop) {
        let offlineCount = 0;
        setInterval(() => {
            if (isShuttingDown) return;

            fetch('/api/ping', { method: 'GET', cache: 'no-store' })
                .then(res => {
                    if (res.ok) {
                        offlineCount = 0;
                    } else {
                        offlineCount++;
                    }
                })
                .catch(() => {
                    offlineCount++;
                    if (offlineCount >= 2 && !isShuttingDown) {
                        isShuttingDown = true;
                        window.showShutdownOverlay("Servidor Desligado", "O backend local foi finalizado. Fechando a janela...", true);
                        setTimeout(() => {
                            window.fecharJanelaCompleta();
                        }, 500);
                    }
                });
        }, 3500);
    }

    // Intercepta navegação interna do sistema para usar location.replace
    // Isso mantem history.length === 1 permanentemente, permitindo que window.close()
    // funcione com 100% de sucesso em qualquer tela (sem ser bloqueado pela politica de historico do Chromium).
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Ignora links externos, download, abas, modals, APIs ou novas abas
        if (link.target === '_blank' || link.hasAttribute('download') || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('/api')) {
            return;
        }

        // Se for rota interna do sistema
        if (href.startsWith('/') || href.startsWith(window.location.origin)) {
            e.preventDefault();
            window.location.replace(link.href);
        }
    });
})();

// === 2. GERENCIADOR DO MENU LATERAL (SIDEBAR) ===
(function () {
    const STORAGE_KEY = 'nft_sidebar_collapsed';

    // Cria e garante o backdrop para mobile
    function ensureMobileBackdrop() {
        let backdrop = document.querySelector('.nft-sidebar-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'nft-sidebar-backdrop';
            backdrop.setAttribute('aria-hidden', 'true');
            backdrop.onclick = window.closeMobileSidebar;
            document.body.appendChild(backdrop);
        } else {
            backdrop.onclick = window.closeMobileSidebar;
        }

        // Garante botão fechar (X) no topo da sidebar no mobile se não existir
        const header = document.querySelector('.nft-sidebar-header');
        if (header && !header.querySelector('.sidebar-mobile-close-btn')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'sidebar-mobile-close-btn';
            closeBtn.type = 'button';
            closeBtn.title = 'Fechar Menu';
            closeBtn.setAttribute('aria-label', 'Fechar Menu');
            closeBtn.innerHTML = '<i data-lucide="x"></i>';
            closeBtn.onclick = window.closeMobileSidebar;
            header.appendChild(closeBtn);
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }
    }

    // Funções de Controle Mobile (Aparece temporariamente ao clicar)
    window.openMobileSidebar = function() {
        if (!document.body) return;
        ensureMobileBackdrop();
        document.body.classList.add('sidebar-mobile-open');
    };

    window.closeMobileSidebar = function() {
        if (!document.body) return;
        document.body.classList.remove('sidebar-mobile-open');
    };

    window.toggleMobileSidebar = function() {
        if (!document.body) return;
        if (document.body.classList.contains('sidebar-mobile-open')) {
            window.closeMobileSidebar();
        } else {
            window.openMobileSidebar();
        }
    };

    // Inicializa Estado da Sidebar:
    // Mobile (< 992px): Sempre sem classes de recolhido; abre apenas temporariamente.
    // Outros aparelhos / Desktop (>= 992px): Padrão EXPANDIDO por padrão.
    // Recolhido apenas se o usuário tiver escolhido explicitamente.
    function initSidebarState() {
        if (!document.body) return;
        ensureMobileBackdrop();

        const isDesktop = window.innerWidth >= 992;
        if (isDesktop) {
            // Em desktop: expandido por padrão; se e somente se o usuário salvou 'true', recolhe
            const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
            if (isCollapsed) {
                document.body.classList.add('sidebar-collapsed');
            } else {
                document.body.classList.remove('sidebar-collapsed');
            }
            updateToggleButton(isCollapsed);
        } else {
            // Em mobile: nunca fica recolhido em mini-ícones, fecha o drawer temporário
            document.body.classList.remove('sidebar-collapsed');
            document.body.classList.remove('sidebar-mobile-open');
        }
    }

    // Alterna Estado Expandido / Recolhido (Somente quando acionado manualmente em Desktop)
    window.toggleSidebar = function () {
        if (!document.body) return;

        // Se estiver em mobile, toggleSidebar apenas abre/fecha o menu móvel temporário
        if (window.innerWidth < 992) {
            window.toggleMobileSidebar();
            return;
        }

        const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
        const nextState = !isCurrentlyCollapsed;

        if (nextState) {
            document.body.classList.add('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }

        localStorage.setItem(STORAGE_KEY, nextState ? 'true' : 'false');
        updateToggleButton(nextState);

        // Se existir tabela Handsontable ou Tabulator, redimensiona suavemente
        setTimeout(() => {
            if (window.hot && typeof window.hot.render === 'function') {
                window.hot.render();
            }
            if (window.itensTable && typeof window.itensTable.redraw === 'function') {
                window.itensTable.redraw(true);
            }
        }, 300);
    };

    function updateToggleButton(isCollapsed) {
        const btns = document.querySelectorAll('.sidebar-toggle-btn');
        btns.forEach(btn => {
            if (isCollapsed) {
                btn.innerHTML = '<i data-lucide="chevron-right"></i>';
                btn.title = 'Fixar Menu Lateral Aberto';
                btn.setAttribute('aria-label', 'Expandir Menu');
            } else {
                btn.innerHTML = '<i data-lucide="chevron-left"></i>';
                btn.title = 'Recolher Menu Lateral';
                btn.setAttribute('aria-label', 'Recolher Menu');
            }
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        const collapseTextEl = document.getElementById('sidebar-collapse-text');
        if (collapseTextEl) {
            collapseTextEl.innerText = isCollapsed ? 'Fixar Aberto' : 'Recolher Menu';
        }
    }

    // Sincronização de Abas (Cabeçalho, Itens, Identificação, SEFAZ, Configurações)
    window.sidebarSwitchTab = function (tabKey) {
        if (!tabKey) return;
        const key = String(tabKey).toLowerCase().trim();

        if (key.includes('tipo') || key.includes('imposto')) {
            if (typeof window.abrirModalTipoNota === 'function') {
                window.abrirModalTipoNota();
                return;
            }
        }

        // Resolução inteligente de qualquer alias para os IDs oficiais das abas do sistema
        let resolvedKey = key;
        if (key.includes('identifica') || key.includes('emit') || key.includes('dest') || key.includes('transp') || key === '2') {
            resolvedKey = 'identificacao';
        } else if (key.includes('item') || key.includes('prod') || key.includes('tot') || key === '3') {
            resolvedKey = 'itens';
        } else if (key.includes('sefaz') || key.includes('hist') || key === '4') {
            resolvedKey = 'historico-sefaz';
        } else if (key.includes('cabec') || key.includes('operac') || key.includes('export') || key === '1') {
            resolvedKey = 'cabecalho';
        }

        const targetTabBtn = document.getElementById(resolvedKey + '-tab');
        if (targetTabBtn) {
            if (window.bootstrap && bootstrap.Tab) {
                try {
                    const tabInstance = bootstrap.Tab.getOrCreateInstance(targetTabBtn);
                    tabInstance.show();
                } catch(e) {
                    targetTabBtn.click();
                }
            } else {
                targetTabBtn.click();
            }
        }

        // Força a transição segura dos tab-panes
        const targetPane = document.getElementById(resolvedKey);
        if (targetPane) {
            const tabContent = targetPane.closest('.tab-content') || document.getElementById('myTabContent');
            if (tabContent) {
                tabContent.querySelectorAll('.tab-pane').forEach(p => {
                    p.classList.remove('show', 'active');
                });
                targetPane.classList.add('show', 'active');
            }
        }

        // Sincroniza abas superiores nav-tabs
        const myTab = document.getElementById('myTab');
        if (myTab) {
            myTab.querySelectorAll('.nav-link').forEach(btn => {
                btn.classList.remove('active');
            });
            if (targetTabBtn) {
                targetTabBtn.classList.add('active');
            }
        }

        setActiveSidebarItem(resolvedKey);
    };

    function setActiveSidebarItem(tabKey) {
        const items = document.querySelectorAll('.nft-sidebar-btn');
        items.forEach(item => {
            const onclickAttr = item.getAttribute('onclick') || '';
            if (onclickAttr.includes(`sidebarSwitchTab('${tabKey}')`)) {
                item.classList.add('active');
            } else if (onclickAttr.includes('sidebarSwitchTab')) {
                item.classList.remove('active');
            }
        });
    }

    // Sincronização de Badges da Sidebar com os da Página
    function initBadgeObserver() {
        const itensBadgeMain = document.getElementById('itens-badge');
        const itensBadgeSidebar = document.getElementById('sidebar-itens-badge');

        if (itensBadgeMain && itensBadgeSidebar) {
            const observer = new MutationObserver(() => {
                itensBadgeSidebar.innerText = itensBadgeMain.innerText;
            });
            observer.observe(itensBadgeMain, { childList: true, characterData: true, subtree: true });
            itensBadgeSidebar.innerText = itensBadgeMain.innerText;
        }
    }

    // Listener para quando o usuário clicar diretamente nas abas superiores
    function initTabListeners() {
        const tabButtons = document.querySelectorAll('button[data-bs-toggle="tab"]');
        tabButtons.forEach(btn => {
            btn.addEventListener('shown.bs.tab', function (e) {
                const target = e.target.getAttribute('data-bs-target') || '';
                const tabKey = target.replace('#', '');
                if (tabKey) {
                    setActiveSidebarItem(tabKey);
                }
            });
        });
    }

    // Sincroniza o badge sob o logo da Sidebar com a tela ativa
    function syncSidebarBrandBadge() {
        const badgeEl = document.querySelector('.sidebar-brand-badge');
        if (!badgeEl) return;

        const path = (window.location.pathname || '/').toLowerCase();

        // Mapeamento específico por rota
        const routeMap = {
            '/': 'Portal NF-e',
            '/nova_nf': 'Nova NF',
            '/rascunho': 'XML Rascunho',
            '/editor': 'XML Rascunho',
            '/di_duimp': 'XML DI / DUIMP',
            '/duimp': 'XML DI / DUIMP',
            '/empresas': 'Empresas',
            '/banco_ncm': 'Tabela NCM',
            '/localidades': 'Localidades',
            '/feiras': 'Descrição da Feira'
        };

        if (routeMap[path]) {
            badgeEl.textContent = routeMap[path];
            return;
        }

        // Fallback: se houver botão ativo na sidebar
        const activeBtn = document.querySelector('.nft-sidebar-btn.active');
        if (activeBtn) {
            const labelEl = activeBtn.querySelector('.sidebar-label');
            if (labelEl) {
                const text = labelEl.textContent.trim();
                if (text.includes('Início') || text.includes('Portal')) {
                    badgeEl.textContent = 'Portal NF-e';
                } else if (text) {
                    badgeEl.textContent = text;
                }
            }
        }
    }

    // Executa ao carregar o DOM
    document.addEventListener('DOMContentLoaded', function () {
        initSidebarState();
        initTabListeners();
        initBadgeObserver();
        syncSidebarBrandBadge();

        // Detecta aba ativa inicial
        const activeTab = document.querySelector('.nav-tabs .nav-link.active');
        if (activeTab) {
            const target = activeTab.getAttribute('data-bs-target') || '';
            const tabKey = target.replace('#', '');
            if (tabKey) setActiveSidebarItem(tabKey);
        }

        // Garante fechamento do menu móvel ao clicar em itens ou links na sidebar
        document.addEventListener('click', function (e) {
            if (window.innerWidth < 992 && document.body.classList.contains('sidebar-mobile-open')) {
                const btnOrLink = e.target.closest('.nft-sidebar-btn, .sidebar-footer-btn, .sidebar-brand-link');
                if (btnOrLink) {
                    window.closeMobileSidebar();
                }
            }
        });

        // Monitora redimensionamento de janela entre mobile e desktop
        window.addEventListener('resize', function () {
            if (window.innerWidth >= 992) {
                document.body.classList.remove('sidebar-mobile-open');
                const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
                if (isCollapsed) {
                    document.body.classList.add('sidebar-collapsed');
                } else {
                    document.body.classList.remove('sidebar-collapsed');
                }
                updateToggleButton(isCollapsed);
            } else {
                document.body.classList.remove('sidebar-collapsed');
            }
        });

        // Garante renderização dos ícones Lucide na sidebar
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    });

    // Aplica estado antes do render final se body já estiver disponível
    if (document.body) {
        initSidebarState();
    }
})();

    // Abre o Modal de Rascunhos Salvos na tela atual ou redireciona
    window.abrirRascunhosOuRedirecionar = function () {
        if (typeof window.abrirModalListaRascunhos === 'function') {
            window.abrirModalListaRascunhos();
            return;
        }
        const modalEl = document.getElementById('modalListaRascunhos');
        if (modalEl) {
            const bModal = (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal : (typeof bootstrap !== 'undefined' ? bootstrap.Modal : null);
            if (bModal) {
                const m = bModal.getOrCreateInstance(modalEl);
                m.show();
            }
            if (typeof window.carregarListaRascunhos === 'function') {
                window.carregarListaRascunhos();
            }
            return;
        }
        // Se a página atual não possuir o modal de rascunhos (ex: relatórios, empresas, portal), redireciona para a tela de rascunhos abrindo o modal
        window.location.href = '/rascunho?abrir_rascunhos=1';
    };

    // Auto-carregamento do contador de rascunhos para a sidebar
    window.atualizarContadorRascunhosSidebar = async function () {
        try {
            const resp = await fetch('/api/rascunhos');
            const data = await resp.json();
            const total = (data.rascunhos || []).length;
            document.querySelectorAll('.badge-counter-rascunhos').forEach(el => {
                el.innerText = total;
            });
            const badgeSidebar = document.getElementById('sidebar-rascunhos-badge');
            if (badgeSidebar) badgeSidebar.innerText = total;
        } catch (e) {}
    };

    // Abre o Modal de Tipo de Nota (Impostos) ou redireciona para a tela principal
    window.abrirModalTipoNota = function () {
        const modalEl = document.getElementById('modalTipoNota');
        if (!modalEl) {
            window.location.href = '/rascunho?abrir_tipo_nota=1';
            return;
        }
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

    // Auto-abertura se vier com o parâmetro abrir_tipo_nota=1
    try {
        const _params = new URLSearchParams(window.location.search);
        if (_params.get('abrir_tipo_nota') === '1') {
            setTimeout(() => {
                if (typeof window.abrirModalTipoNota === 'function') {
                    window.abrirModalTipoNota();
                }
            }, 400);
        }
    } catch (e) {}



// === 3. BUSCA RÁPIDA NA SIDEBAR, ATALHO '/' E SINCRONIZAÇÃO DE TOPBAR ===
document.addEventListener('DOMContentLoaded', function () {
    // 1. Busca Instantânea na Sidebar
    const searchInput = document.getElementById('nftSidebarSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            const items = document.querySelectorAll('.nft-sidebar-item');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // 2. Atalho Teclado '/' para focar a busca
    document.addEventListener('keydown', function(e) {
        if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            const searchInput = document.getElementById('nftSidebarSearch');
            if (searchInput) {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        }
    });

    // 3. Sincronização do Breadcrumb do Topbar com a Referência Interna
    const refInput = document.getElementById('referenciaInterna');
    const topbarRef = document.getElementById('topbar-titulo-modulo');
    if (refInput && topbarRef) {
        if (refInput.value && refInput.value.trim()) {
            topbarRef.textContent = refInput.value.trim();
        }
        refInput.addEventListener('input', function() {
            topbarRef.textContent = this.value.trim() || 'NFT2600300-I REEXP';
        });
    }
});


// === 4. GERENCIADOR DE CERTIFICADOS DIGITAIS A1 (MODAL, SIDEBAR E SINCRONIZAÇÃO COM ABA 2) ===

window.carregarStatusCertificadoSidebar = async function () {
    try {
        const resp = await fetch('/api/certificado/status');
        const data = await resp.json();
        
        const empresaEl = document.getElementById('sidebar-cert-empresa');
        const validadeEl = document.getElementById('sidebar-cert-validade');
        const badgeEl = document.getElementById('sidebar-cert-badge');

        if (data && data.status === 'success') {
            let nomeEmpresa = data.assunto || 'Empresa Certificada';
            if (nomeEmpresa.includes('CN=')) {
                let cn = nomeEmpresa.split('CN=')[1].split(',')[0].trim();
                nomeEmpresa = cn.includes(':') ? cn.split(':')[0].trim() : cn;
            }

            let validadeFim = data.fim ? data.fim.split(' ')[0] : 'Indefinida';

            if (empresaEl) {
                empresaEl.textContent = nomeEmpresa;
                empresaEl.title = `${nomeEmpresa} (CNPJ: ${data.cnpj || 'Identificado'})`;
            }
            if (validadeEl) {
                validadeEl.textContent = validadeFim;
            }
            if (badgeEl) {
                badgeEl.textContent = 'Ativo';
                badgeEl.className = 'badge bg-success-subtle text-success small';
            }

            const aba2Container = document.getElementById('cert-info-container');
            if (aba2Container) {
                const emissorCurto = (data.emissor || '').includes('CN=') ? data.emissor.split('CN=')[1].split(',')[0].trim() : (data.emissor || 'Autoridade Certificadora');
                aba2Container.innerHTML = `
                    <div class="col-md-5">
                        <div class="small text-muted mb-1 fw-semibold">Empresa / Titular Ativo para Emissão</div>
                        <div class="fw-bold fs-6 text-dark text-truncate" id="aba2-cert-empresa" title="${nomeEmpresa}">
                            <i data-lucide="building-2" style="width: 15px; height: 15px; vertical-align: -2px; color: var(--primary);"></i> ${nomeEmpresa}
                        </div>
                        <div class="small text-muted font-monospace mt-1">
                            <i data-lucide="file-key" style="width: 12px; height: 12px;"></i> Arquivo: ${data.arquivo || 'Certificado A1'}
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="small text-muted mb-1 fw-semibold">CNPJ Titular</div>
                        <div class="fw-bold font-monospace text-primary fs-6">${data.cnpj || '47.998.441/0001-98'}</div>
                        <div class="small text-muted mt-1">Status: <span class="badge bg-success-subtle text-success fw-bold">Certificado Ativo</span></div>
                    </div>
                    <div class="col-md-4">
                        <div class="small text-muted mb-1 fw-semibold">Validade do Certificado</div>
                        <div class="fw-bold text-success">${data.fim}</div>
                        <div class="small text-muted mt-1">Emissor: <span class="font-monospace" style="font-size: 11px;">${emissorCurto}</span></div>
                    </div>
                `;
                if (window.lucide && typeof window.lucide.createIcons === 'function') {
                    window.lucide.createIcons();
                }
            }
        } else {
            if (empresaEl) empresaEl.textContent = 'Nenhum Certificado';
            if (badgeEl) {
                badgeEl.textContent = 'Pendente';
                badgeEl.className = 'badge bg-warning-subtle text-warning small';
            }
        }
    } catch (e) {
        console.warn('Aviso ao carregar status do certificado:', e);
    }
};

window.garantirModalGerenciarCertificados = function () {
    let modalEl = document.getElementById('modalGerenciarCertificados');
    if (!modalEl) {
        const modalHtml = `
<div class="modal fade" id="modalGerenciarCertificados" tabindex="-1" aria-labelledby="modalGerenciarCertificadosLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content shadow-lg border-0" style="border-radius: 16px; overflow: hidden;">
      <div class="modal-header border-bottom py-3 px-4 bg-body-tertiary">
        <div class="d-flex align-items-center gap-2">
          <div class="p-2 rounded-3 bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
            <i data-lucide="shield-check" style="width: 20px; height: 20px;"></i>
          </div>
          <div>
            <h5 class="modal-title fw-bold mb-0" id="modalGerenciarCertificadosLabel">Gerenciador de Certificados Digitais A1</h5>
            <div class="small text-muted" style="font-size: 12px;">Instale, gerencie e selecione o certificado ativo para emissão de NF-e e SEFAZ</div>
          </div>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
      </div>
      <div class="modal-body p-4">
        <!-- Card do Certificado Ativo -->
        <div class="p-3 mb-4 rounded-3 border bg-light" id="cert-modal-active-card">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="small fw-bold text-uppercase text-muted" style="letter-spacing: 0.05em; font-size: 11px;">Certificado Ativo no Momento</span>
            <span class="badge bg-success-subtle text-success fw-bold" id="cert-modal-active-badge">Em Uso</span>
          </div>
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h6 class="fw-bold mb-1 text-dark" id="cert-modal-active-empresa">Carregando...</h6>
              <div class="small text-muted font-monospace" id="cert-modal-active-detalhes">CNPJ: -- | Válido até: --</div>
            </div>
            <div class="small font-monospace text-muted" id="cert-modal-active-arquivo">Arquivo: --</div>
          </div>
        </div>

        <!-- Seção: Certificados Instalados no Sistema -->
        <div class="mb-4">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h6 class="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <i data-lucide="layers" style="width: 16px; height: 16px; color: var(--primary);"></i> Certificados Armazenados
            </h6>
            <button class="btn btn-sm btn-outline-secondary py-1 px-2 d-flex align-items-center gap-1" onclick="carregarListaCertificadosModal()" type="button" style="font-size: 11px; border-radius: 6px;">
              <i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i> Atualizar Lista
            </button>
          </div>
          <div class="table-responsive border rounded-3 bg-white">
            <table class="table table-hover align-middle mb-0" style="font-size: 12.5px;">
              <thead class="table-light text-muted small text-uppercase">
                <tr>
                  <th class="ps-3">Empresa / Titular</th>
                  <th>CNPJ</th>
                  <th>Validade</th>
                  <th>Arquivo</th>
                  <th class="text-end pe-3">Ação</th>
                </tr>
              </thead>
              <tbody id="tabela-certificados-corpo">
                <tr>
                  <td colspan="5" class="text-center py-3 text-muted small">Carregando certificados...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Seção: Instalar Novo Certificado Digital -->
        <div class="border rounded-3 p-3 bg-body-tertiary">
          <h6 class="fw-bold mb-2 text-dark d-flex align-items-center gap-2">
            <i data-lucide="plus-circle" style="width: 16px; height: 16px; color: #16A34A;"></i> Instalar Novo Certificado Digital (.pfx / .p12)
          </h6>
          <div class="row g-2 align-items-end">
            <div class="col-md-6">
              <label class="form-label small fw-bold mb-1">Arquivo do Certificado (.pfx ou .p12) *</label>
              <input type="file" class="form-control form-control-sm" id="inputModalNovoCertArquivo" accept=".pfx,.p12" style="height: 38px;">
            </div>
            <div class="col-md-4">
              <label class="form-label small fw-bold mb-1">Senha do Certificado *</label>
              <div class="input-group input-group-sm" style="height: 38px;">
                <input type="password" class="form-control" id="inputModalNovoCertSenha" placeholder="Senha do PFX" style="height: 100%;">
                <button class="btn btn-outline-secondary" type="button" onclick="alternarVisibilidadeSenhaModal()" style="height: 100%;">
                  <i data-lucide="eye" id="icone-olho-modal-cert" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </div>
            <div class="col-md-2">
              <button type="button" class="btn btn-primary btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-sm" id="btnInstalarNovoCert" onclick="submeterInstalacaoNovoCertificado()" style="height: 38px; border-radius: 8px;">
                <i data-lucide="upload" style="width: 14px; height: 14px;"></i> Instalar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer border-top py-2 px-4 bg-body-tertiary">
        <button type="button" class="btn btn-sm btn-secondary fw-semibold" data-bs-dismiss="modal" style="border-radius: 8px;">Fechar</button>
      </div>
    </div>
  </div>
</div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    return document.getElementById('modalGerenciarCertificados');
};

window.abrirModalGerenciarCertificados = async function () {
    const modalEl = window.garantirModalGerenciarCertificados();
    const bModal = (window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal : (typeof bootstrap !== 'undefined' ? bootstrap.Modal : null);
    if (bModal) {
        const m = bModal.getOrCreateInstance(modalEl);
        m.show();
    }
    await window.carregarListaCertificadosModal();
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
};

window.carregarListaCertificadosModal = async function () {
    try {
        const resp = await fetch('/api/certificado/listar');
        const data = await resp.json();
        const tbody = document.getElementById('tabela-certificados-corpo');
        if (!tbody) return;

        if (!data || !data.certificados || data.certificados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum certificado digital cadastrado na pasta de certificados. Use o formulário abaixo para instalar.</td></tr>`;
            return;
        }

        if (data.ativo) {
            const activeEmpresa = document.getElementById('cert-modal-active-empresa');
            const activeDetalhes = document.getElementById('cert-modal-active-detalhes');
            const activeArquivo = document.getElementById('cert-modal-active-arquivo');
            if (activeEmpresa) activeEmpresa.textContent = data.ativo.empresa || data.ativo.arquivo;
            if (activeDetalhes) activeDetalhes.textContent = `CNPJ: ${data.ativo.cnpj || 'N/A'} | Validade até: ${data.ativo.fim || 'N/A'}`;
            if (activeArquivo) activeArquivo.textContent = `Arquivo: ${data.ativo.arquivo}`;
        }

        let html = '';
        data.certificados.forEach(c => {
            const isAtivo = c.ativo;
            const rowClass = isAtivo ? 'table-success-subtle fw-semibold' : '';
            const statusBadge = isAtivo 
                ? '<span class="badge bg-success text-white py-1 px-2" style="font-size: 11px;"><i data-lucide="check" style="width: 12px; height: 12px; vertical-align: -1px;"></i> Em Uso (Ativo)</span>'
                : `<button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold" onclick="selecionarCertificadoParaUso('${c.arquivo}')" style="font-size: 11px; border-radius: 6px;">
                     <i data-lucide="check-circle-2" style="width: 12px; height: 12px; vertical-align: -1px;"></i> Selecionar para Uso
                   </button>`;

            const deleteBtn = isAtivo ? '' : `
                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1 ms-1" onclick="excluirCertificado('${c.arquivo}')" title="Excluir certificado" style="font-size: 11px; border-radius: 6px;">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                </button>
            `;

            html += `
                <tr class="${rowClass}">
                  <td class="ps-3">
                    <div class="fw-bold text-dark text-truncate" style="max-width: 220px;" title="${c.empresa}">
                      <i data-lucide="shield" style="width: 13px; height: 13px; vertical-align: -1px; color: ${isAtivo ? '#16A34A' : '#64748B'};"></i> ${c.empresa}
                    </div>
                  </td>
                  <td class="font-monospace small">${c.cnpj || '<span class="text-muted">Protegido</span>'}</td>
                  <td class="small">${c.fim ? c.fim.split(' ')[0] : '<span class="text-muted">--</span>'}</td>
                  <td class="font-monospace small text-muted text-truncate" style="max-width: 180px;" title="${c.arquivo}">${c.arquivo}</td>
                  <td class="text-end pe-3">
                    ${statusBadge}
                    ${deleteBtn}
                  </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (e) {
        console.error('Erro ao listar certificados no modal:', e);
    }
};

window.selecionarCertificadoParaUso = async function (arquivo) {
    try {
        const resp = await fetch('/api/certificado/selecionar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arquivo: arquivo })
        });
        const res = await resp.json();
        if (res.status === 'success') {
            await window.carregarStatusCertificadoSidebar();
            await window.carregarListaCertificadosModal();
            if (window.nftAlert) {
                await window.nftAlert(res.data.message || 'Certificado selecionado e ativado com sucesso!', {
                    title: 'Certificado Ativado!',
                    type: 'success',
                    icon: 'shield-check'
                });
            }
        } else {
            alert('Aviso: ' + (res.message || 'Erro ao selecionar certificado.'));
        }
    } catch (e) {
        alert('Erro ao selecionar certificado: ' + e.message);
    }
};

window.excluirCertificado = async function (arquivo) {
    if (!confirm(`Deseja realmente remover o certificado ${arquivo} do sistema?`)) return;
    try {
        const resp = await fetch('/api/certificado/excluir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arquivo: arquivo })
        });
        const res = await resp.json();
        if (res.status === 'success') {
            await window.carregarListaCertificadosModal();
        } else {
            alert(res.message || 'Erro ao excluir certificado.');
        }
    } catch (e) {
        alert('Erro ao excluir: ' + e.message);
    }
};

window.alternarVisibilidadeSenhaModal = function () {
    const input = document.getElementById('inputModalNovoCertSenha');
    const icone = document.getElementById('icone-olho-modal-cert');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icone) icone.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        if (icone) icone.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
};

window.submeterInstalacaoNovoCertificado = async function () {
    const fileInput = document.getElementById('inputModalNovoCertArquivo');
    const pwdInput = document.getElementById('inputModalNovoCertSenha');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    const senha = (pwdInput ? pwdInput.value : '').trim();

    if (!file) {
        alert('Por favor, selecione um arquivo de certificado (.pfx ou .p12).');
        return;
    }
    if (!senha) {
        alert('Por favor, informe a senha do certificado digital.');
        pwdInput.focus();
        return;
    }

    const btn = document.getElementById('btnInstalarNovoCert');
    if (btn) {
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Salvando...`;
        btn.disabled = true;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('senha', senha);

        const resp = await fetch('/api/certificado/importar', {
            method: 'POST',
            body: formData
        });
        const res = await resp.json();
        if (!resp.ok || res.status === 'error') {
            throw new Error(res.message || 'Erro ao instalar certificado.');
        }

        fileInput.value = '';
        pwdInput.value = '';

        await window.carregarStatusCertificadoSidebar();
        await window.carregarListaCertificadosModal();

        if (window.nftAlert) {
            await window.nftAlert(`Certificado ${res.assunto || 'novo'} instalado e ativado com sucesso!`, {
                title: 'Certificado Ativado!',
                type: 'success',
                icon: 'shield-check'
            });
        } else {
            alert('Certificado instalado e ativado com sucesso!');
        }
    } catch (e) {
        alert('Erro: ' + e.message);
    } finally {
        if (btn) {
            btn.innerHTML = `<i data-lucide="upload" style="width: 14px; height: 14px;"></i> Instalar`;
            btn.disabled = false;
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }
    }
};


// === 5. DROPDOWN DINÂMICO DE EMPRESA EMITENTE NO TOPBAR ===

window.carregarEmitentesTopbar = async function () {
    try {
        const resp = await fetch('/api/empresas');
        const empresas = await resp.json();
        const menuEl = document.getElementById('topbar-emitente-menu');
        if (!menuEl) return;

        let emitentes = empresas.filter(e => {
            const t = (e.tipo || '').toLowerCase();
            return t === 'emitente' || t === 'ambos' || t === 'filial' || t.includes('emit');
        });

        if (emitentes.length === 0) {
            emitentes = empresas;
        }

        let savedId = localStorage.getItem('nft_active_emitente_id');
        let activeEmp = emitentes.find(e => String(e.id) === String(savedId)) || emitentes[0];

        if (activeEmp) {
            window.atualizarVisualTopbarEmitente(activeEmp);
            // Se a tela tiver selecionarEmpresa e emit_CNPJ estiver vazio, sincroniza emitente
            try {
                const emitCnpjEl = document.getElementById('emit_CNPJ');
                if (emitCnpjEl && !emitCnpjEl.value.replace(/\D/g, '') && typeof window.selecionarEmpresa === 'function') {
                    window.selecionarEmpresa('emit', activeEmp.id);
                }
            } catch (eSync) {}
        }

        let html = `
            <li class="dropdown-header text-uppercase small fw-bold px-3 py-1 text-muted" style="font-size: 0.72rem; letter-spacing: 0.05em;">Empresas Emitentes Cadastradas</li>
            <li><hr class="dropdown-divider my-1"></li>
        `;

        emitentes.forEach(emp => {
            const isSelected = activeEmp && String(emp.id) === String(activeEmp.id);
            const apelidoStr = emp.apelido ? ` (${emp.apelido})` : '';
            let itemLogoSrc = emp.logo_url || '';
            const cnpjClean = (emp.cnpj_cpf || '').replace(/\D/g, '');
            if (!itemLogoSrc && (cnpjClean === '47998441000198' || (emp.nome || '').toUpperCase().includes('NFT'))) {
                itemLogoSrc = '/static/img/brand/NFTLogoBlackCompact.png';
            } else if (!itemLogoSrc && emp.id) {
                itemLogoSrc = `/api/empresas/${emp.id}/logo`;
            }
            const empInit = ((emp.nome || 'E').trim()[0] || 'E').toUpperCase();
            const thumbHtml = itemLogoSrc
                ? `<img src="${itemLogoSrc}" alt="" style="width: 26px; height: 26px; object-fit: contain; border-radius: 4px; border: 1px solid #E2E8F0; background: #fff; flex-shrink: 0;" onerror="this.outerHTML='<span class=\'badge bg-secondary-subtle text-secondary me-1 font-monospace\'>${empInit}</span>'">`
                : `<span class="badge bg-secondary-subtle text-secondary me-1 font-monospace" style="width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px;">${empInit}</span>`;

            html += `
                <li>
                    <a class="dropdown-item d-flex align-items-center justify-content-between py-2 px-3 ${isSelected ? 'active fw-bold' : ''}" href="javascript:void(0)" onclick="selecionarEmitenteTopbar('${emp.id}')">
                        <div class="d-flex align-items-center gap-2" style="max-width: 250px;">
                            ${thumbHtml}
                            <div class="d-flex flex-column text-truncate">
                                <span class="text-truncate" style="font-size: 12.5px;">${emp.nome}${apelidoStr}</span>
                                <span class="text-muted font-monospace small" style="font-size: 11px;">${emp.cnpj_cpf || ''}</span>
                            </div>
                        </div>
                        ${isSelected ? '<i data-lucide="check" style="width: 14px; height: 14px; color: #2563EB;"></i>' : ''}
                    </a>
                </li>
            `;
        });

        html += `
            <li><hr class="dropdown-divider my-1"></li>
            <li>
                <a class="dropdown-item py-1 px-3 text-primary fw-semibold small d-flex align-items-center gap-2" href="/empresas">
                    <i data-lucide="plus-circle" style="width: 13px; height: 13px;"></i> Gerenciar Empresas...
                </a>
            </li>
        `;

        menuEl.innerHTML = html;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (e) {
        console.warn('Aviso ao carregar emitentes para o topbar:', e);
    }
};

window.atualizarVisualTopbarEmitente = function (emp) {
    if (!emp) return;
    const nomeEl = document.getElementById('topbar-emitente-nome');
    const cnpjEl = document.getElementById('topbar-emitente-cnpj');
    if (nomeEl) {
        nomeEl.textContent = emp.nome || 'Empresa Emitente';
        nomeEl.title = emp.nome || '';
    }
    if (cnpjEl) {
        cnpjEl.textContent = emp.cnpj_cpf || '';
    }

    // Atualiza a div com class="nft-brand-icon" substituindo a letra do nome pelo logotipo da Empresa emitente
    const brandIcons = document.querySelectorAll('.nft-brand-icon');
    if (brandIcons.length > 0) {
        let logoSrc = emp.logo_url || '';
        const cnpjClean = (emp.cnpj_cpf || '').replace(/\D/g, '');
        const isNFT = cnpjClean === '47998441000198' || (emp.nome || '').toUpperCase().includes('NFT');

        if (!logoSrc && isNFT) {
            logoSrc = '/static/img/brand/NFTLogoBlackCompact.png';
        } else if (!logoSrc && emp.id) {
            logoSrc = `/api/empresas/${emp.id}/logo?v=${Date.now()}`;
        }

        const initialChar = ((emp.nome || 'N').trim()[0] || 'N').toUpperCase();

        brandIcons.forEach(iconEl => {
            if (logoSrc) {
                iconEl.innerHTML = `<img src="${logoSrc}" alt="${emp.nome || 'Emitente'}" style="width: 100%; height: 100%; object-fit: contain; background: #ffffff; border-radius: 6px; padding: 2px;" onerror="this.onerror=null; this.parentElement.textContent='${initialChar}';">`;
                iconEl.title = emp.nome || '';
                iconEl.style.backgroundColor = '#FFFFFF';
                iconEl.style.border = '1px solid #E2E8F0';
            } else {
                iconEl.textContent = initialChar;
                iconEl.title = emp.nome || '';
                iconEl.style.backgroundColor = '#0F172A';
                iconEl.style.border = 'none';
            }
        });
    }
};

window.selecionarEmitenteTopbar = async function (id) {
    try {
        localStorage.setItem('nft_active_emitente_id', id);
        if (typeof window.selecionarEmpresa === 'function') {
            window.selecionarEmpresa('emit', id);
        }
        await window.carregarEmitentesTopbar();
    } catch (e) {
        console.error('Erro ao selecionar emitente no topbar:', e);
    }
};

// === 6. USUÁRIO AUTENTICADO NO TOPBAR & CONTROLE DE ACESSO RBAC ===
window.carregarUsuarioAutenticadoTopbar = async function (forceFresh = false) {
    try {
        // 1. Aplica do cache para renderização imediata sem flicker
        if (!forceFresh) {
            const cachedUserStr = sessionStorage.getItem('nft_auth_user');
            if (cachedUserStr) {
                try {
                    const cachedUser = JSON.parse(cachedUserStr);
                    window.aplicarDadosUsuarioTopbar(cachedUser);
                    window.aplicarControleAcessoRBAC(cachedUser);
                } catch(e) {}
            }
        }

        // 2. Sincroniza dados frescos do servidor
        const resp = await fetch('/api/auth/me');
        if (resp.ok) {
            const data = await resp.json();
            if (data.status === 'success' && data.user) {
                sessionStorage.setItem('nft_auth_user', JSON.stringify(data.user));
                window.aplicarDadosUsuarioTopbar(data.user);
                window.aplicarControleAcessoRBAC(data.user);
            }
        }
    } catch (e) {
        console.warn('Aviso ao carregar dados do usuário autenticado:', e);
    }
};

window.aplicarDadosUsuarioTopbar = function (user) {
    if (!user) return;
    
    // Localiza a div do usuário autenticado no Topbar
    const userPill = document.getElementById('topbar-user-pill') || 
                     document.querySelector('.nft-topbar-pill[title*="Usuário"]') ||
                     document.querySelector('.nft-topbar-pill[title*="Autenticado"]') ||
                     document.querySelector('.nft-topbar-right .nft-topbar-pill:last-child');
    
    if (!userPill) return;

    // Atualiza o título da div
    const roleTitle = (user.role === 'admin') 
        ? "Usuário Administrador Autenticado" 
        : "Usuário Operador Autenticado";
    userPill.setAttribute('title', roleTitle);

    // Substitui o "Admin" pelo nome do usuário autenticado
    const nomeEl = document.getElementById('topbar-user-name') || 
                   userPill.querySelector('span');
    if (nomeEl && user.name) {
        nomeEl.textContent = user.name;
        nomeEl.style.maxWidth = '150px';
        nomeEl.style.overflow = 'hidden';
        nomeEl.style.textOverflow = 'ellipsis';
        nomeEl.style.whiteSpace = 'nowrap';
        nomeEl.style.display = 'inline-block';
        nomeEl.style.verticalAlign = 'middle';
    }

    // Atualiza a foto / avatar
    let avatarWrap = document.getElementById('topbar-user-avatar-wrap') || 
                     userPill.querySelector('div') || 
                     userPill.firstElementChild;
    
    const initials = (user.name || user.email || 'A').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();

    if (avatarWrap) {
        if (user.photo_url) {
            avatarWrap.innerHTML = `
                <img src="${user.photo_url}" alt="${user.name || 'Avatar'}" 
                     style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; display: block; flex-shrink: 0;" 
                     onerror="this.onerror=null; this.parentElement.innerHTML='${initials}';" />
            `;
            avatarWrap.style.padding = '0';
            avatarWrap.style.overflow = 'hidden';
            avatarWrap.style.border = '1px solid rgba(0,0,0,0.15)';
        } else {
            avatarWrap.innerHTML = initials;
            avatarWrap.style.background = '#0F172A';
            avatarWrap.style.color = '#FFFFFF';
            avatarWrap.style.display = 'flex';
            avatarWrap.style.alignItems = 'center';
            avatarWrap.style.justifyContent = 'center';
            avatarWrap.style.fontSize = '11px';
            avatarWrap.style.fontWeight = '700';
            avatarWrap.style.width = '24px';
            avatarWrap.style.height = '24px';
            avatarWrap.style.borderRadius = '50%';
        }
    }
};

window.aplicarControleAcessoRBAC = function (user) {
    if (!user) return;
    const path = window.location.pathname.toLowerCase();
    const isAdmin = (user.role === 'admin');

    if (!isAdmin) {
        // === RESTRIÇÕES PARA OPERADOR / EMISSOR ===
        // 1. Páginas de Configurações: Acesso somente para consulta
        const isConfigPage = (
            path.includes('/usuarios') ||
            path.includes('/empresas') ||
            path.includes('/feiras') ||
            path.includes('/localidades') ||
            path.includes('/unidades_tributaveis') ||
            path.includes('/banco_ncm')
        );

        if (isConfigPage) {
            // Desabilita ou oculta botões de criação
            const btnNovos = document.querySelectorAll('button[onclick*="abrirModalNovo"], button[onclick*="abrirModalNova"], button[onclick*="criar"], button[onclick*="Adicionar"], button[onclick*="abrirModalCriar"]');
            btnNovos.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.title = 'Apenas Administradores podem adicionar novos registros de configuração.';
            });

            // Insere aviso de modo de consulta no topo
            let alertBox = document.getElementById('nft-rbac-readonly-alert');
            if (!alertBox) {
                const headerContainer = document.querySelector('.container-fluid') || document.querySelector('.nft-main-wrapper');
                if (headerContainer) {
                    alertBox = document.createElement('div');
                    alertBox.id = 'nft-rbac-readonly-alert';
                    alertBox.className = 'alert alert-info d-flex align-items-center gap-2 py-2 px-3 mb-3 shadow-sm';
                    alertBox.style.cssText = 'border-radius: 10px; font-size: 0.82rem; border-left: 4px solid #0284c7; background-color: rgba(2,132,199,0.08);';
                    alertBox.innerHTML = `
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        <div>
                            <strong>Modo Consulta (Operador / Emissor):</strong> Você possui acesso para visualização das configurações. Apenas Administradores podem alterar, incluir ou excluir dados.
                        </div>
                    `;
                    const firstCard = headerContainer.querySelector('.d-flex.justify-content-between') || headerContainer.firstElementChild;
                    if (firstCard && firstCard.parentNode) {
                        firstCard.parentNode.insertBefore(alertBox, firstCard.nextSibling);
                    }
                }
            }

            // Desabilita botões de edição e exclusão de tabelas
            const desabilitarBotoesAcaoTabela = () => {
                // Na tela de usuários, permite editar apenas o seu próprio perfil se for ele mesmo
                const actionBtns = document.querySelectorAll('button[onclick*="excluir"], button[onclick*="delete"], button[onclick*="deletar"]');
                actionBtns.forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.4';
                    btn.title = 'Apenas Administradores podem excluir dados de configuração.';
                });
            };
            desabilitarBotoesAcaoTabela();
            setTimeout(desabilitarBotoesAcaoTabela, 600);
            setTimeout(desabilitarBotoesAcaoTabela, 1600);
        }

        // 2. Relatório de Notas Fiscais
        if (path.includes('/relatorios')) {
            const desabilitarEdicaoRelatorio = () => {
                // Desabilita clique para editar Referência Interna
                const refTags = document.querySelectorAll('.ref-tag');
                refTags.forEach(tag => {
                    tag.removeAttribute('onclick');
                    tag.style.cursor = 'default';
                    tag.style.pointerEvents = 'none';
                    tag.title = 'Referência Interna (Apenas Administrador pode editar)';
                });

                // Desabilita botões de excluir/cancelar nota no relatório
                const deleteBtns = document.querySelectorAll('button[onclick*="excluirNota"], button[onclick*="excluir_nota"]');
                deleteBtns.forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.4';
                    btn.title = 'Apenas Administradores podem excluir ou alterar notas do relatório.';
                });
            };
            desabilitarEdicaoRelatorio();
            setTimeout(desabilitarEdicaoRelatorio, 600);
            setTimeout(desabilitarEdicaoRelatorio, 1600);
            setTimeout(desabilitarEdicaoRelatorio, 3000);
        }
    }
};

document.addEventListener('DOMContentLoaded', function () {
    window.carregarStatusCertificadoSidebar();
    window.carregarEmitentesTopbar();
    window.carregarUsuarioAutenticadoTopbar();
    window.atualizarContadorRascunhosSidebar();

    // Inicialização global de tooltips Bootstrap em todos os elementos com data-bs-toggle="tooltip"
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl, {
                    trigger: 'hover',
                    boundary: 'window'
                });
            });
        }
    } catch (e) {
        console.warn('Erro ao inicializar tooltips:', e);
    }
});
