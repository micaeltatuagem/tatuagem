/* ===========================================================
   nav-mobile.js — controla abrir/fechar o menu (hambúrguer no
   mobile, dropdown "Mais ▾" no desktop). NÃO cria nem move
   elemento nenhum: o HTML de cada página já nasce com o menu
   inteiro e final (ícone, itens, painel do "Mais"), pra nunca
   ter nenhum "pulo" visual depois que a página carrega.
   =========================================================== */
(function () {
  function initNav(nav) {
    if (nav.dataset.navMobileInit) return;
    nav.dataset.navMobileInit = '1';

    var links = nav.querySelector('.nav-links');
    var toggleBtn = nav.querySelector('.nav-toggle');
    var moreBtn = nav.querySelector('.nav-more-btn');
    var panel = document.querySelector('.nav-more-panel');

    function setHeight() {
      nav.style.setProperty('--nav-h', nav.offsetHeight + 'px');
    }
    setHeight();
    window.addEventListener('resize', setHeight);

    // ── Hambúrguer (mobile) ──────────────────────────────────
    if (toggleBtn && links) {
      var closeMenu = function () {
        nav.classList.remove('nav-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      };
      var toggleMenu = function () {
        var open = nav.classList.toggle('nav-open');
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) setHeight();
      };
      toggleBtn.addEventListener('click', toggleMenu);
      links.addEventListener('click', function (e) {
        if (e.target.closest('a')) closeMenu();
      });
      document.addEventListener('click', function (e) {
        if (nav.classList.contains('nav-open') && !nav.contains(e.target)) closeMenu();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMenu();
      });
    }

    // ── Dropdown "Mais ▾" (desktop) ──────────────────────────
    if (moreBtn && panel) {
      var positionPanel = function () {
        var r = moreBtn.getBoundingClientRect();
        panel.style.top = (r.bottom + 10) + 'px';
        panel.style.right = (window.innerWidth - r.right) + 'px';
      };
      var closeMore = function () {
        panel.classList.remove('open');
        moreBtn.setAttribute('aria-expanded', 'false');
      };
      var toggleMore = function (e) {
        e.stopPropagation();
        var opening = !panel.classList.contains('open');
        if (opening) positionPanel();
        panel.classList.toggle('open', opening);
        moreBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
      };
      moreBtn.addEventListener('click', toggleMore);
      panel.addEventListener('click', function (e) {
        if (e.target.closest('a')) closeMore();
      });
      document.addEventListener('click', function (e) {
        if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== moreBtn) closeMore();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMore();
      });
      window.addEventListener('resize', closeMore);
      window.addEventListener('scroll', function () {
        if (panel.classList.contains('open')) positionPanel();
      }, { passive: true });
    }
  }

  function init() {
    document.querySelectorAll('nav').forEach(initNav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
