/**
 * NFT Logistics — Core UI Factory (nft-ui-factory.js)
 * Gera o mesmo HTML canônico das macros Jinja (macros/ui.html) para popups e
 * componentes montados dinamicamente via JavaScript, garantindo:
 *  - Botões pílula (.nft-btn) e ícones redondos (.nft-btn-icon)
 *  - Modais padronizados (.modal-header / .modal-body / .modal-footer)
 *  - Atributos title + data-ui em todos os controles dinâmicos
 */
(function (global) {
  'use strict';

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function btn(opts) {
    const o = opts || {};
    const variant = o.variant || 'secondary';
    const size = o.size ? ` nft-btn--${o.size}` : '';
    const extra = o.extraClass ? ` ${o.extraClass}` : '';
    const cls = `nft-btn nft-btn--${variant}${size}${extra}`;
    const title = o.title || o.text || '';
    const iconHtml = o.icon ? `<i data-lucide="${esc(o.icon)}"></i>` : '';
    const idAttr = o.id ? ` id="${esc(o.id)}"` : '';
    const uiAttr = o.ui ? ` data-ui="${esc(o.ui)}"` : '';
    const onclickAttr = o.onclick ? ` onclick="${esc(o.onclick)}"` : '';
    const extraAttrs = o.attrs ? ` ${o.attrs}` : '';

    if (o.href) {
      return `<a class="${cls}" href="${esc(o.href)}" title="${esc(title)}"${idAttr}${uiAttr}${onclickAttr}${extraAttrs}>${iconHtml}<span>${esc(o.text)}</span></a>`;
    }
    const type = o.type || 'button';
    return `<button class="${cls}" type="${esc(type)}" title="${esc(title)}"${idAttr}${uiAttr}${onclickAttr}${extraAttrs}>${iconHtml}<span>${esc(o.text)}</span></button>`;
  }

  function btnIcon(opts) {
    const o = opts || {};
    const variant = o.variant || 'ghost';
    const size = o.size === 'sm' ? ' nft-btn-icon--sm' : '';
    const extra = o.extraClass ? ` ${o.extraClass}` : '';
    const cls = `nft-btn-icon nft-btn-icon--${variant}${size}${extra}`;
    const title = o.title || '';
    const idAttr = o.id ? ` id="${esc(o.id)}"` : '';
    const uiAttr = o.ui ? ` data-ui="${esc(o.ui)}"` : '';
    const onclickAttr = o.onclick ? ` onclick="${esc(o.onclick)}"` : '';
    const extraAttrs = o.attrs ? ` ${o.attrs}` : '';
    const tooltipAttrs = ` data-bs-toggle="tooltip" data-bs-placement="${esc(o.placement || 'bottom')}" title="${esc(title)}" aria-label="${esc(title)}"`;

    if (o.href) {
      return `<a class="${cls}" href="${esc(o.href)}"${tooltipAttrs}${idAttr}${uiAttr}${onclickAttr}${extraAttrs}><i data-lucide="${esc(o.icon)}"></i></a>`;
    }
    const type = o.type || 'button';
    return `<button class="${cls}" type="${esc(type)}"${tooltipAttrs}${idAttr}${uiAttr}${onclickAttr}${extraAttrs}><i data-lucide="${esc(o.icon)}"></i></button>`;
  }

  function badge(opts) {
    const o = opts || {};
    const tone = o.tone || 'neutral';
    const pill = o.pill ? ' nft-badge--pill' : '';
    const mono = o.mono ? ' nft-badge--mono' : '';
    const extra = o.extraClass ? ` ${o.extraClass}` : '';
    const idAttr = o.id ? ` id="${esc(o.id)}"` : '';
    const titleAttr = o.title ? ` title="${esc(o.title)}"` : '';
    const uiAttr = o.ui ? ` data-ui="${esc(o.ui)}"` : '';
    return `<span class="nft-badge${pill}${mono}${extra}" data-tone="${esc(tone)}"${idAttr}${titleAttr}${uiAttr}>${o.rawHtml ? o.text : esc(o.text)}</span>`;
  }

  function modal(opts) {
    const o = opts || {};
    const sizeCls = ['sm', 'lg', 'xl'].includes(o.size) ? ` modal-${o.size}` : '';
    const scrollCls = o.scrollable ? ' modal-dialog-scrollable' : '';
    const toneAttr = o.headerTone ? ` data-tone="${esc(o.headerTone)}"` : '';
    const ui = o.ui || `modal.${o.id || 'dinamico'}`;
    const iconHtml = o.icon ? `<i data-lucide="${esc(o.icon)}" class="nft-icon--md"></i>` : '';
    const titleIdAttr = o.titleId ? ` id="${esc(o.titleId)}"` : '';
    const footerCls = o.splitFooter ? 'modal-footer nft-modal-footer--split' : 'modal-footer';
    const footerBlock = o.footerHtml ? `<div class="${footerCls}" data-ui="${esc(ui)}.footer">${o.footerHtml}</div>` : '';

    return `
      <div class="modal fade" id="${esc(o.id)}" tabindex="-1" aria-hidden="true" data-ui="${esc(ui)}">
        <div class="modal-dialog modal-dialog-centered${sizeCls}${scrollCls}">
          <div class="modal-content">
            <div class="modal-header"${toneAttr} data-ui="${esc(ui)}.header">
              <h5 class="modal-title"${titleIdAttr}>${iconHtml}<span>${o.rawTitle ? o.title : esc(o.title)}</span></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar janela" title="Fechar janela" data-ui="${esc(ui)}.btn-close"></button>
            </div>
            <div class="modal-body${o.bodyClass ? ' ' + esc(o.bodyClass) : ''}" data-ui="${esc(ui)}.body">
              ${o.bodyHtml || ''}
            </div>
            ${footerBlock}
          </div>
        </div>
      </div>
    `;
  }

  function modalFooter(opts) {
    const o = opts || {};
    const ui = o.uiPrefix || 'modal.footer';
    const cancelBtn = o.cancelText !== false
      ? btn({
          text: o.cancelText || 'Cancelar',
          variant: 'ghost',
          size: 'sm',
          title: o.cancelTitle || 'Fechar sem salvar alterações',
          ui: `${ui}.btn-cancelar`,
          attrs: 'data-bs-dismiss="modal"'
        })
      : '';

    const confirmBtn = o.confirmText
      ? btn({
          text: o.confirmText,
          variant: o.confirmVariant || 'primary',
          size: 'sm',
          icon: o.confirmIcon || '',
          id: o.confirmId || '',
          type: o.confirmType || 'button',
          title: o.confirmTitle || o.confirmText,
          ui: `${ui}.btn-confirmar`,
          onclick: o.confirmOnclick || ''
        })
      : '';

    const rightGroup = `<div class="d-flex align-items-center gap-2">${cancelBtn}${confirmBtn}</div>`;
    return o.leftHtml ? `<div>${o.leftHtml}</div>${rightGroup}` : `${cancelBtn}${confirmBtn}`;
  }

  global.NftUI = {
    esc,
    btn,
    btnIcon,
    badge,
    modal,
    modalFooter
  };
})(window);
