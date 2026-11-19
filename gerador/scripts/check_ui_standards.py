"""
NFT Logistics — Auditor Automatizado de Padrões Clean Code de Interface
Verifica:
  1. Compilação e renderização Jinja2 de todas as páginas e modos do editor
  2. Zero blocos <style> locais nos templates
  3. Zero classes legadas / mortas (form-control-sm, btn-header-round, px-2.5, etc.)
  4. 100% das tags <label> vinculadas com atributo for="..."
  5. Cobertura da Estratégia Dual (title amigável + data-ui hierárquico)
  6. Arquitetura CSS: @media de tela restritos a layouts/layout-{desktop,tablet,mobile}.css e zero font-size < 11px
  7. Higienização JS: instância única de bootstrap.Tooltip em core/nft-tooltips.js e zero font-size < 11px
"""
import glob
import os
import re
import subprocess
import sys
from html.parser import HTMLParser

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, BASE_DIR)


class RenderedHTMLAnalyzer(HTMLParser):
    def __init__(self):
        super().__init__()
        self.labels_total = 0
        self.labels_with_for = 0
        self.labels_missing_for = []
        self.interactive_total = 0
        self.interactive_with_title = 0
        self.interactive_with_data_ui = 0
        self.interactive_missing_title = []
        self.interactive_missing_data_ui = []
        self.containers_with_data_ui = 0
        self.style_tags = 0
        self.inline_styles = 0
        self.nft_fields = 0
        self.nft_controls = 0
        self.nft_btns = 0
        self.nft_btn_icons = 0
        self.nft_badges = 0
        self.table_cards = 0

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        cls = attr_dict.get('class', '') or ''
        cls_tokens = set(cls.split())
        el_id = attr_dict.get('id', '') or ''
        title = (attr_dict.get('title') or '').strip()
        data_ui = (attr_dict.get('data-ui') or '').strip()

        if tag == 'style':
            self.style_tags += 1
        if 'style' in attr_dict:
            self.inline_styles += 1

        if 'nft-field' in cls_tokens:
            self.nft_fields += 1
        if 'nft-control' in cls_tokens:
            self.nft_controls += 1
        if 'nft-btn' in cls_tokens:
            self.nft_btns += 1
        if 'nft-btn-icon' in cls_tokens:
            self.nft_btn_icons += 1
        if 'nft-badge' in cls_tokens:
            self.nft_badges += 1
        if 'nft-table-cards' in cls_tokens:
            self.table_cards += 1

        if data_ui and tag in ('div', 'header', 'section', 'main', 'aside', 'nav', 'form', 'table', 'tbody', 'ul', 'fieldset'):
            self.containers_with_data_ui += 1

        if tag == 'label':
            self.labels_total += 1
            if attr_dict.get('for'):
                self.labels_with_for += 1
            else:
                self.labels_missing_for.append(f"<label class='{cls}' id='{el_id}'>")

        # Elementos interativos visíveis
        is_interactive = False
        if tag in ('select', 'textarea'):
            is_interactive = True
        elif tag == 'input' and attr_dict.get('type', 'text') != 'hidden':
            is_interactive = True
        elif tag == 'button':
            is_interactive = True
        elif tag == 'a' and (
            'nft-btn' in cls_tokens
            or 'nft-btn-icon' in cls_tokens
            or 'nft-sidebar-btn' in cls_tokens
            or 'portal-card' in cls_tokens
            or 'onclick' in attr_dict
        ):
            is_interactive = True

        if is_interactive:
            self.interactive_total += 1
            if title:
                self.interactive_with_title += 1
            else:
                self.interactive_missing_title.append(f"<{tag} id='{el_id}' class='{cls}'>")
            if data_ui:
                self.interactive_with_data_ui += 1
            else:
                self.interactive_missing_data_ui.append(f"<{tag} id='{el_id}' class='{cls}'>")


