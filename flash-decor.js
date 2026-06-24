/**
 * flash-decor.js — Micael Tatuagem
 * Decorativos aleatórios do /flash/ em todas as páginas.
 * Para adicionar novos desenhos: só subir o .webp para /flash/
 * e atualizar flash/manifest.json com o novo nome.
 */
(function () {
  'use strict';

  const BASE        = (function() {
    // Detecta se estamos em GitHub Pages ou local
    const s = document.currentScript && document.currentScript.src;
    if (s) return s.replace(/flash-decor\.js.*$/, '');
    return '/tatuagem/';
  })();

  const MANIFEST    = BASE + 'flash/manifest.json';
  const CACHE_KEY   = 'flash_pool_v2';
  const EXCLUIR     = new Set(['caveiraDireita.webp', 'caveiraEsquerda.webp']);

  // ── Pool de imagens ──────────────────────────────────────────
  async function getPool() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
    try {
      const r = await fetch(MANIFEST + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const list = await r.json(); // array de nomes ex: ["adaga.webp","aguia1.webp",...]
      const pool = list
        .filter(n => n.endsWith('.webp') && !EXCLUIR.has(n))
        .map(n => BASE + 'flash/' + n);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(pool));
      return pool;
    } catch {
      // Fallback embutido — atualizar junto com manifest.json quando necessário
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

  // ── Utilitários ──────────────────────────────────────────────
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

  // ── Tamanhos ─────────────────────────────────────────────────
  // r = raio de colisão em px (para cálculo); css = valor real
  const SIZES = {
    xs:  { r: 38,  css: 'clamp(45px,5vw,80px)'    },
    sm:  { r: 60,  css: 'clamp(75px,9vw,130px)'   },
    md:  { r: 85,  css: 'clamp(105px,13vw,180px)' },
    lg:  { r: 120, css: 'clamp(145px,19vw,260px)' },
    xl:  { r: 160, css: 'clamp(190px,26vw,340px)' },
  };
  const SIZE_KEYS = Object.keys(SIZES);

  // Opacidades
  const OPS = [0.15, 0.18, 0.22, 0.26, 0.30];

  // Tolerância de sobreposição: os círculos podem se tocar e
  // até cruzar levemente (fator < 1 = permite sobreposição parcial)
  const OVERLAP_FACTOR = 0.72; // 1.0 = só toca; 0 = pode encavalhar total

  function overlaps(placed, cx, cy, r) {
    for (const p of placed) {
      const dx = cx - p.cx, dy = cy - p.cy;
      const minDist = (r + p.r) * OVERLAP_FACTOR;
      if (Math.sqrt(dx * dx + dy * dy) < minDist) return true;
    }
    return false;
  }

  // ── Packing por seção ────────────────────────────────────────
  function packSection(el, pool, count, guardRects) {
    const rect = el.getBoundingClientRect();
    const W = rect.width  || el.offsetWidth  || window.innerWidth;
    const H = rect.height || el.offsetHeight || 400;
    if (W < 10 || H < 10) return;

    // Garante position:relative para que os filhos absolutos funcionem
    const pos = getComputedStyle(el).position;
    if (pos === 'static') el.style.position = 'relative';

    const imgs   = shuffle(pool).slice(0, count);
    const placed = [];

    imgs.forEach(src => {
      const MAX_TRIES = 100;

      for (let t = 0; t < MAX_TRIES; t++) {
        // Bordas têm 60% de chance — preenchimento natural sem sobrar centro vazio
        const borda = Math.random() < 0.60;
        let cx, cy;

        if (borda) {
          const lado = Math.floor(Math.random() * 4);
          const faixa = 0.18;
          if      (lado === 0) { cx = rnd(0, W * faixa);      cy = rnd(0, H); }
          else if (lado === 1) { cx = rnd(W * (1-faixa), W);  cy = rnd(0, H); }
          else if (lado === 2) { cx = rnd(0, W);              cy = rnd(0, H * faixa); }
          else                 { cx = rnd(0, W);              cy = rnd(H * (1-faixa), H); }
        } else {
          cx = rnd(W * 0.10, W * 0.90);
          cy = rnd(H * 0.10, H * 0.90);
        }

        // Tamanho: bordas preferem lg/xl; interior xs/sm/md
        const szKey = borda
          ? pick(['lg','lg','xl','xl','md','sm'])
          : pick(['xs','xs','sm','sm','md','md','lg']);
        const sz = SIZES[szKey];
        const r  = sz.r;

        if (overlaps(placed, cx, cy, r)) continue;

        // Verifica se cai dentro de uma zona protegida (galeria)
        // guardRects são coords relativas ao elemento pai
        const elTop  = rect.top  + window.scrollY;
        const elLeft = rect.left + window.scrollX;
        const absCx  = elLeft + cx;
        const absCy  = elTop  + cy;
        let bloqueado = false;
        for (const g of (guardRects || [])) {
          if (absCx > g.left - r && absCx < g.right  + r &&
              absCy > g.top  - r && absCy < g.bottom + r) {
            bloqueado = true;
            break;
          }
        }
        if (bloqueado) continue;

        placed.push({ cx, cy, r });

        const img = document.createElement('img');
        img.src          = src;
        img.alt          = '';
        img.loading      = 'lazy';
        img.decoding     = 'async';

        const rot  = rnd(-35, 35).toFixed(1);
        const flip = Math.random() > 0.5 ? ' scaleX(-1)' : '';
        const op   = pick(OPS);

        img.style.cssText = [
          'position:absolute',
          'pointer-events:none',
          'user-select:none',
          'filter:invert(1)',
          'height:auto',
          'z-index:0',
          `width:${sz.css}`,
          `opacity:${op}`,
          `left:${((cx / W) * 100).toFixed(2)}%`,
          `top:${((cy / H) * 100).toFixed(2)}%`,
          `transform:translate(-50%,-50%) rotate(${rot}deg)${flip}`,
        ].join(';');

        el.appendChild(img);
        break;
      }
    });
  }

  // ── Detecta zonas protegidas (fotos da galeria) ──────────────
  function getGuardRects() {
    // Seleciona imagens reais de portfólio (não ícones/logos)
    const guards = [];
    document.querySelectorAll(
      '#galeria img[src*="galeria/"], .gallery-grid img, figure img, .carousel-frame img'
    ).forEach(img => {
      const r = img.getBoundingClientRect();
      if (r.width > 80) { // ignora ícones pequenos
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

  // ── Configuração de densidade por página ─────────────────────
  // Detecta qual página pelo body ou seções presentes
  function getConfig() {
    const path = window.location.pathname;

    // Seções e quantidade base de decorativos
    // n = elementos por seção (ajustado proporcionalmente pela altura real)
    const cfg = {
      'index':     [
        { sel: '#hero',      n: 14 },
        { sel: '#sobre',     n: 10 },
        { sel: '#galeria',   n: 6  },
        { sel: '#processo',  n: 10 },
        { sel: '#faq',       n: 10 },
        { sel: '#promocoes', n: 10 },
        { sel: '#contato',   n: 8  },
      ],
      'galeria':   [
        { sel: 'header, .page-header, .galeria-header', n: 10 },
        { sel: 'main, .galeria-wrap, body > section',   n: 6  },
      ],
      'cadastro':  [
        { sel: 'header, .page-header', n: 10 },
        { sel: 'main, .promo-wrap',    n: 8  },
      ],
      'reserva':   [
        { sel: 'main, body > section, .reserva-wrap', n: 10 },
      ],
      'anamnese':  [
        { sel: 'header, .page-header', n: 6  },
        { sel: 'main, .anamnese-wrap', n: 6  },
      ],
    };

    for (const key of Object.keys(cfg)) {
      if (path.includes(key === 'index' ? 'index' : key) ||
          (key === 'index' && (path.endsWith('/') || path.endsWith('tatuagem/')))) {
        return cfg[key];
      }
    }

    // Fallback genérico — funciona em qualquer página nova
    return [{ sel: 'main, body > section, .page-wrap', n: 10 }];
  }

  // ── Init ─────────────────────────────────────────────────────
  async function init() {
    const pool = await getPool();
    if (!pool.length) return;

    // Aguarda imagens da galeria carregarem para calcular guards corretamente
    await new Promise(r => setTimeout(r, 600));

    const guards = getGuardRects();
    const config = getConfig();

    requestAnimationFrame(() => {
      config.forEach(({ sel, n }) => {
        document.querySelectorAll(sel).forEach(el => {
          const H = el.offsetHeight;
          if (!H) return;
          const nAjustado = Math.round(n * Math.max(1, H / 480));
          packSection(el, pool, Math.min(nAjustado, pool.length), guards);
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
