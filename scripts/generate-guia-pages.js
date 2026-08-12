#!/usr/bin/env node
/**
 * Gera uma página HTML estática para cada verbete do Guia (tabela
 * guia_verbetes no Supabase), no padrão guia/<slug>/index.html.
 *
 * Rodado pela GitHub Action .github/workflows/generate-guia-pages.yml,
 * disparada automaticamente por um Database Webhook do Supabase toda
 * vez que um verbete é criado, editado ou apagado pelo admin.
 *
 * Uso local (opcional, pra testar antes de commitar):
 *   node scripts/generate-guia-pages.js
 */

const fs = require('fs');
const path = require('path');

// mesmas credenciais públicas usadas no resto do site (chave anon, só leitura aqui)
const SUPABASE_URL = 'https://rpgcsejfewltricfsdrd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7LF70sbQS_es_uco138rqw_YfbqnIsa';
const BUCKET_IMAGENS = 'guia-imagens';

const OUTPUT_DIR = path.join(__dirname, '..', 'guia');

const CATEGORIAS = {
  significado: 'Significado',
  estilo: 'Estilo',
  tecnica: 'Técnica',
  termo: 'Termo'
};

function urlImagem(caminho) {
  if (!caminho) return '';
  if (/^https?:\/\//i.test(caminho)) return caminho;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_IMAGENS}/${caminho}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragrafos(texto) {
  return String(texto || '')
    .split(/\n{2,}/)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n        ');
}

function renderPagina(v) {
  const categoriaLabel = CATEGORIAS[v.categoria] || v.categoria;
  const titulo = escapeHtml(v.termo);
  const tituloSeo = escapeHtml(v.seo_title || `${v.termo} — ${categoriaLabel} de Tatuagem`);
  const metaDesc = escapeHtml(v.meta_description || v.descricao || '').slice(0, 160);
  const img = urlImagem(v.imagem_url);
  const imgAlt = escapeHtml(v.imagem_alt || v.termo);
  const url = `https://micaeltatuagem.com.br/guia/${v.slug}`;
  const linkBusca = `/flash?q=${encodeURIComponent(v.termo)}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-JB6GZM1DFM"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-JB6GZM1DFM');
</script>

<title>${tituloSeo} | Micael Tatuagem</title>
<meta name="description" content="${metaDesc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${titulo} | Guia · Micael Tatuagem">
<meta property="og:description" content="${metaDesc}">
<meta property="og:image" content="${img || 'https://micaeltatuagem.com.br/skull.webp'}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Micael Tatuagem">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titulo} | Guia · Micael Tatuagem">
<meta name="twitter:description" content="${metaDesc}">
<meta name="twitter:image" content="${img || 'https://micaeltatuagem.com.br/skull.webp'}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Micael Tatuagem",
  "description": "Tatuador em Muriaé-MG especializado em blackwork, dark art, colorido e ornamental, atendendo clientes de toda a Zona da Mata mineira.",
  "url": "https://micaeltatuagem.com.br/",
  "image": "https://micaeltatuagem.com.br/hero-bg.webp",
  "telephone": "+55-32-99966-6946",
  "email": "micaeltattoo@gmail.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rua Astrogildo Figueiredo de Barros, 469",
    "addressLocality": "Muriaé",
    "addressRegion": "MG",
    "postalCode": "36880-000",
    "addressCountry": "BR"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": -21.1265, "longitude": -42.3682 },
  "sameAs": ["https://instagram.com/micaeltatuagem"],
  "priceRange": "R$ 150+"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://micaeltatuagem.com.br/" },
    { "@type": "ListItem", "position": 2, "name": "Guia", "item": "https://micaeltatuagem.com.br/guia" },
    { "@type": "ListItem", "position": 3, "name": "${titulo}", "item": "${url}" }
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "DefinedTerm",
  "name": "${titulo}",
  "description": "${metaDesc}",
  "inDefinedTermSet": "https://micaeltatuagem.com.br/guia"
}
</script>

<style>
  :root {
    --bg:        #0a0a0a;
    --surface:   #111111;
    --border:    #1e1e1e;
    --border-hi: #2e2e2e;
    --ink:       #e8e8e8;
    --ink-muted: #777777;
    --ink-faint: #333333;
    --accent:    #c8a96e;
    --accent-dim:#7a6340;
    --radius:    3px;
    --font-body: 'Georgia', 'Times New Roman', serif;
    --font-ui:   system-ui, -apple-system, 'Helvetica Neue', sans-serif;
    --max:       780px;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--font-body); line-height:1.65; }
  .inner { max-width: var(--max); margin:0 auto; padding: 0 1.5rem; }
  a { color: inherit; }

  nav {
    display:flex; align-items:center; justify-content:space-between;
    padding:1.1rem 1.5rem; border-bottom:1px solid var(--border);
    font-family: var(--font-ui); position:sticky; top:0; background:rgba(10,10,10,.92);
    backdrop-filter: blur(6px); z-index:40;
  }
  .nav-logo { font-family: var(--font-body); font-size:1.05rem; text-decoration:none; color:var(--ink); }
  .nav-links { list-style:none; display:flex; gap:1.4rem; margin:0; padding:0; font-size:.85rem; overflow-x:auto; white-space:nowrap; }
  .nav-links a { text-decoration:none; color:var(--ink-muted); }
  .nav-links a:hover, .nav-links a.atual { color: var(--accent); }
  @media (max-width:700px){ .nav-logo{ display:none; } }

  .breadcrumb { font-family: var(--font-ui); font-size:.78rem; color:var(--ink-faint); padding: 1.5rem 0 0; }
  .breadcrumb a { color:var(--ink-faint); text-decoration:none; }
  .breadcrumb a:hover { color:var(--accent); }

  header.hero { padding: 1rem 0 2rem; border-bottom:1px solid var(--border); }
  .eyebrow { font-family: var(--font-ui); text-transform:uppercase; letter-spacing:.12em; font-size:.72rem; color:var(--accent); margin:0 0 .6rem; }
  h1 { font-weight:400; font-size:2.4rem; margin:0; }

  .verbete-imagem { width:100%; max-height:420px; object-fit:contain; background:#e8e0c9; border-radius:var(--radius); margin: 2rem 0; padding:1.5rem; display:block; }

  .conteudo { font-size:1.08rem; padding: 1rem 0 2rem; }
  .conteudo p { margin: 0 0 1.2rem; }

  .cta-box {
    display:flex; flex-wrap:wrap; gap:.8rem; padding: 1.5rem 0 2.5rem; border-bottom: 1px solid var(--border);
  }
  .cta-btn {
    font-family: var(--font-ui); font-size:.82rem; text-decoration:none; padding:.75rem 1.3rem;
    border-radius: 999px; letter-spacing:.03em;
  }
  .cta-btn.primario { background: var(--accent); color:#0a0a0a; }
  .cta-btn.secundario { border:1px solid var(--accent-dim); color:var(--ink); }

  .faq { padding: 2.5rem 0; }
  .faq-title { font-family: var(--font-ui); font-size:1.1rem; color:var(--accent); margin: 0 0 1.2rem; }
  .faq-item { margin-bottom: 1.1rem; }
  .faq-q { font-family: var(--font-ui); font-size:.95rem; color:var(--ink); margin: 0 0 .3rem; }
  .faq-a { font-family: var(--font-ui); font-size:.85rem; color:var(--ink-muted); margin:0; }

  .voltar { display:inline-block; margin: 1rem 0 2rem; font-family: var(--font-ui); font-size:.82rem; color:var(--ink-muted); text-decoration:none; }
  .voltar:hover { color: var(--accent); }

  footer {
    font-family: var(--font-ui); font-size:.78rem; color: var(--ink-faint);
    text-align:center; padding: 3rem 1.5rem 2rem; border-top:1px solid var(--border); margin-top:2rem;
  }
  footer a { color: var(--ink-faint); text-decoration:none; }
</style>
<link rel="stylesheet" href="/nav-mobile.css">
</head>
<body>

<nav>
  <a href="/" class="nav-logo"><img src="/nav-icon.webp" alt="" width="28" height="28">Micael Tatuagem</a>
  <ul class="nav-links">
    <li class="nav-extra"><a href="/#sobre">Sobre</a></li>
    <li><a href="/galeria">Galeria</a></li>
    <li><a href="/flash">Flash</a></li>
    <li class="nav-extra"><a href="/aerografia">Aerografia</a></li>
    <li><a href="/preview-tatuagem">Criar</a></li>
    <li><a href="/guia" class="atual">Guia</a></li>
    <li class="nav-extra"><a href="/fisiologia-da-tatuagem">Cuidados</a></li>
    <li class="nav-extra"><a href="/valor">Valor</a></li>
    <li class="nav-extra"><a href="/#promocoes">Promoções</a></li>
    <li class="nav-extra"><a href="/#localizacao">Localização</a></li>
    <li><a href="/blog">Blog</a></li>
    <li><a href="/reserva">Reserva</a></li>
    <li><a href="/#contato">Contato</a></li>
    <li class="nav-more">
      <button type="button" class="nav-more-btn" aria-haspopup="true" aria-expanded="false">Mais &#9662;</button>
    </li>
  </ul>
  <button type="button" class="nav-toggle" aria-label="Abrir menu" aria-expanded="false">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path class="ico-bars" d="M4 7h16M4 12h16M4 17h16"/>
      <path class="ico-x" d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</nav>
<ul class="nav-more-panel">
  <li><a href="/#sobre">Sobre</a></li>
  <li><a href="/aerografia">Aerografia</a></li>
  <li><a href="/fisiologia-da-tatuagem">Cuidados</a></li>
  <li><a href="/valor">Valor</a></li>
  <li><a href="/#promocoes">Promoções</a></li>
  <li><a href="/#localizacao">Localização</a></li>
</ul>

<div class="inner">
  <p class="breadcrumb"><a href="/">Home</a> / <a href="/guia">Guia</a> / ${titulo}</p>

  <header class="hero">
    <p class="eyebrow">${categoriaLabel}</p>
    <h1>${titulo}</h1>
  </header>

  ${img ? `<img class="verbete-imagem" src="${img}" alt="${imgAlt}">` : ''}

  <div class="conteudo">
        ${paragrafos(v.corpo || v.descricao)}
  </div>

  <div class="cta-box">
    <a class="cta-btn primario" href="https://wa.me/5532999666946?text=${encodeURIComponent(`Oi Micael! Vi o verbete "${v.termo}" no Guia e quero saber mais.`)}" target="_blank" rel="noopener">Chamar no WhatsApp</a>
    <a class="cta-btn secundario" href="${linkBusca}">Ver mais tatuagens de ${escapeHtml(v.termo.toLowerCase())} →</a>
    ${v.link_estilo ? `<a class="cta-btn secundario" href="${v.link_estilo}">Ver estilo na galeria →</a>` : ''}
  </div>

  <div class="faq">
    <h2 class="faq-title">Dúvidas sobre esse verbete</h2>
    <div class="faq-item">
      <p class="faq-q">Posso tatuar "${titulo}" do jeito que está descrito aqui?</p>
      <p class="faq-a">Sim. Se quiser esse desenho ou tema específico, chame no WhatsApp com o nome do verbete pra combinar tamanho, local do corpo e agenda.</p>
    </div>
    <div class="faq-item">
      <p class="faq-q">Dá pra adaptar o significado ou o traço pra algo mais pessoal?</p>
      <p class="faq-a">Sim, o conteúdo aqui é ponto de partida. Composições, tamanho e nível de detalhe são combinados em consulta antes da sessão.</p>
    </div>
  </div>

  <a class="voltar" href="/guia">← Voltar ao Guia completo</a>
</div>

<footer>
  <span>© Micael Faccio · Tatuador em Muriaé, MG</span>
</footer>

<script src="/nav-mobile.js" defer></script>
</body>
</html>
`;
}

async function main() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/guia_verbetes?select=*&draft=eq.false&order=slug.asc`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!resp.ok) {
    throw new Error(`Falha ao buscar verbetes no Supabase: ${resp.status} ${await resp.text()}`);
  }

  const verbetes = await resp.json();
  console.log(`Encontrados ${verbetes.length} verbetes publicados.`);

  // limpa o diretório de saída antes de regenerar, pra remover páginas de
  // verbetes que foram apagados ou virados rascunho
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const v of verbetes) {
    if (!v.slug) continue;
    const dir = path.join(OUTPUT_DIR, v.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPagina(v));
    console.log(`  gerado: guia/${v.slug}/index.html`);
  }

  console.log('Concluído.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
