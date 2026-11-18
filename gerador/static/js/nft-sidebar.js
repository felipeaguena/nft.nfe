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

    // Redireciona para a página dedicada de Rascunhos Salvos
    window.abrirRascunhosOuRedirecionar = function () {
        window.location.href = '/rascunhos_salvos';
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

    // Redireciona para a página independente de Tipo de Nota (Impostos & Regras Padrão)
    window.abrirModalTipoNota = function () {
        window.location.href = '/tipo_nota';
    };

    // Compatibilidade com links antigos (?abrir_tipo_nota=1)
    try {
        const _params = new URLSearchParams(window.location.search);
        if (_params.get('abrir_tipo_nota') === '1') {
            window.location.replace('/tipo_nota');
        }
    } catch (e) {}



// === 3. BUSCA RÁPIDA GLOBAL NA SIDEBAR, ATALHO '/' / 'CTRL+K' E SINCRONIZAÇÃO DE TOPBAR ===
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('nftSidebarSearch');
    let dropdownEl = null;
    let debounceTimer = null;
    let abortCtrl = null;
    let activeIdx = -1;

    function escHtml(str) {
        return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function ensureDropdown() {
        if (dropdownEl && dropdownEl.parentElement) return dropdownEl;
        dropdownEl = document.createElement('div');
        dropdownEl.id = 'nft-global-search-dropdown';
        dropdownEl.style.cssText = [
            'position: absolute',
            'top: calc(100% + 6px)',
            'left: 0',
            'right: 0',
            'width: 100%',
            'z-index: 1080',
            'max-height: 380px',
            'overflow-y: auto',
            'background: var(--surface, #ffffff)',
            'color: var(--foreground, #0f172a)',
            'border: 1px solid var(--border, #e2e8f0)',
            'border-radius: 12px',
            'box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18)',
            'padding: 6px',
            'display: none',
            'font-size: 12px'
        ].join(';');
        const searchWrap = searchInput?.closest('.nft-sidebar-search') || searchInput?.parentElement;
        if (searchWrap) {
            if (getComputedStyle(searchWrap).position === 'static') {
                searchWrap.style.position = 'relative';
            }
            searchWrap.appendChild(dropdownEl);
        } else {
            document.body.appendChild(dropdownEl);
        }
        return dropdownEl;
    }

    function positionDropdown() {
        // Posicionamento relativo ao container .nft-sidebar-search (position: absolute embaixo do input)
    }

    function hideDropdown() {
        if (dropdownEl) {
            dropdownEl.style.display = 'none';
            dropdownEl.innerHTML = '';
        }
        activeIdx = -1;
    }

    function filtrarMenuSidebar(query) {
        const q = (query || '').toLowerCase().trim();
        const matchedMenus = [];
        if (!q) return matchedMenus;

        const items = document.querySelectorAll('.nft-sidebar-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const link = item.querySelector('a.nft-sidebar-btn, button.nft-sidebar-btn');
            if (text.includes(q) && link && link.getAttribute('href') && !link.getAttribute('href').startsWith('#')) {
                matchedMenus.push({
                    label: (item.querySelector('.sidebar-label')?.textContent || item.textContent).trim(),
                    href: link.getAttribute('href')
                });
            }
        });

        return matchedMenus.slice(0, 4);
    }

    function updateActiveHighlight() {
        if (!dropdownEl) return;
        const rows = dropdownEl.querySelectorAll('.nft-gs-item');
        rows.forEach((r, idx) => {
            if (idx === activeIdx) {
                r.style.background = 'var(--primary-subtle, rgba(37,99,235,0.12))';
            } else {
                r.style.background = 'transparent';
            }
        });
    }

    function renderDropdown(query, matchedMenus, apiData, isLoading) {
        const dd = ensureDropdown();
        const q = (query || '').trim();
        if (!q) {
            hideDropdown();
            return;
        }

        let html = '';

        if (matchedMenus.length > 0) {
            html += `<div class="px-2 py-1 text-uppercase fw-bold text-muted" style="font-size: 10px; letter-spacing: 0.04em;">Módulos & Páginas</div>`;
            matchedMenus.forEach(m => {
                html += `
                    <a href="${escHtml(m.href)}" class="nft-gs-item d-flex align-items-center justify-content-between px-2 py-1 rounded text-decoration-none" style="color: inherit;">
                        <span class="fw-semibold text-truncate">${escHtml(m.label)}</span>
                        <span class="badge bg-primary-subtle text-primary" style="font-size: 10px;">Página</span>
                    </a>
                `;
            });
        }

        if (isLoading) {
            html += `<div class="px-2 py-2 text-muted small d-flex align-items-center gap-2"><span class="spinner-border spinner-border-sm"></span> Buscando notas, rascunhos e empresas...</div>`;
        } else if (apiData) {
            const notas = apiData.notas || [];
            const rascunhos = apiData.rascunhos || [];
            const empresas = apiData.empresas || [];

            if (notas.length > 0) {
                html += `<div class="px-2 pt-2 pb-1 text-uppercase fw-bold text-muted border-top mt-1" style="font-size: 10px; letter-spacing: 0.04em;">Notas Fiscais</div>`;
                notas.forEach(n => {
                    const urlDestino = n.numero_nfe
                        ? `/relatorios?numero_nfe=${encodeURIComponent(n.numero_nfe)}`
                        : `/relatorios?search=${encodeURIComponent(n.chave_nfe || n.referencia_interna || q)}`;
                    const ambTxt = String(n.ambiente) === '1' ? 'Prod' : 'Homolog';
                    const titulo = `NF ${n.numero_nfe || '-'} ${n.referencia_interna ? '• ' + n.referencia_interna : ''}`;
                    html += `
                        <a href="${urlDestino}" class="nft-gs-item d-flex align-items-center justify-content-between px-2 py-1 rounded text-decoration-none" style="color: inherit;">
                            <div class="text-truncate me-2">
                                <div class="fw-semibold text-truncate">${escHtml(titulo)}</div>
                                <div class="text-muted text-truncate" style="font-size: 10.5px;">${escHtml(n.status || 'Gerada')} • ${ambTxt}</div>
                            </div>
                            <span class="badge bg-info-subtle text-info" style="font-size: 10px;">NF-e</span>
                        </a>
                    `;
                });
            }

            if (rascunhos.length > 0) {
                html += `<div class="px-2 pt-2 pb-1 text-uppercase fw-bold text-muted border-top mt-1" style="font-size: 10px; letter-spacing: 0.04em;">Rascunhos Salvos</div>`;
                rascunhos.forEach(r => {
                    const orig = String(r.origem || '');
                    const rota = orig === 'Nova NF' ? '/nova_nf' : (orig.includes('DI') ? '/di_duimp' : '/rascunho');
                    html += `
                        <a href="${rota}?carregar_rascunho=${encodeURIComponent(r.id)}" class="nft-gs-item d-flex align-items-center justify-content-between px-2 py-1 rounded text-decoration-none" style="color: inherit;">
                            <div class="text-truncate me-2">
                                <div class="fw-semibold text-truncate">${escHtml(r.referencia_interna || ('Rascunho #' + r.id))}</div>
                                <div class="text-muted text-truncate" style="font-size: 10.5px;">${escHtml(orig || 'Rascunho')}</div>
                            </div>
                            <span class="badge bg-warning-subtle text-warning" style="font-size: 10px;">Rascunho</span>
                        </a>
                    `;
                });
            }

            if (empresas.length > 0) {
                html += `<div class="px-2 pt-2 pb-1 text-uppercase fw-bold text-muted border-top mt-1" style="font-size: 10px; letter-spacing: 0.04em;">Empresas / Cadastros</div>`;
                empresas.forEach(emp => {
                    html += `
                        <a href="/empresas?q=${encodeURIComponent(emp.nome || emp.cnpj_cpf || '')}" class="nft-gs-item d-flex align-items-center justify-content-between px-2 py-1 rounded text-decoration-none" style="color: inherit;">
                            <div class="text-truncate me-2">
                                <div class="fw-semibold text-truncate">${escHtml(emp.nome || '-')}</div>
                                <div class="text-muted text-truncate" style="font-size: 10.5px;">${escHtml(emp.tipo || '')} ${emp.cnpj_cpf ? '• ' + escHtml(emp.cnpj_cpf) : ''}</div>
                            </div>
                            <span class="badge bg-secondary-subtle text-secondary" style="font-size: 10px;">Empresa</span>
                        </a>
                    `;
                });
            }
        }

        if (!html) {
            html = `<div class="px-2 py-2 text-muted small text-center">Nenhum resultado para "${escHtml(q)}".</div>`;
        }

        dd.innerHTML = html;
        dd.style.display = 'block';
        positionDropdown();

        const items = dd.querySelectorAll('.nft-gs-item');
        activeIdx = items.length > 0 ? 0 : -1;
        updateActiveHighlight();
    }

    function limparBuscaRapida() {
        if (!searchInput) return;
        searchInput.value = '';
        filtrarMenuSidebar('');
        hideDropdown();
        searchInput.blur();
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const q = this.value.trim();
            const matchedMenus = filtrarMenuSidebar(q);

            clearTimeout(debounceTimer);
            if (abortCtrl) {
                try { abortCtrl.abort(); } catch (e) {}
            }

            if (!q) {
                hideDropdown();
                return;
            }

            if (q.length < 2) {
                renderDropdown(q, matchedMenus, null, false);
                return;
            }

            renderDropdown(q, matchedMenus, null, true);
            debounceTimer = setTimeout(async () => {
                try {
                    abortCtrl = new AbortController();
                    const resp = await fetch(`/api/busca-rapida?q=${encodeURIComponent(q)}`, { signal: abortCtrl.signal });
                    const data = await resp.json();
                    if (searchInput.value.trim() === q) {
                        renderDropdown(q, matchedMenus, data, false);
                    }
                } catch (e) {
                    if (e.name !== 'AbortError') {
                        renderDropdown(q, matchedMenus, null, false);
                    }
                }
            }, 350);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                limparBuscaRapida();
                return;
            }
            if (!dropdownEl || dropdownEl.style.display === 'none') return;
            const items = dropdownEl.querySelectorAll('.nft-gs-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIdx = (activeIdx + 1) % items.length;
                updateActiveHighlight();
                items[activeIdx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIdx = (activeIdx - 1 + items.length) % items.length;
                updateActiveHighlight();
                items[activeIdx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) {
                e.preventDefault();
                items[activeIdx].click();
            }
        });

        document.addEventListener('click', function (e) {
            if (dropdownEl && dropdownEl.style.display !== 'none') {
                if (!dropdownEl.contains(e.target) && e.target !== searchInput) {
                    hideDropdown();
                }
            }
        });
    }

    // 2. Atalho Teclado '/' ou 'Ctrl+K' para focar a busca (expande sidebar se recolhida)
    document.addEventListener('keydown', function (e) {
        const isSlash = (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName));
        const isCtrlK = ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');
        if (isSlash || isCtrlK) {
            if (searchInput) {
                e.preventDefault();
                const sidebar = document.getElementById('nftSidebar');
                if (sidebar && sidebar.classList.contains('collapsed') && typeof window.toggleSidebar === 'function') {
                    window.toggleSidebar();
                }
                setTimeout(() => {
                    searchInput.focus();
                    searchInput.select();
                }, 60);
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

window.aplicarDadosCertificadoSidebar = function (data) {
    const empresaEl = document.getElementById('sidebar-cert-empresa');
    const validadeEl = document.getElementById('sidebar-cert-validade');
    const badgeEl = document.getElementById('sidebar-cert-badge');

    if (data && (data.status === 'success' || data.fim || data.empresa || data.assunto)) {
        let nomeEmpresa = data.empresa || data.assunto || 'Empresa Certificada';
        if (nomeEmpresa.includes('CN=')) {
            let cn = nomeEmpresa.split('CN=')[1].split(',')[0].trim();
            nomeEmpresa = cn.includes(':') ? cn.split(':')[0].trim() : cn;
        }

        let validadeFim = data.fim ? data.fim.split(' ')[0] : '-';

        if (empresaEl) {
            empresaEl.textContent = nomeEmpresa;
            empresaEl.title = `${nomeEmpresa} (CNPJ: ${data.cnpj || 'Identificado'})`;
        }
        if (validadeEl) {
            validadeEl.textContent = validadeFim;
        }
        if (badgeEl) {
            let badgeText = 'Ativo';
            let badgeClass = 'badge bg-success-subtle text-success small';
            let badgeStyle = 'font-size: 0.6rem; padding: 2px 5px;';

            if (validadeFim && validadeFim.includes('/')) {
                const partes = validadeFim.split('/');
                if (partes.length === 3) {
                    const dia = parseInt(partes[0], 10);
                    const mes = parseInt(partes[1], 10) - 1;
                    const ano = parseInt(partes[2], 10);
                    if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
                        const dataVal = new Date(ano, mes, dia, 23, 59, 59);
                        const diffDias = Math.ceil((dataVal.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (diffDias < 0) {
                            badgeText = 'Vencido';
                            badgeClass = 'badge bg-danger-subtle text-danger small';
                        } else if (diffDias <= 30) {
                            badgeText = 'Vence em breve';
                            badgeClass = 'badge small';
                            badgeStyle = 'font-size: 0.6rem; padding: 2px 5px; background-color: #FFEDD5; color: #C2410C;';
                        }
                    }
                }
            }
            badgeEl.textContent = badgeText;
            badgeEl.className = badgeClass;
            badgeEl.setAttribute('style', badgeStyle);
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
                    <div class="fw-bold font-monospace text-primary fs-6">${data.cnpj || '-'}</div>
                    <div class="small text-muted mt-1">Status: <span class="badge bg-success-subtle text-success fw-bold">Certificado Ativo</span></div>
                </div>
                <div class="col-md-4">
                    <div class="small text-muted mb-1 fw-semibold">Validade do Certificado</div>
                    <div class="fw-bold text-success">${data.fim || '-'}</div>
                    <div class="small text-muted mt-1">Emissor: <span class="font-monospace" style="font-size: 11px;">${emissorCurto}</span></div>
                </div>
            `;
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }
        return true;
    }

    if (empresaEl) {
        empresaEl.textContent = 'Nenhum Certificado';
        empresaEl.title = 'Nenhum Certificado';
    }
    if (validadeEl) validadeEl.textContent = '-';
    if (badgeEl) {
        badgeEl.textContent = 'Pendente';
        badgeEl.className = 'badge bg-warning-subtle text-warning small';
        badgeEl.setAttribute('style', 'font-size: 0.6rem; padding: 2px 5px;');
    }
    const aba2Container = document.getElementById('cert-info-container');
    if (aba2Container) {
        aba2Container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-warning py-2 px-3 mb-0 d-flex align-items-center gap-2">
                    <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i>
                    <span>Nenhum certificado ativo no momento. Clique em "Gerenciar Certificados" para instalar ou selecionar.</span>
                </div>
            </div>
        `;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }
    return false;
};

window.carregarStatusCertificadoSidebar = async function (tentativa = 0) {
    try {
        const resp = await fetch('/api/certificado/status', { cache: 'no-store' });
        let data = null;
        if (resp.ok) {
            try { data = await resp.json(); } catch (_) { data = null; }
        }

        if (data && data.status === 'success') {
            window.aplicarDadosCertificadoSidebar(data);
            return;
        }

        // Fallback: sincroniza diretamente com /api/certificado/listar (mesma fonte do Gerenciador)
        const respList = await fetch('/api/certificado/listar', { cache: 'no-store' });
        if (respList.ok) {
            const listData = await respList.json();
            const ativo = (listData && listData.ativo) || (listData && Array.isArray(listData.certificados) ? listData.certificados.find(c => c.ativo) : null);
            if (ativo && (ativo.fim || ativo.empresa)) {
                window.aplicarDadosCertificadoSidebar({
                    status: 'success',
                    empresa: ativo.empresa,
                    assunto: ativo.empresa,
                    cnpj: ativo.cnpj,
                    fim: ativo.fim,
                    emissor: ativo.emissor,
                    arquivo: ativo.arquivo
                });
                return;
            }
        }

        if ((!resp.ok || !respList.ok) && tentativa < 1) {
            setTimeout(() => window.carregarStatusCertificadoSidebar(tentativa + 1), 1500);
            return;
        }

        window.aplicarDadosCertificadoSidebar(null);
    } catch (e) {
        console.warn('Aviso ao carregar status do certificado:', e);
        if (tentativa < 1) {
            setTimeout(() => window.carregarStatusCertificadoSidebar(tentativa + 1), 1500);
            return;
        }
        window.aplicarDadosCertificadoSidebar(null);
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
            <span class="badge rounded-pill bg-success-subtle text-success fw-bold" id="cert-modal-active-badge" style="font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem;">Em Uso</span>
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
            <button class="btn btn-sm btn-outline-secondary rounded-pill d-inline-flex align-items-center gap-1 fw-bold" onclick="carregarListaCertificadosModal()" type="button" style="font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem;">
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
          <div class="row g-2 align-items-center">
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
              <button type="button" class="btn btn-primary btn-sm w-100 rounded-pill fw-bold d-inline-flex align-items-center justify-content-center gap-1 shadow-sm" id="btnInstalarNovoCert" onclick="submeterInstalacaoNovoCertificado()" style="font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem; height: 38px;">
                <i data-lucide="upload" style="width: 14px; height: 14px;"></i> Instalar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer border-top py-2 px-4 bg-body-tertiary">
        <button type="button" class="btn btn-sm btn-secondary rounded-pill fw-bold" data-bs-dismiss="modal" style="font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem;">Fechar</button>
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
    const tbody = document.getElementById('tabela-certificados-corpo');
    const escHtml = (s) => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    try {
        const resp = await fetch('/api/certificado/listar', { cache: 'no-store' });
        const rawText = await resp.text();
        let data = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch (_) {
            data = null;
        }

        if (!resp.ok || !data || data.status === 'error') {
            const msg = (data && (data.message || data.error)) || `Erro ao carregar lista de certificados (HTTP ${resp.status}).`;
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger small">${escHtml(msg)}</td></tr>`;
            }
            return;
        }

        const activeEmpresa = document.getElementById('cert-modal-active-empresa');
        const activeDetalhes = document.getElementById('cert-modal-active-detalhes');
        const activeArquivo = document.getElementById('cert-modal-active-arquivo');
        const activeBadge = document.getElementById('cert-modal-active-badge');
        const ativoCert = data.ativo || (Array.isArray(data.certificados) ? data.certificados.find(c => c.ativo) : null);

        if (ativoCert) {
            if (activeEmpresa) activeEmpresa.textContent = ativoCert.empresa || ativoCert.arquivo;
            if (activeDetalhes) activeDetalhes.textContent = `CNPJ: ${ativoCert.cnpj || 'N/A'} | Validade até: ${ativoCert.fim || 'N/A'}`;
            if (activeArquivo) activeArquivo.textContent = `Arquivo: ${ativoCert.arquivo}`;
            if (activeBadge) {
                activeBadge.textContent = 'Em Uso';
                activeBadge.className = 'badge rounded-pill bg-success-subtle text-success fw-bold';
                activeBadge.setAttribute('style', 'font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem;');
            }
            window.aplicarDadosCertificadoSidebar(ativoCert);
        } else {
            if (activeEmpresa) activeEmpresa.textContent = 'Nenhum certificado ativo';
            if (activeDetalhes) activeDetalhes.textContent = 'CNPJ: -- | Válido até: --';
            if (activeArquivo) activeArquivo.textContent = 'Arquivo: --';
            if (activeBadge) {
                activeBadge.textContent = 'Pendente';
                activeBadge.className = 'badge rounded-pill bg-warning-subtle text-warning fw-bold';
                activeBadge.setAttribute('style', 'font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem;');
            }
        }

        if (!tbody) return;

        if (!data.certificados || data.certificados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum certificado digital cadastrado na pasta de certificados. Use o formulário abaixo para instalar.</td></tr>`;
            return;
        }

        let html = '';
        data.certificados.forEach(c => {
            const isAtivo = c.ativo;
            const rowClass = isAtivo ? 'table-success-subtle fw-semibold' : '';
            const arqEsc = escHtml(c.arquivo);
            const empEsc = escHtml(c.empresa);
            const cnpjEsc = escHtml(c.cnpj);
            const validadeStr = c.fim ? escHtml(c.fim.split(' ')[0]) : '<span class="text-muted">--</span>';
            const statusBadge = isAtivo
                ? '<span class="badge rounded-pill bg-success text-white fw-bold d-inline-flex align-items-center gap-1" style="font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem;"><i data-lucide="check" style="width: 12px; height: 12px;"></i> Em Uso (Ativo)</span>'
                : `<button type="button" class="btn btn-sm btn-outline-primary rounded-pill fw-bold d-inline-flex align-items-center gap-1" onclick="selecionarCertificadoParaUso('${arqEsc}')" style="font-size: 0.75rem; line-height: 1.2; padding: 0.32rem 0.58rem;">
                     <i data-lucide="check-circle-2" style="width: 12px; height: 12px;"></i> Usar
                   </button>`;

            const deleteBtn = isAtivo ? '' : `
                <button type="button" class="btn btn-sm btn-outline-danger rounded-pill fw-bold d-inline-flex align-items-center justify-content-center" onclick="excluirCertificado('${arqEsc}')" title="Excluir certificado" style="font-size: 0.75rem; line-height: 1.2; padding: 8px;">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                </button>
            `;

            html += `
                <tr class="${rowClass}">
                  <td class="ps-3">
                    <div class="fw-bold text-dark text-truncate" style="max-width: 220px;" title="${empEsc}">
                      <i data-lucide="shield" style="width: 13px; height: 13px; vertical-align: -1px; color: ${isAtivo ? '#16A34A' : '#64748B'};"></i> ${empEsc}
                    </div>
                  </td>
                  <td class="font-monospace small">${cnpjEsc || '<span class="text-muted">Protegido</span>'}</td>
                  <td class="small">${validadeStr}</td>
                  <td class="font-monospace small text-muted text-truncate" style="max-width: 180px;" title="${arqEsc}">${arqEsc}</td>
                  <td class="text-end pe-3">
                    <div class="d-inline-flex align-items-center justify-content-end gap-1">
                      ${statusBadge}
                      ${deleteBtn}
                    </div>
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
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger small">Erro ao carregar certificados: ${escHtml(e.message || 'Falha de conexão')}</td></tr>`;
        }
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
            if (res.data) {
                window.aplicarDadosCertificadoSidebar(res.data);
            }
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
        const rawText = await resp.text();
        let res = {};
        try {
            res = rawText ? JSON.parse(rawText) : {};
        } catch (_) {
            throw new Error(`Erro ao instalar certificado (HTTP ${resp.status}).`);
        }
        if (!resp.ok || res.status === 'error') {
            throw new Error(res.message || res.error || res.detail || `Erro ao instalar certificado (HTTP ${resp.status}).`);
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

    window._nftUsuarioAtual = user;
    const roleNorm = String(user.role || 'user').trim().toLowerCase();
    const isAdmin = (roleNorm === 'admin' || roleNorm === 'administrador');
    const isDigitador = (roleNorm === 'digitador');

    // Atualiza o título da div
    const roleTitle = isAdmin
        ? "Usuário Administrador Autenticado"
        : (isDigitador ? "Usuário Digitador Autenticado" : "Usuário Operador Autenticado");
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

    const dropNome = document.getElementById('topbar-dropdown-user-name');
    const dropRole = document.getElementById('topbar-dropdown-user-role');
    if (dropNome && user.name) dropNome.textContent = user.name;
    if (dropRole) {
        const perfilTxt = isAdmin
            ? 'Administrador (Acesso Total)'
            : (isDigitador ? 'Digitador (Digitação & Empresas)' : 'Operador / Emissor');
        dropRole.textContent = user.email ? `${perfilTxt} • ${user.email}` : perfilTxt;
    }

    // Alterna itens do dropdown do usuário conforme perfil (Admin vs Operador/Digitador)
    const menuCert = document.getElementById('topbar-menu-certificados');
    const menuUsers = document.getElementById('topbar-menu-usuarios');
    const menuPerfil = document.getElementById('topbar-menu-editar-perfil');
    const btnPerfil = document.getElementById('btn-topbar-editar-perfil');
    if (isAdmin) {
        if (menuCert) menuCert.classList.remove('d-none');
        if (menuUsers) menuUsers.classList.remove('d-none');
        if (menuPerfil) menuPerfil.classList.add('d-none');
    } else {
        if (menuCert) menuCert.classList.add('d-none');
        if (menuUsers) menuUsers.classList.add('d-none');
        if (menuPerfil) menuPerfil.classList.remove('d-none');
        if (btnPerfil) {
            btnPerfil.disabled = false;
            btnPerfil.style.opacity = '';
            btnPerfil.style.pointerEvents = '';
        }
    }

    // Atualiza a foto / avatar
    let avatarWrap = document.getElementById('topbar-user-avatar-wrap') || 
                     userPill.querySelector('div') || 
                     userPill.firstElementChild;
    
    const initials = (user.name || user.email || 'A').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();

    if (avatarWrap) {
        const avatarSrc = user.photo_url || '/static/uploads/avatars/user_1.png';
        avatarWrap.innerHTML = `
            <img src="${avatarSrc}" alt="${user.name || 'Avatar'}" 
                 style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; display: block; flex-shrink: 0;" 
                 onerror="this.onerror=null; this.src='/static/uploads/avatars/user_1.png';" />
        `;
        avatarWrap.style.padding = '0';
        avatarWrap.style.overflow = 'hidden';
        avatarWrap.style.border = '1px solid rgba(0,0,0,0.15)';
    }
};

window.aplicarControleAcessoRBAC = function (user) {
    if (!user) return;
    const path = window.location.pathname.toLowerCase();
    const roleNorm = String(user.role || 'user').trim().toLowerCase();
    const isAdmin = (roleNorm === 'admin' || roleNorm === 'administrador');
    const isDigitador = (roleNorm === 'digitador');

    if (isAdmin) return;

    const desabilitarElementosForm = (container) => {
        if (!container) return;
        const fields = container.querySelectorAll('input:not([type="search"]), select, textarea');
        fields.forEach(el => {
            const id = (el.id || '').toLowerCase();
            // Mantém apenas campos de busca/filtro de visualização habilitados
            if (id.includes('search') || id.includes('busca') || id.includes('filtro') || id === 'nftsidebarsearch' || id.startsWith('select-uf')) {
                return;
            }
            el.disabled = true;
            el.style.opacity = '0.65';
            el.style.cursor = 'not-allowed';
            if (!el.title) el.title = 'Campo desabilitado: seu perfil não possui permissão de edição.';
        });
    };

    const inserirAlertaRBAC = (textoHtml) => {
        let alertBox = document.getElementById('nft-rbac-readonly-alert');
        if (alertBox) return;
        const headerContainer = document.querySelector('.container-fluid') || document.querySelector('.nft-main-wrapper');
        if (!headerContainer) return;
        alertBox = document.createElement('div');
        alertBox.id = 'nft-rbac-readonly-alert';
        alertBox.className = 'alert alert-info d-flex align-items-center gap-2 py-2 px-3 mb-3 shadow-sm';
        alertBox.style.cssText = 'border-radius: 10px; font-size: 0.82rem; border-left: 4px solid #0284c7; background-color: rgba(2,132,199,0.08);';
        alertBox.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <div>${textoHtml}</div>
        `;
        const firstCard = headerContainer.querySelector('.d-flex.justify-content-between') || headerContainer.firstElementChild;
        if (firstCard && firstCard.parentNode) {
            firstCard.parentNode.insertBefore(alertBox, firstCard.nextSibling);
        }
    };

    // 1. Páginas de Emissão (Nova NF, Rascunho, DI/DUIMP): Digitador não pode emitir nem transmitir eventos SEFAZ
    const isEmissaoPage = (path.includes('/nova_nf') || path.includes('/rascunho') || path.includes('/di_duimp') || path.includes('/editor'));
    if (isEmissaoPage && isDigitador) {
        const desabilitarEmissaoSefaz = () => {
            const sefazBtns = document.querySelectorAll(
                '#btn-enviar-sefaz-prod, #btn-enviar-sefaz, ' +
                '#btn-cce-sefaz-prod, #btn-cce-sefaz-homolog, ' +
                '#btn-cancelar-sefaz-prod, #btn-cancelar-sefaz-homolog, ' +
                'button[onclick*="enviarNfeSefaz"], button[onclick*="solicitarCartaCorrecao"], button[onclick*="solicitarCancelarNfe"]'
            );
            sefazBtns.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.45';
                btn.style.pointerEvents = 'none';
                btn.title = 'Perfil Digitador: apenas Administradores e Operadores podem emitir ou transmitir eventos na SEFAZ.';
            });
        };
        desabilitarEmissaoSefaz();
        setTimeout(desabilitarEmissaoSefaz, 500);
        setTimeout(desabilitarEmissaoSefaz, 1500);
    }

    // 2. Página de Empresas: Digitador pode cadastrar e editar, mas NÃO pode excluir; Operador só consulta
    if (path.includes('/empresas')) {
        if (isDigitador) {
            inserirAlertaRBAC('<strong>Perfil Digitador:</strong> Você pode cadastrar e editar empresas, porém a exclusão de cadastros é restrita a Administradores.');
            const desabilitarExclusaoEmpresas = () => {
                document.querySelectorAll('button[onclick*="excluir"], button[onclick*="delete"], button[onclick*="deletar"]').forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.4';
                    btn.title = 'Apenas Administradores podem excluir empresas.';
                });
            };
            desabilitarExclusaoEmpresas();
            setTimeout(desabilitarExclusaoEmpresas, 600);
            setTimeout(desabilitarExclusaoEmpresas, 1600);
        } else {
            inserirAlertaRBAC('<strong>Modo Consulta (Operador / Emissor):</strong> Você possui acesso para visualização das empresas. Apenas Administradores ou Digitadores podem cadastrar ou editar.');
            const bloquearEmpresasOperador = () => {
                desabilitarElementosForm(document.getElementById('tab-nova'));
                desabilitarElementosForm(document.getElementById('modalEditarEmpresa'));
                document.querySelectorAll('button[onclick*="excluir"], button[onclick*="editar"], button[onclick*="abrirModalEditar"], button[onclick*="duplicar"], #tab-nova button[type="submit"]').forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.45';
                    btn.title = 'Sem permissão para alterar ou excluir empresas.';
                });
            };
            bloquearEmpresasOperador();
            setTimeout(bloquearEmpresasOperador, 600);
            setTimeout(bloquearEmpresasOperador, 1600);
        }
        return;
    }

    // 3. Demais Páginas de Configurações (Operador e Digitador: somente consulta, campos desabilitados)
    const isConfigPage = (
        path.includes('/usuarios') ||
        path.includes('/feiras') ||
        path.includes('/localidades') ||
        path.includes('/unidades_tributaveis') ||
        path.includes('/banco_ncm') ||
        path.includes('/tipo_nota')
    );

    if (isConfigPage) {
        const nomePerfil = isDigitador ? 'Digitador' : 'Operador / Emissor';
        inserirAlertaRBAC(`<strong>Modo Consulta (${nomePerfil}):</strong> Você possui acesso apenas para visualização das configurações. Campos e ações de alteração estão desabilitados.`);

        const bloquearConfig = () => {
            const mainWrap = document.querySelector('.container-fluid');
            if (!mainWrap) return;
            desabilitarElementosForm(mainWrap);
            mainWrap.querySelectorAll(
                'button[onclick*="abrirModalNovo"], button[onclick*="abrirModalNova"], button[onclick*="criar"], ' +
                'button[onclick*="Adicionar"], button[onclick*="abrirModalCriar"], button[onclick*="salvar"], ' +
                'button[onclick*="novaOperacao"], button[onclick*="excluir"], button[onclick*="delete"], ' +
                'button[onclick*="deletar"], button[onclick*="restaurarPadrao"], button[onclick*="abrirModalEditar"]'
            ).forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.45';
                btn.title = 'Apenas Administradores podem alterar, incluir ou excluir dados de configuração.';
            });
        };
        bloquearConfig();
        setTimeout(bloquearConfig, 600);
        setTimeout(bloquearConfig, 1600);
    }

    // 4. Relatório de Notas Fiscais
    if (path.includes('/relatorios')) {
        const desabilitarEdicaoRelatorio = () => {
            document.querySelectorAll('.ref-tag').forEach(tag => {
                tag.removeAttribute('onclick');
                tag.style.cursor = 'default';
                tag.style.pointerEvents = 'none';
                tag.title = 'Referência Interna (Apenas Administrador pode editar)';
            });

            document.querySelectorAll('button[onclick*="excluirNota"], button[onclick*="excluir_nota"], #btn-excluir-nota-modal').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.4';
                btn.title = 'Apenas Administradores podem excluir notas do relatório.';
            });

            if (isDigitador) {
                document.querySelectorAll('button[onclick*="executarAcaoSefazResumo(\'cce\'"], button[onclick*="executarAcaoSefazResumo(\'cancelar\'"]').forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.45';
                    btn.title = 'Perfil Digitador não pode transmitir eventos na SEFAZ.';
                });
            }
        };
        desabilitarEdicaoRelatorio();
        setTimeout(desabilitarEdicaoRelatorio, 600);
        setTimeout(desabilitarEdicaoRelatorio, 1600);
        setTimeout(desabilitarEdicaoRelatorio, 3000);
    }
};

// === 7. MODAL EDITAR PRÓPRIO PERFIL (PARA OPERADOR E DIGITADOR, SEM ALTERAR CARGO) ===
window.abrirModalEditarProprioPerfil = async function () {
    const DEFAULT_AVATAR = '/static/uploads/avatars/user_1.png';
    let user = window._nftUsuarioAtual;
    if (!user || !user.id) {
        try {
            const resp = await fetch('/api/auth/me');
            const data = await resp.json();
            if (data && data.authenticated && data.user) {
                user = data.user;
                window._nftUsuarioAtual = user;
            }
        } catch (e) {}
    }
    if (!user || !user.id) {
        if (window.nftAlert) await window.nftAlert('Não foi possível carregar os dados do seu perfil.', { type: 'warning', title: 'Aviso' });
        return;
    }

    const roleNorm = String(user.role || 'user').trim().toLowerCase();
    const isAdmin = (roleNorm === 'admin' || roleNorm === 'administrador');

    let modalEl = document.getElementById('modalEditarProprioPerfil');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modalEditarProprioPerfil';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg" style="border-radius: 16px;">
                    <div class="modal-header border-bottom py-3">
                        <h5 class="modal-title fw-bold d-flex align-items-center gap-2 mb-0" style="font-size: 1rem;">
                            <i data-lucide="user-cog" class="text-primary" style="width: 18px; height: 18px;"></i>
                            <span>Editar Meu Perfil</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <form id="formEditarProprioPerfil">
                        <div class="modal-body p-4">
                            <div class="d-flex align-items-center gap-3 mb-3 p-3 rounded border bg-light">
                                <img id="perfil-avatar-preview" src="${DEFAULT_AVATAR}" alt="Avatar" class="rounded-circle border flex-shrink-0" style="width: 56px; height: 56px; object-fit: cover;" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"/>
                                <div class="flex-grow-1" style="min-width: 0;">
                                    <label class="form-label small fw-semibold mb-1" for="perfilFotoInput">Foto de Perfil (Opcional)</label>
                                    <input type="file" class="form-control form-control-sm w-100" id="perfilFotoInput" accept="image/png,image/jpeg,image/webp"/>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold" for="perfilNomeInput">Nome Completo</label>
                                <input type="text" class="form-control" id="perfilNomeInput" placeholder="Nome Completo" required minlength="2"/>
                            </div>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold" for="perfilEmailInput">E-mail de Acesso</label>
                                <input type="email" class="form-control" id="perfilEmailInput" placeholder="E-mail Comercial" required style="text-transform: lowercase;"/>
                            </div>
                            <div class="mb-1">
                                <label class="form-label small fw-semibold" for="perfilSenhaInput">Nova Senha <span class="text-muted fw-normal">(Deixe em branco para manter a atual)</span></label>
                                <input type="password" class="form-control" id="perfilSenhaInput" minlength="6" placeholder="Senha de no Mínimo 6 caracteres"/>
                            </div>
                        </div>
                        <div class="modal-footer bg-light py-2">
                            <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="submit" class="btn btn-sm btn-primary fw-semibold" id="btnSalvarProprioPerfil">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        const fotoInput = modalEl.querySelector('#perfilFotoInput');
        fotoInput.addEventListener('change', (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = modalEl.querySelector('#perfil-avatar-preview');
                if (img) img.src = ev.target.result;
            };
            reader.readAsDataURL(f);
        });

        modalEl.querySelector('#formEditarProprioPerfil').addEventListener('submit', async (e) => {
            e.preventDefault();
            const cur = window._nftUsuarioAtual;
            const curRole = String(cur.role || 'user').trim().toLowerCase();
            const curIsAdmin = (curRole === 'admin' || curRole === 'administrador');
            const btn = modalEl.querySelector('#btnSalvarProprioPerfil');
            const nome = modalEl.querySelector('#perfilNomeInput').value.trim();
            const email = modalEl.querySelector('#perfilEmailInput').value.trim().toLowerCase();
            const senha = modalEl.querySelector('#perfilSenhaInput').value.trim();
            const fotoFile = modalEl.querySelector('#perfilFotoInput').files?.[0];

            btn.disabled = true;
            btn.textContent = 'Salvando...';
            try {
                let updatedUser = Object.assign({}, cur);

                if (curIsAdmin || senha.length >= 6) {
                    const payload = curIsAdmin ? { name: nome, email: email } : {};
                    if (senha.length >= 6) payload.password = senha;

                    const resp = await fetch(`/api/usuarios/${cur.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await resp.json();
                    if (!resp.ok || data.status === 'error') {
                        throw new Error(data.error || 'Falha ao atualizar perfil.');
                    }
                    updatedUser = Object.assign(updatedUser, data.usuario || payload);
                }

                if (fotoFile) {
                    const fd = new FormData();
                    fd.append('file', fotoFile);
                    const rf = await fetch(`/api/usuarios/${cur.id}/foto`, { method: 'POST', body: fd });
                    const df = await rf.json();
                    if (rf.ok && df.photo_url) {
                        updatedUser.photo_url = df.photo_url;
                    }
                }

                window._nftUsuarioAtual = updatedUser;
                try { sessionStorage.setItem('nft_auth_user', JSON.stringify(updatedUser)); } catch (e2) {}
                window.aplicarDadosUsuarioTopbar(updatedUser);
                bootstrap.Modal.getInstance(modalEl)?.hide();
                if (window.nftToast) window.nftToast('Perfil atualizado com sucesso!', 'success');
            } catch (err) {
                if (window.nftAlert) await window.nftAlert(err.message, { type: 'danger', title: 'Erro' });
                else alert(err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Salvar Alterações';
            }
        });
    }

    const nomeInput = modalEl.querySelector('#perfilNomeInput');
    const emailInput = modalEl.querySelector('#perfilEmailInput');
    nomeInput.value = user.name || '';
    emailInput.value = user.email || '';
    nomeInput.disabled = !isAdmin;
    emailInput.disabled = !isAdmin;

    modalEl.querySelector('#perfilSenhaInput').value = '';
    modalEl.querySelector('#perfilFotoInput').value = '';

    const img = modalEl.querySelector('#perfil-avatar-preview');
    if (img) {
        img.src = user.photo_url || DEFAULT_AVATAR;
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: modalEl });
    }
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

function inicializarDadosGlobaisSidebar() {
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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarDadosGlobaisSidebar);
} else {
    inicializarDadosGlobaisSidebar();
}

// === 6. FUNCIONALIDADES DA TOPBAR DIREITA (STATUS SEFAZ & CENTRAL DE AJUDA) ===
window.abrirModalStatusSefaz = async function () {
    let modalEl = document.getElementById('modalStatusSefazGlobal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modalStatusSefazGlobal';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header py-3 border-bottom">
                        <h5 class="modal-title fw-bold mb-0 d-flex align-items-center gap-2" style="font-size: 1rem;">
                            <i data-lucide="activity" class="text-success" style="width: 18px; height: 18px;"></i>
                            <span>Status SEFAZ (UF: SP) &amp; Certificado A1</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body p-3">
                        <div class="p-3 rounded border bg-light mb-3" id="sefaz-global-cert-box" style="font-size: 0.82rem;">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="fw-bold text-secondary text-uppercase" style="font-size: 0.72rem;">Certificado Digital A1</span>
                                <span class="badge bg-secondary-subtle text-secondary" id="sefaz-global-cert-badge">Verificando...</span>
                            </div>
                            <div id="sefaz-global-cert-info" class="text-muted">Carregando dados do certificado...</div>
                        </div>

                        <div class="d-flex gap-2 mb-3">
                            <button type="button" class="btn btn-sm btn-primary flex-grow-1 fw-semibold" onclick="verificarStatusSefazTempoReal(1)">
                                Consultar Produção (1)
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-secondary flex-grow-1 fw-semibold" onclick="verificarStatusSefazTempoReal(2)">
                                Consultar Homologação (2)
                            </button>
                        </div>

                        <div id="sefaz-global-status-result" class="p-3 rounded border text-center small text-muted">
                            Clique em um dos ambientes acima para testar a comunicação em tempo real com o WebService da SEFAZ (NFeStatusServico4).
                        </div>
                    </div>
                    <div class="modal-footer py-2 bg-light">
                        <button type="button" class="btn btn-sm btn-outline-primary" onclick="if(typeof abrirModalGerenciarCertificados==='function'){ bootstrap.Modal.getInstance(document.getElementById('modalStatusSefazGlobal'))?.hide(); abrirModalGerenciarCertificados(); }">Gerenciar Certificados</button>
                        <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: modalEl });
    }

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();

    // Carrega info do certificado ativo
    try {
        const respCert = await fetch('/api/certificado/status', { cache: 'no-store' });
        const certData = await respCert.json();
        const badgeEl = document.getElementById('sefaz-global-cert-badge');
        const infoEl = document.getElementById('sefaz-global-cert-info');
        if (certData && certData.status === 'success') {
            if (badgeEl) {
                badgeEl.className = 'badge bg-success-subtle text-success';
                badgeEl.textContent = 'Ativo';
            }
            if (infoEl) {
                infoEl.innerHTML = `<strong>${certData.assunto || 'Certificado A1'}</strong><br/>Validade: <span class="font-monospace">${certData.fim || '-'}</span>`;
            }
        } else {
            if (badgeEl) {
                badgeEl.className = 'badge bg-warning-subtle text-warning';
                badgeEl.textContent = 'Não carregado';
            }
            if (infoEl) {
                infoEl.textContent = certData.message || 'Nenhum certificado A1 ativo no momento.';
            }
        }
    } catch (e) {}
};

window.verificarStatusSefazTempoReal = async function (tpAmb = 1) {
    const resEl = document.getElementById('sefaz-global-status-result');
    const pillEl = document.getElementById('topbar-sefaz-pill');
    const labelEl = document.getElementById('topbar-sefaz-label');
    if (resEl) {
        resEl.innerHTML = `<div class="spinner-border spinner-border-sm text-primary me-2"></div> Consultando SEFAZ (${tpAmb === 1 ? 'Produção' : 'Homologação'})...`;
    }

    try {
        const resp = await fetch(`/api/sefaz/status_servico?tpAmb=${tpAmb}&uf=SP`);
        const data = await resp.json();
        if (data && data.status === 'success' && data.online) {
            if (resEl) {
                resEl.innerHTML = `
                    <div class="alert alert-success py-2 px-3 mb-0 text-start">
                        <div class="fw-bold">cStat ${data.cstat} — ${data.xmotivo}</div>
                        <div class="small mt-1">Ambiente: <strong>${data.ambiente_nome}</strong> • Tempo médio: <strong>${data.tmed || '-'}s</strong></div>
                        <div class="small text-muted">Retorno: ${data.dh_recbto || '-'}</div>
                    </div>
                `;
            }
            if (pillEl && labelEl) {
                pillEl.classList.add('success');
                labelEl.textContent = 'SEFAZ Online';
            }
        } else {
            const msg = (data && (data.xmotivo || data.error)) || 'Sem resposta da SEFAZ.';
            if (resEl) {
                resEl.innerHTML = `
                    <div class="alert alert-warning py-2 px-3 mb-0 text-start">
                        <div class="fw-bold">${data?.cstat ? 'cStat ' + data.cstat + ' — ' : ''}${msg}</div>
                        <div class="small mt-1">Ambiente: ${tpAmb === 1 ? 'Produção' : 'Homologação'}</div>
                    </div>
                `;
            }
            if (pillEl && labelEl) {
                pillEl.classList.remove('success');
                labelEl.textContent = 'SEFAZ Alerta';
            }
        }
    } catch (e) {
        if (resEl) {
            resEl.innerHTML = `<div class="alert alert-danger py-2 px-3 mb-0 text-start">Falha na consulta: ${e.message}</div>`;
        }
    }
};

window.abrirModalAjudaSistema = function () {
    let modalEl = document.getElementById('modalAjudaSistemaGlobal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'modalAjudaSistemaGlobal';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header py-3 border-bottom">
                        <h5 class="modal-title fw-bold mb-0 d-flex align-items-center gap-2" style="font-size: 1rem;">
                            <i data-lucide="help-circle" class="text-primary" style="width: 18px; height: 18px;"></i>
                            <span>Central de Ajuda &amp; Atalhos Rápidos</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body p-3">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="p-3 border rounded h-100 bg-light">
                                    <h6 class="fw-bold mb-2 text-primary" style="font-size: 0.85rem;">Atalhos de Teclado</h6>
                                    <ul class="list-unstyled small mb-0 lh-lg">
                                        <li><kbd>/</kbd> ou <kbd>Ctrl+K</kbd> — Busca rápida global (Notas, Rascunhos, Empresas e Páginas)</li>
                                        <li><kbd>↑</kbd> <kbd>↓</kbd> + <kbd>Enter</kbd> — Navegar e abrir resultado da busca</li>
                                        <li><kbd>Esc</kbd> — Limpar busca e fechar menus</li>
                                        <li><kbd>Ctrl+Enter</kbd> — Confirmar caixas de texto (CC-e / Cancelamento)</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 border rounded h-100 bg-light">
                                    <h6 class="fw-bold mb-2 text-success" style="font-size: 0.85rem;">Principais Códigos SEFAZ</h6>
                                    <ul class="list-unstyled small mb-0 lh-lg font-monospace">
                                        <li><strong>100</strong> — Autorizado o uso da NF-e</li>
                                        <li><strong>101</strong> — Cancelamento de NF-e homologado</li>
                                        <li><strong>107</strong> — Serviço em Operação</li>
                                        <li><strong>135</strong> — Evento registrado e vinculado (CC-e / Canc.)</li>
                                        <li><strong>204 / 539</strong> — Duplicidade de NF-e</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="p-3 border rounded bg-white small">
                                    <h6 class="fw-bold mb-2 text-secondary" style="font-size: 0.85rem;">Acesso Rápido aos Módulos</h6>
                                    <div class="d-flex flex-wrap gap-2">
                                        <a href="/nova_nf?nova_nota=1" class="btn btn-sm btn-outline-primary">Nova NF</a>
                                        <a href="/rascunho?nova_nota=1" class="btn btn-sm btn-outline-primary">XML Rascunho</a>
                                        <a href="/di_duimp?nova_nota=1" class="btn btn-sm btn-outline-primary">XML DI / DUIMP</a>
                                        <a href="/rascunhos_salvos" class="btn btn-sm btn-outline-secondary">Rascunhos Salvos</a>
                                        <a href="/relatorios" class="btn btn-sm btn-outline-secondary">Relatórios / Notas</a>
                                        <a href="/tipo_nota" class="btn btn-sm btn-outline-secondary">Tipo de Nota (Impostos)</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer py-2 bg-light">
                        <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: modalEl });
    }
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
};