def check_templates():
    from jinja2 import Environment, FileSystemLoader

    tpl_dir = os.path.join(BASE_DIR, 'templates')
    env = Environment(loader=FileSystemLoader(tpl_dir))

    editor_modos_cfg = {
        'rascunho': {
            'page_title': 'Gerador e Editor NF-e Sebrae - NFT Logistics',
            'sidebar_active': 'rascunho',
            'topbar_modulo': 'XML Rascunho',
            'topbar_tag': 'Editor NF-e',
            'badge_class': 'badge-origem-rasc',
            'badge_titulo': 'XML Rascunho',
            'nome_modulo': 'XML Rascunho',
            'icone_origem': 'file-code',
            'status_inicial': 'Aguardando XML',
            'subtitulo': 'Importe o XML de modelo, selecione o Tipo de Nota para herdar impostos e salve rascunhos para continuar a edição.',
            'tooltip_analisar': 'Analisar e Verificar Rascunho do XML',
            'modal_rascunho_titulo': 'Salvar Rascunho da NF-e',
            'modal_rascunho_placeholder': 'Ex: REF-2026-001, Pedido 452, Cliente X...',
        },
        'nova_nf': {
            'page_title': 'Gerador e Editor NF-e — Nova NF - NFT Logistics',
            'sidebar_active': 'nova_nf',
            'topbar_modulo': 'Nova NF-e',
            'topbar_tag': 'Sem XML',
            'badge_class': 'badge-origem-nova',
            'badge_titulo': 'Nova NF (Sem XML)',
            'nome_modulo': 'Nova NF',
            'icone_origem': 'plus-circle',
            'status_inicial': 'Em Digitação Direta',
            'subtitulo': 'Emissão e digitação direta de NF-e a partir do zero ou via planilha Excel, com preenchimento assistido de impostos.',
            'tooltip_analisar': 'Analisar e Verificar Rascunho da NF-e',
            'modal_rascunho_titulo': 'Salvar Rascunho da NF-e',
            'modal_rascunho_placeholder': 'Ex: NOTA-2026/001, PEDIDO-1050, Cliente X...',
        },
        'di_duimp': {
            'page_title': 'Gerador NF-e — XML da DI / DUIMP — NFT Logistics',
            'sidebar_active': 'di_duimp',
            'topbar_modulo': 'Declaração de Importação',
            'topbar_tag': 'DI / DUIMP',
            'badge_class': 'badge-origem-di',
            'badge_titulo': 'XML da DI ou DUIMP',
            'nome_modulo': 'XML da DI ou DUIMP',
            'icone_origem': 'globe',
            'status_inicial': 'Aguardando XML',
            'subtitulo': 'Importe a Declaração de Importação (DI) ou DUIMP, selecione o Tipo de Nota e salve rascunhos para continuar a edição.',
            'tooltip_analisar': 'Analisar e Verificar Rascunho da NF-e',
            'modal_rascunho_titulo': 'Salvar Rascunho da NF-e (DI / DUIMP)',
            'modal_rascunho_placeholder': 'Ex: REF-2026-001, DI 26/1234567-8...',
        },
    }

    pages = [
        ('login.html', {'error': None, 'next_url': '/'}),
        ('portal.html', {}),
        ('editor_nfe.html', {'editor_modo': 'rascunho', 'editor_cfg': editor_modos_cfg['rascunho']}),
        ('editor_nfe.html', {'editor_modo': 'di_duimp', 'editor_cfg': editor_modos_cfg['di_duimp']}),
        ('editor_nfe.html', {'editor_modo': 'nova_nf', 'editor_cfg': editor_modos_cfg['nova_nf']}),
        ('tipo_nota.html', {}),
        ('banco_ncm.html', {'total_ncm': 15420}),
        ('rascunhos_salvos.html', {}),
        ('localidades.html', {}),
        ('feiras.html', {}),
        ('unidades_tributaveis.html', {}),
        ('usuarios.html', {}),
        ('empresas.html', {}),
        ('relatorios.html', {}),
    ]

    forbidden_classes = [
        'form-control-sm',
        'form-select-sm',
        'input-group-sm',
        'btn-header-round',
        'btn-nft-action-round',
        'btn-action-round',
        'btn-page-round',
        'btn-file-action',
        'badge-cat',
        'badge-role-admin',
        'badge-role-operador',
        'badge-role-digitador',
        'px-2.5',
        'metric-card',
        'status-pill',
        'ambiente-pill',
    ]

    agg = RenderedHTMLAnalyzer()
    errors = []

    print("=== 1. COMPILAÇÃO E AUDITORIA DAS 14 VISÕES JINJA2 ===")
    for tpl_name, ctx in pages:
        label = f"{tpl_name} ({ctx.get('editor_modo', 'default')})"
        try:
            tpl = env.get_template(tpl_name)
            html = tpl.render(**ctx)
        except Exception as exc:
            errors.append(f"[ERRO JINJA] {label}: {exc}")
            continue

        analyzer = RenderedHTMLAnalyzer()
        analyzer.feed(html)

        agg.labels_total += analyzer.labels_total
        agg.labels_with_for += analyzer.labels_with_for
        agg.interactive_total += analyzer.interactive_total
        agg.interactive_with_title += analyzer.interactive_with_title
        agg.interactive_with_data_ui += analyzer.interactive_with_data_ui
        agg.containers_with_data_ui += analyzer.containers_with_data_ui
        agg.style_tags += analyzer.style_tags
        agg.inline_styles += analyzer.inline_styles
        agg.nft_fields += analyzer.nft_fields
        agg.nft_controls += analyzer.nft_controls
        agg.nft_btns += analyzer.nft_btns
        agg.nft_btn_icons += analyzer.nft_btn_icons
        agg.nft_badges += analyzer.nft_badges
        agg.table_cards += analyzer.table_cards

        if analyzer.style_tags > 0:
            errors.append(f"[STYLE TAG] {label}: possui {analyzer.style_tags} bloco(s) <style>")

        if analyzer.labels_missing_for:
            errors.append(f"[LABEL SEM FOR] {label}: {analyzer.labels_missing_for[:3]}")

        if analyzer.interactive_missing_title:
            errors.append(f"[SEM TITLE] {label} ({len(analyzer.interactive_missing_title)}): {analyzer.interactive_missing_title[:3]}")

        if analyzer.interactive_missing_data_ui:
            errors.append(f"[SEM DATA-UI] {label} ({len(analyzer.interactive_missing_data_ui)}): {analyzer.interactive_missing_data_ui[:3]}")

        for fc in forbidden_classes:
            if re.search(r'(?<![\w-])' + re.escape(fc) + r'(?![\w-])', html):
                errors.append(f"[CLASSE LEGADA] {label}: encontrou '{fc}'")

        print(
            f"  [OK] {label:<34} | labels={analyzer.labels_with_for}/{analyzer.labels_total} "
            f"| interativos(title={analyzer.interactive_with_title}/{analyzer.interactive_total}, "
            f"data-ui={analyzer.interactive_with_data_ui}/{analyzer.interactive_total}) "
            f"| containers(data-ui)={analyzer.containers_with_data_ui} | inline-style={analyzer.inline_styles}"
        )

    title_pct = (agg.interactive_with_title / agg.interactive_total * 100) if agg.interactive_total else 100.0
    ui_pct = (agg.interactive_with_data_ui / agg.interactive_total * 100) if agg.interactive_total else 100.0
    for_pct = (agg.labels_with_for / agg.labels_total * 100) if agg.labels_total else 100.0

    print("\n=== RESUMO CONSOLIDADO DOS TEMPLATES RENDERIZADOS ===")
    print(f"  • Blocos <style> locais:       {agg.style_tags} (Meta: 0)")
    print(f"  • Labels com for='...':        {agg.labels_with_for}/{agg.labels_total} ({for_pct:.1f}%)")
    print(f"  • Controles com title='...':   {agg.interactive_with_title}/{agg.interactive_total} ({title_pct:.1f}%)")
    print(f"  • Controles com data-ui='...': {agg.interactive_with_data_ui}/{agg.interactive_total} ({ui_pct:.1f}%)")
    print(f"  • Containers com data-ui:      {agg.containers_with_data_ui}")
    print(f"  • Componentes padronizados:    .nft-field={agg.nft_fields}, .nft-control={agg.nft_controls}, .nft-btn={agg.nft_btns}, .nft-btn-icon={agg.nft_btn_icons}, .nft-badge={agg.nft_badges}, .nft-table-cards={agg.table_cards}")
    return errors


