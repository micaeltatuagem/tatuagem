import re

# NOTA (atualizado nesta sessão): reorganização do menu em grupos hierárquicos
# por intenção do visitante (Tatuagens / Conheça / Planeje / Estúdio), com
# Reserva mantido como botão de destaque isolado, fora de qualquer dropdown.
# WhatsApp entra dentro do grupo "Conheça"... na verdade fica junto de Reserva
# como ação de contato direto (ver GROUPS abaixo).

# (chave, rótulo, tipo, destino)
# tipo 'page'   -> destino é a URL limpa (sem .html)
# tipo 'anchor' -> destino é o id da âncora, que vive só no index.html (ou noutra página com prefixo)
# tipo 'anchor_on' -> âncora que vive numa página específica que não é a index (ex: valor#layaway)
# tipo 'external' -> link absoluto externo (ex: wa.me)
ITEMS = {
    'galeria':      ('Galeria', 'galeria_special', None),
    'flash':        ('Flash', 'page', 'flash'),
    'estilos':      ('Estilos', 'page', 'estilo/'),
    'sobre':        ('Sobre', 'anchor', 'sobre'),
    'guia':         ('Guia', 'page', 'guia'),
    'blog':         ('Blog', 'page', 'blog'),
    'cuidados':     ('Cuidados', 'page', 'fisiologia-da-tatuagem'),
    'criar':        ('Criar', 'page', 'preview-tatuagem'),
    'valor':        ('Valor', 'page', 'valor'),
    'layaway':      ('Layaway', 'anchor_on', ('valor', 'layaway')),
    'localizacao':  ('Localização', 'anchor', 'localizacao'),
    'contato':      ('Contato', 'anchor', 'contato'),
    'aerografia':   ('Aerografia', 'page', 'aerografia'),
    'promocoes':    ('Promoções', 'anchor', 'promocoes'),
    'whatsapp':     ('WhatsApp', 'external', 'https://wa.me/5532999666946'),
    'reserva':      ('Reserva', 'page', 'reserva'),
}

# Grupos hierárquicos do dropdown (5 grupos + Reserva como botão isolado)
GROUPS = [
    ('Tatuagens', ['galeria', 'flash', 'estilos']),
    ('Conheça',   ['sobre', 'guia', 'blog', 'cuidados']),
    ('Planeje',   ['criar', 'valor', 'layaway', 'promocoes']),
    ('Agende',    ['whatsapp']),  # Reserva fica fora, como botão de destaque
    ('Estúdio',   ['localizacao', 'contato', 'aerografia']),
]

# mapa: chave do item -> nome de arquivo real que representa essa página (pra marcar "atual")
KEY_TO_SELF_FILE = {
    'flash': 'flash.html', 'criar': 'preview-tatuagem.html', 'guia': 'guia.html',
    'blog': 'blog.html',
    'reserva': 'reserva.html', 'aerografia': 'aerografia.html',
    'cuidados': 'fisiologia-da-tatuagem.html', 'valor': 'valor.html',
    'galeria': 'galeria.html', 'estilos': 'estilo/index.html',
}

def build_href(kind, dest):
    # SEMPRE caminhos absolutos (com "/"), independente da página atual.
    # Corrige a inconsistência encontrada entre index.html (relativo),
    # blog.html/estilo/* (absoluto) e guia.html (misturado/quebrado).
    if kind == 'galeria_special':
        return '/galeria'
    if kind == 'page':
        return '/' + dest
    if kind == 'anchor':
        return '/#' + dest
    if kind == 'anchor_on':
        page, anchor_id = dest
        return f'/{page}#{anchor_id}'
    if kind == 'external':
        return dest
    raise ValueError(kind)

def build_nav(current_file):
    is_index = (current_file == 'index.html')
    logo_href = '/#hero' if is_index else '/'

    def li(key, extra_class=''):
        label, kind, dest = ITEMS[key]
        href = build_href(kind, dest)
        classes = []
        if extra_class:
            classes.append(extra_class)
        self_file = KEY_TO_SELF_FILE.get(key)
        if self_file and self_file == current_file:
            classes.append('atual')
        cls_attr = f' class="{" ".join(classes)}"' if classes else ''
        target = ' target="_blank" rel="noopener"' if kind == 'external' else ''
        return f'<a href="{href}"{cls_attr}{target}>{label}</a>'

    def slugify_group(label):
        return label.lower().replace('ç', 'c').replace('ú', 'u').replace('é', 'e')

    # ── nav-links (visível): 5 botões de grupo (desktop) + itens
    # achatados duplicados pro mobile (mesmo truque já usado hoje pros
    # itens "extra") + botão de Reserva em destaque ──────────────────
    nav_links = []
    for group_label, keys in GROUPS:
        gslug = slugify_group(group_label)
        nav_links.append(
            f'    <li class="nav-group">\n'
            f'      <button type="button" class="nav-group-btn" data-group="{gslug}" '
            f'aria-haspopup="true" aria-expanded="false">{group_label} &#9662;</button>\n'
            f'    </li>'
        )
    for group_label, keys in GROUPS:
        for k in keys:
            nav_links.append(f'    <li class="nav-mobile-item">{li(k)}</li>')
    nav_links.append(f'    <li class="nav-cta">{li("reserva", "nav-reserva-btn")}</li>')

    nav_html = []
    nav_html.append('<nav>')
    nav_html.append(f'  <a href="{logo_href}" class="nav-logo"><img src="/nav-icon.webp" alt="" width="28" height="28">Micael Tatuagem</a>')
    nav_html.append('  <ul class="nav-links">')
    nav_html.extend(nav_links)
    nav_html.append('  </ul>')
    nav_html.append('  <button type="button" class="nav-toggle" aria-label="Abrir menu" aria-expanded="false">')
    nav_html.append('    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">')
    nav_html.append('      <path class="ico-bars" d="M4 7h16M4 12h16M4 17h16"/>')
    nav_html.append('      <path class="ico-x" d="M6 6l12 12M18 6L6 18"/>')
    nav_html.append('    </svg>')
    nav_html.append('  </button>')
    nav_html.append('</nav>')

    return '\n'.join(nav_html)

def build_group_panels():
    """Painéis dos 5 grupos, como IRMÃOS do <nav> (fora dele), no mesmo
    padrão já usado hoje pelo .nav-more-panel — evitado ficar aninhado
    pra não correr risco de ser cortado por algum overflow:hidden
    decorativo de outras seções da página (bug que já aconteceu antes)."""
    def li(key):
        label, kind, dest = ITEMS[key]
        href = build_href(kind, dest)
        target = ' target="_blank" rel="noopener"' if kind == 'external' else ''
        return f'  <li><a href="{href}"{target}>{label}</a></li>'

    def slugify_group(label):
        return label.lower().replace('ç', 'c').replace('ú', 'u').replace('é', 'e')

    blocks = []
    for group_label, keys in GROUPS:
        gslug = slugify_group(group_label)
        items = '\n'.join(li(k) for k in keys)
        blocks.append(f'<ul class="nav-group-panel" data-panel="{gslug}">\n{items}\n</ul>')
    return '\n'.join(blocks)

def build_nav_block(current_file):
    """HTML completo pronto pra colar na página: <nav> + os 5 painéis
    de grupo como irmãos logo em seguida."""
    return build_nav(current_file) + '\n' + build_group_panels()

if __name__ == '__main__':
    print(build_nav_block('index.html'))
    print('\n---\n')
    print(build_nav_block('estilo/blackwork.html'))
