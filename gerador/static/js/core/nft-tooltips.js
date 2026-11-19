/**
 * NFT Logistics — Gerenciador Global de Tooltips & Modo Inspetor Dev (Alt+Shift+I)
 * 1. Centraliza a inicialização de tooltips Bootstrap (inclusive em elementos injetados via JS).
 * 2. Limpa tooltips órfãos ao fechar modais ou clicar em botões.
 * 3. Disponibiliza o Modo Inspetor Dev (Alt+Shift+I): destaca qualquer tag dinâmica na tela,
 *    exibe data-ui / id / title / evento no HUD e copia o data-ui com Alt+Clique.
 */
(function (global) {
  'use strict';

  let tooltipTimer = null;

  function initTooltips(root) {
    if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
    const scope = root || document;
    const nodes = scope.querySelectorAll('[data-bs-toggle="tooltip"]');
    nodes.forEach((el) => {
      if (!el.getAttribute('title') && !el.getAttribute('data-bs-original-title')) return;
      const existing = bootstrap.Tooltip.getInstance(el);
      if (!existing) {
        new bootstrap.Tooltip(el, {
          trigger: 'hover focus',
          container: 'body'
        });
      }
    });
  }

  function hideAllTooltips() {
    if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      const inst = bootstrap.Tooltip.getInstance(el);
      if (inst) inst.hide();
    });
    document.querySelectorAll('.tooltip.show').forEach((tip) => tip.remove());
  }

  function scheduleRefresh() {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      initTooltips(document);
    }, 120);
  }

  /* ========================================================================
     MODO INSPETOR DEV (Alt + Shift + I)
     ======================================================================== */
  let inspectorActive = false;
  let hudEl = null;
  let currentHighlight = null;

  function createHud() {
    if (hudEl) return hudEl;
    hudEl = document.createElement('div');
    hudEl.className = 'nft-dev-inspector-hud';
    hudEl.setAttribute('data-ui', 'dev.inspector.hud');
    hudEl.innerHTML = '<div><strong>Inspetor UI Ativo</strong> — passe o mouse em qualquer elemento dinâmico</div><div class="nft-dev-inspector-hud__hint">Alt+Clique copia data-ui • Alt+Shift+I desativa</div>';
    document.body.appendChild(hudEl);
    return hudEl;
  }

  function findInspectable(target) {
    if (!target || target === document.body || target === document.documentElement) return null;
    if (target.closest && target.closest('.nft-dev-inspector-hud')) return null;
    return target.closest('[data-ui], button, input, select, textarea, a[href], [onclick], [onchange], [data-bs-toggle]') || target;
  }

  function updateHud(el) {
    if (!hudEl || !el) return;
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '(sem id)';
    const dataUi = el.getAttribute('data-ui') || '⚠ SEM data-ui';
    const title = el.getAttribute('title') || el.getAttribute('data-bs-original-title') || '⚠ SEM title';
    const events = [];
    ['onclick', 'onchange', 'oninput', 'onsubmit', 'data-bs-toggle', 'data-bs-target'].forEach((attr) => {
      const v = el.getAttribute(attr);
      if (v) events.push(`${attr}="${v}"`);
    });
    const evStr = events.length ? events.join(' | ') : 'JS listener / estático';

    hudEl.innerHTML = `
      <div><span class="nft-dev-inspector-hud__tag">&lt;${tag}&gt;</span> <span>${id}</span></div>
      <div><strong>data-ui:</strong> <span class="nft-dev-inspector-hud__ui">${dataUi}</span></div>
      <div><strong>title:</strong> <span class="nft-dev-inspector-hud__title">${title}</span></div>
      <div><strong>dinâmica:</strong> ${evStr}</div>
      <div class="nft-dev-inspector-hud__hint">Alt+Clique copia data-ui • Alt+Shift+I desativa</div>
    `;
  }

  function onMouseOver(e) {
    if (!inspectorActive) return;
    const target = findInspectable(e.target);
    if (!target || target === currentHighlight) return;
    if (currentHighlight) currentHighlight.classList.remove('nft-dev-inspector-outline');
    currentHighlight = target;
    currentHighlight.classList.add('nft-dev-inspector-outline');
    updateHud(currentHighlight);
  }

  function onAltClick(e) {
    if (!inspectorActive || !e.altKey) return;
    const target = findInspectable(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    const key = target.getAttribute('data-ui') || target.id || target.tagName.toLowerCase();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(key).catch(() => {});
    }
    if (hudEl) {
      const hint = hudEl.querySelector('.nft-dev-inspector-hud__hint');
      if (hint) hint.textContent = `Copiado: "${key}" — use Ctrl+Shift+F no editor!`;
    }
  }

  function toggleInspector() {
    inspectorActive = !inspectorActive;
    if (inspectorActive) {
      createHud();
      document.addEventListener('mouseover', onMouseOver, true);
      document.addEventListener('click', onAltClick, true);
    } else {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('click', onAltClick, true);
      if (currentHighlight) {
        currentHighlight.classList.remove('nft-dev-inspector-outline');
        currentHighlight = null;
      }
      if (hudEl) {
        hudEl.remove();
        hudEl = null;
      }
    }
    return inspectorActive;
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault();
      toggleInspector();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initTooltips(document);

    // Oculta tooltips ao clicar ou fechar modais (previne tooltip preso)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-bs-toggle="tooltip"]')) {
        setTimeout(hideAllTooltips, 80);
      }
    });
    document.addEventListener('hidden.bs.modal', hideAllTooltips);

    // Observa nós inseridos dinamicamente via JS
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length > 0) {
            scheduleRefresh();
            break;
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });

  global.NftTooltips = {
    refresh: initTooltips,
    hideAll: hideAllTooltips
  };

  global.NftInspector = {
    toggle: toggleInspector,
    isActive: () => inspectorActive
  };
})(window);