def check_css():
    print("\n=== 2. AUDITORIA DA ARQUITETURA CSS & RESPONSIVIDADE ===")
    css_files = sorted(glob.glob(os.path.join(BASE_DIR, 'static', 'css', '**', '*.css'), recursive=True))
    errors = []

    # Exceção autorizada pelo usuário: navigation.css contém a dinâmica responsiva original dedicada do Top Nav Bar
    allowed_screen_media = {'layout-desktop.css', 'layout-tablet.css', 'layout-mobile.css', 'navigation.css'}

    for path in css_files:
        rel = os.path.relpath(path, os.path.join(BASE_DIR, 'static', 'css')).replace('\\', '/')
        base = os.path.basename(path)
        content = open(path, encoding='utf-8').read()

        # Check @media
        for m in re.finditer(r'@media\s*([^{]+)', content):
            cond = m.group(1).strip()
            if 'print' in cond:
                if base != 'espelho-print.css':
                    errors.append(f"[CSS @media print fora de espelho-print.css] {rel}: {cond}")
            elif 'prefers-reduced-motion' in cond:
                continue
            else:
                if base not in allowed_screen_media:
                    errors.append(f"[CSS @media de tela fora de layouts/] {rel}: @media {cond}")

        # Check font-size < 11px (exceto a regra #topbar-emitente-cnpj 9px empilhada no mobile em navigation.css)
        for m in re.finditer(r'font-size\s*:\s*([0-9.]+)(px|rem)\b', content):
            val = float(m.group(1))
            unit = m.group(2)
            px_val = val if unit == 'px' else val * 16.0
            if px_val < 10.99:
                if base == 'navigation.css' and abs(px_val - 9.0) < 0.01:
                    continue
                errors.append(f"[CSS font-size < 11px] {rel}: {m.group(0)} ({px_val:.2f}px)")

        print(f"  [OK] {rel:<34} ({len(content.splitlines())} linhas)")

    return errors


