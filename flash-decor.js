/**
 * flash-decor.js — Micael Tatuagem
 * Fractal de flash: múltiplas passagens decrescentes preenchem
 * cada buraco deixado pela passagem anterior.
 * Para adicionar novos desenhos: subir .webp em /flash/ e
 * adicionar o nome em flash/manifest.json.
 */
(function () {
  'use strict';

  const BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    if (s) return s.replace(/flash-decor\.js.*$/, '');
    return '/tatuagem/';
  })();

  const MANIFEST  = BASE + 'flash/manifest.json';
  const CACHE_KEY = 'flash_pool_v5';
  const EXCLUIR   = new Set(['caveiraDireita.webp', 'caveiraEsquerda.webp']);

  // ── Pool ────────────────────────────────────────────────────
  async function getPool() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
    try {
      const r = await fetch(MANIFEST + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const list = await r.json();
      const pool = list
        .filter(n => n.endsWith('.webp') && !EXCLUIR.has(n))
        .map(n => BASE + 'flash/' + n);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(pool));
      return pool;
    } catch {
      return [
        'adaga','aguia1','aguia2','aguia3','ampulheta','ancora1','ancora2','ancora3',
        'andorinha1','andorinha2','andorinha3','anjinho','aranha','bola8','bolaCristal',
        'borboleta','bota','calice','caravela','caravela2','cartas','caveira',
        'caveira3quartos','caveiraChamas','caveiraFrontal','caveiraOssos','caveiraSerpente',
        'chapeu','cigana1','cigana2','cigana3','clown','coracao','coracaoAdaga',
        'coracaoPartido','dados','dados2','dragao1','dragao2','dragao3','dragao4',
        'dragao5','dragao6','dragao7','dragao8','dragao9','dragao10','dragao11','dragao12',
        'escorpiao','escorpiao2','espadaCoracao','estrela','faca','fantasminha','farol',
        'farol2','ferradura1','ferradura2','ferradura3','flames','flor','forever',
        'HangBones','hula','lobo','love','lua','lua2','mao','maosOracao','marinheira',
        'mariposa','mariposa2','mom','mom2','morte','morte2','olho','olho2','palmeira',
        'pantera','pantera2','pinup','pinup2','pinup3','pinup4','rip','rosa1','rosa2',
        'rosa3','rosaAdaga','rosaAdaga2','rosaAdaga3','rosinha','serpente1','serpente2',
        'serpente3','serpente4','serpente5','serpente6','serpente7','sol','teia','tigre',
        'tigre2','trueLove','tubarao','vela','veneno','zippo'
      ].filter(n => !EXCLUIR.has(n + '.webp'))
       .map(n => BASE + 'flash/' + n + '.webp');
    }
  }

  // ── Utilitários ─────────────────────────────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ── Passagens fractais ───────────────────────────────────────
  // Cada passagem tem: raio de colisão, tamanho CSS, opacidade, quantidade base
  // OVERLAP: quanto maior, mais espaçados ficam os ícones (evita "mancha" de acúmulo de transparência)
  const OVERLAP = 1.35;

  const PASSES = [
    // [r_colisão_px, width_css,                        op_range,        n_base]
    [ 130, 'clamp(160px,22vw,300px)',                  [0.09, 0.12],    5  ],
    [  80, 'clamp(95px,13vw,175px)',                   [0.08, 0.11],    8  ],
    [  48, 'clamp(55px,8vw,105px)',                    [0.07, 0.10],    14 ],
    [  26, 'clamp(28px,4.5vw,58px)',                   [0.06, 0.09],    22 ],
    [  13, 'clamp(14px,2.2vw,28px)',                   [0.05, 0.08],    32 ],
    [   6, 'clamp(7px,1.1vw,14px)',                    [0.04, 0.07],    45 ],
  ];

  function overlaps(placed, cx, cy, r) {
    for (const p of placed) {
      const dx = cx - p.cx, dy = cy - p.cy;
      if (Math.sqrt(dx * dx + dy * dy) < (r + p.r) * OVERLAP) return true;
    }
    return false;
  }

  function inGuard(cx, cy, r, guardRects, elLeft, elTop) {
    for (const g of guardRects) {
      if ((elLeft + cx) > g.left  - r && (elLeft + cx) < g.right  + r &&
          (elTop  + cy) > g.top   - r && (elTop  + cy) < g.bottom + r) return true;
    }
    return false;
  }

  function isHeroCenterBlocked(el, cx, cy) {
    return false; // sem zona protegida no hero — imagem fica acima via z-index
  }

  function runPass(el, pool, placed, passR, passCss, opRange, nBase, guardRects) {
    const rect  = el.getBoundingClientRect();
    const W     = rect.width  || el.offsetWidth  || window.innerWidth;
    const H     = rect.height || el.offsetHeight || 400;
    if (W < 10 || H < 10) return;

    const elLeft = rect.left + window.scrollX;
    const elTop  = rect.top  + window.scrollY;

    // Quantidade proporcional à área da seção
    const area   = W * H;
    const refArea = 960 * 500;
    const n      = Math.round(nBase * Math.min(2.2, Math.max(0.5, area / refArea)));
    const imgs   = shuffle(pool).slice(0, Math.min(n * 3, pool.length)); // pool generoso
    let placed_count = 0;

    for (const src of imgs) {
      if (placed_count >= n) break;
      const MAX = 200;
      for (let t = 0; t < MAX; t++) {
        const cx = rnd(passR, W - passR);
        const cy = rnd(passR, H - passR);
        if (overlaps(placed, cx, cy, passR)) continue;
        if (guardRects.length && inGuard(cx, cy, passR, guardRects, elLeft, elTop)) continue;
        // isHeroCenterBlocked desativado

        placed.push({ cx, cy, r: passR });
        placed_count++;

        const img       = document.createElement('img');
        img.src         = src;
        img.alt         = '';
        img.loading     = 'lazy';
        img.decoding    = 'async';

        const rot  = rnd(-40, 40).toFixed(1);
        const op   = (opRange[0] + Math.random() * (opRange[1] - opRange[0])).toFixed(3);
        // Em paginas de fundo claro (data-decor-light no <body>), os icones sao pretos
        // sobre transparente: sem inverter, ja ficam com cara de traco a lapis sobre o
        // papel. Em paginas de fundo escuro, inverte pra bone/branco como sempre.
        // A cor do decor agora e por secao (nao por pagina inteira): uma secao com
        // data-decor-light fica com o traco preto original (efeito lapis sobre fundo
        // claro); sem esse atributo, inverte pra bone/branco (fundo escuro), como sempre.
        const lightBg = el.closest('[data-decor-light]') !== null;
        const filterCss = lightBg ? '' : 'filter:invert(1);';

        img.style.cssText = [
          'position:absolute',
          'pointer-events:none',
          'user-select:none',
          filterCss,
          'height:auto',
          'z-index:0',
          `width:${passCss}`,
          `opacity:${op}`,
          `left:${((cx / W) * 100).toFixed(2)}%`,
          `top:${((cy / H) * 100).toFixed(2)}%`,
          `transform:translate(-50%,-50%) rotate(${rot}deg)`,
        ].join(';');

        el.appendChild(img);
        break;
      }
    }
  }

  // ── Guard rects (fotos da galeria) ──────────────────────────
  function getGuardRects() {
    const guards = [];
    document.querySelectorAll(
      '#galeria img[src*="galeria/"], .gallery-grid img, figure img, .carousel-frame img, .flash-poster'
    ).forEach(img => {
      const r = img.getBoundingClientRect();
      if (r.width > 80) {
        guards.push({
          top:    r.top    + window.scrollY - 20,
          left:   r.left   + window.scrollX - 20,
          bottom: r.bottom + window.scrollY + 20,
          right:  r.right  + window.scrollX + 20,
        });
      }
    });
    return guards;
  }

  // ── Config por página ────────────────────────────────────────
  function getSelectors() {
    const path = window.location.pathname;
    if (path.includes('galeria'))  return ['header','section','main','footer'];
    if (path.includes('cadastro')) return ['header','section','main','footer'];
    if (path.includes('reserva'))  return ['header','section','main','footer'];
    if (path.includes('anamnese')) return ['header','section','main','footer'];
    if (path.includes('flash'))    return ['header','section','main','footer'];
    if (path.includes('fisiologia-da-tatuagem')) return ['header','section','main','footer'];
    if (path.includes('valor')) return ['header','main','footer'];
    // index / default
    return ['#hero','#sobre','#galeria','#processo','#faq','#promocoes','#contato'];
  }

  // ── Init ────────────────────────────────────────────────────
  async function init() {
    const pool = await getPool();
    if (!pool.length) return;

    await new Promise(r => setTimeout(r, 500));
    const guards = getGuardRects();
    const sels   = getSelectors();

    requestAnimationFrame(() => {
      sels.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const pos = getComputedStyle(el).position;
          if (pos === 'static') el.style.position = 'relative';

          // placed é compartilhado entre todas as passagens da mesma seção
          const placed = [];
          PASSES.forEach(([r, css, opRange, nBase]) => {
            runPass(el, pool, placed, r, css, opRange, nBase, guards);
          });
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
