import re

# (chave, rótulo, tipo, destino)
# tipo 'page'   -> destino é o nome do arquivo (mesmo em toda página)
# tipo 'anchor' -> destino é o id da âncora, que vive só no index.html
VISIBLE = [
    ('galeria', 'Galeria', 'galeria_special', None),
    ('flash', 'Flash', 'page', 'flash.html'),
    ('criar', 'Criar', 'page', 'preview-tatuagem.html'),
    ('guia', 'Guia', 'page', 'guia.html'),
    ('reserva', 'Reserva', 'page', 'reserva.html'),
    ('contato', 'Contato', 'anchor', 'contato'),
]
EXTRA = [
    ('sobre', 'Sobre', 'anchor', 'sobre'),
    ('aerografia', 'Aerografia', 'page', 'aerografia.html'),
    ('cuidados', 'Cuidados', 'page', 'fisiologia-da-tatuagem.html'),
    ('valor', 'Valor', 'page', 'valor.html'),
    ('promocoes', 'Promoções', 'anchor', 'promocoes'),
    ('localizacao', 'Localização', 'anchor', 'localizacao'),
]

# mapa: chave do item -> nome de arquivo que representa essa página (pra marcar "atual")
KEY_TO_SELF_FILE = {
    'flash': 'flash.html', 'criar': 'preview-tatuagem.html', 'guia': 'guia.html',
    'reserva': 'reserva.html', 'aerografia': 'aerografia.html',
    'cuidados': 'fisiologia-da-tatuagem.html', 'valor': 'valor.html',
    'galeria': 'galeria.html',
}

def build_href(kind, dest, current_file, is_index, prefix):
    if kind == 'galeria_special':
        return '#galeria' if is_index else (prefix + 'galeria.html')
    if kind == 'page':
        return prefix + dest
    if kind == 'anchor':
        return ('#' + dest) if is_index else (prefix + 'index.html#' + dest)
    raise ValueError(kind)

def build_nav(current_file):
    is_index = (current_file == 'index.html')
    is_estilo = current_file.startswith('estilo/')
    prefix = '/' if is_estilo else ''
    logo_href = ('#hero' if is_index else (prefix + 'index.html'))

    def li(key, label, kind, dest, extra_class=''):
        href = build_href(kind, dest, current_file, is_index, prefix)
        classes = []
        if extra_class:
            classes.append(extra_class)
        self_file = KEY_TO_SELF_FILE.get(key)
        if self_file and self_file == current_file:
            classes.append('atual')
        cls_attr = f' class="{" ".join(classes)}"' if classes else ''
        return f'<a href="{href}"{cls_attr}>{label}</a>'

    visible_lis = []
    for key, label, kind, dest in VISIBLE:
        visible_lis.append(f'    <li>{li(key, label, kind, dest)}</li>')

    extra_by_key = {}
    panel_lis = []
    for key, label, kind, dest in EXTRA:
        extra_by_key[key] = f'    <li class="nav-extra">{li(key, label, kind, dest)}</li>'
        panel_lis.append(f'  <li>{li(key, label, kind, dest)}</li>')

    nav_html = []
    nav_html.append('<nav>')
    nav_html.append(f'  <a href="{logo_href}" class="nav-logo"><img src="{prefix}nav-icon.webp" alt="" width="28" height="28">Micael Tatuagem</a>')
    nav_html.append('  <ul class="nav-links">')
    nav_html.append(extra_by_key['sobre'])
    nav_html.append(f'    <li>{li(*VISIBLE[0])}</li>')  # Galeria
    nav_html.append(f'    <li>{li(*VISIBLE[1])}</li>')  # Flash
    nav_html.append(extra_by_key['aerografia'])
    nav_html.append(f'    <li>{li(*VISIBLE[2])}</li>')  # Criar
    nav_html.append(f'    <li>{li(*VISIBLE[3])}</li>')  # Guia
    nav_html.append(extra_by_key['cuidados'])
    nav_html.append(extra_by_key['valor'])
    nav_html.append(extra_by_key['promocoes'])
    nav_html.append(extra_by_key['localizacao'])
    nav_html.append(f'    <li>{li(*VISIBLE[4])}</li>')  # Reserva
    nav_html.append(f'    <li>{li(*VISIBLE[5])}</li>')  # Contato
    nav_html.append('    <li class="nav-more">')
    nav_html.append('      <button type="button" class="nav-more-btn" aria-haspopup="true" aria-expanded="false">Mais &#9662;</button>')
    nav_html.append('    </li>')
    nav_html.append('  </ul>')
    nav_html.append('  <button type="button" class="nav-toggle" aria-label="Abrir menu" aria-expanded="false">')
    nav_html.append('    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">')
    nav_html.append('      <path class="ico-bars" d="M4 7h16M4 12h16M4 17h16"/>')
    nav_html.append('      <path class="ico-x" d="M6 6l12 12M18 6L6 18"/>')
    nav_html.append('    </svg>')
    nav_html.append('  </button>')
    nav_html.append('</nav>')
    nav_html.append('<ul class="nav-more-panel">')
    nav_html.extend(panel_lis)
    nav_html.append('</ul>')

    return '\n'.join(nav_html)

if __name__ == '__main__':
    print(build_nav('index.html'))
    print('\n---\n')
    print(build_nav('estilo/blackwork.html'))