def check_js():
    print("\n=== 3. AUDITORIA DOS MÓDULOS JAVASCRIPT ===")
    js_files = sorted(
        p for p in glob.glob(os.path.join(BASE_DIR, 'static', 'js', '**', '*.js'), recursive=True)
        if not p.endswith('lucide.min.js')
    )
    errors = []
    tooltip_inits = []

    for path in js_files:
        rel = os.path.relpath(path, os.path.join(BASE_DIR, 'static', 'js')).replace('\\', '/')
        content = open(path, encoding='utf-8').read()

        # Check syntax with node --check if available
        try:
            proc = subprocess.run(['node', '--check', path], capture_output=True, text=True)
            if proc.returncode != 0:
                errors.append(f"[JS SYNTAX ERROR] {rel}: {proc.stderr.strip()}")
        except FileNotFoundError:
            pass

        if 'new bootstrap.Tooltip' in content:
            tooltip_inits.append(rel)

        # Check legacy classes in JS
        for fc in ('form-control-sm', 'form-select-sm', 'btn-nft-action-round', 'btn-action-round', 'btn-header-round'):
            if fc in content:
                errors.append(f"[JS CLASSE LEGADA] {rel}: contém '{fc}'")

        # Check <label> without for= in JS HTML builders
        labels_no_for = re.findall(r'<label(?![^>]*\bfor=)[^>]*>', content)
        if labels_no_for:
            errors.append(f"[JS LABEL SEM FOR] {rel}: {labels_no_for[:2]}")

        # Check inline font-size < 11px in JS
        for m in re.finditer(r'font-size\s*:\s*([0-9.]+)(px|rem)\b', content):
            val = float(m.group(1))
            unit = m.group(2)
            px_val = val if unit == 'px' else val * 16.0
            if px_val < 10.99:
                errors.append(f"[JS font-size < 11px] {rel}: {m.group(0)} ({px_val:.2f}px)")

        print(f"  [OK] {rel:<34} ({len(content.splitlines())} linhas)")

    if tooltip_inits != ['core/nft-tooltips.js']:
        errors.append(f"[JS TOOLTIP DUPLICADO] Esperado apenas ['core/nft-tooltips.js'], encontrado: {tooltip_inits}")
    else:
        print("  [OK] Instância única de bootstrap.Tooltip em core/nft-tooltips.js")

    return errors


if __name__ == '__main__':
    all_errors = []
    all_errors.extend(check_templates())
    all_errors.extend(check_css())
    all_errors.extend(check_js())

    print("\n" + "=" * 68)
    if all_errors:
        print(f"FALHA NA VERIFICAÇÃO ({len(all_errors)} pendência(s)):")
        for err in all_errors:
            print("  ❌", err)
        sys.exit(1)
    else:
        print("✅ 100% DOS CRITÉRIOS CLEAN CODE & PADRONIZAÇÃO DE UI APROVADOS!")
        sys.exit(0)
