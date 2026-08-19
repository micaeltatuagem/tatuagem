/* ===========================================================
   nav-mobile.js — controla abrir/fechar o menu (hambúrguer no
   mobile, dropdowns de grupo "Tatuagens ▾", "Conheça ▾" etc no
   desktop). NÃO cria nem move elemento nenhum: o HTML de cada
   página já nasce com o menu inteiro e final (ícone, itens,
   painéis de cada grupo), pra nunca ter nenhum "pulo" visual
   depois que a página carrega.
   =========================================================== */
(function () {
  function initNav(nav) {
    if (nav.dataset.navMobileInit) return;
    nav.dataset.navMobileInit = '1';

    var links = nav.querySelector('.nav-links');
    var toggleBtn = nav.querySelector('.nav-toggle');

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

    // ── Dropdowns de grupo (desktop): "Tatuagens ▾", "Conheça ▾" etc ──
    var groupBtns = nav.querySelectorAll('.nav-group-btn');
    if (groupBtns.length) {
      var closeAllGroups = function () {
        document.querySelectorAll('.nav-group-panel.open').forEach(function (p) {
          p.classList.remove('open');
        });
        groupBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      };
      var positionPanel = function (btn, panel) {
        var r = btn.getBoundingClientRect();
        panel.style.top = (r.bottom + 10) + 'px';
        panel.style.right = (window.innerWidth - r.right) + 'px';
      };
      groupBtns.forEach(function (btn) {
        var panel = document.querySelector('.nav-group-panel[data-panel="' + btn.dataset.group + '"]');
        if (!panel) return;
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var opening = !panel.classList.contains('open');
          closeAllGroups();
          if (opening) {
            positionPanel(btn, panel);
            panel.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
        panel.addEventListener('click', function (e) {
          if (e.target.closest('a')) closeAllGroups();
        });
      });
      document.addEventListener('click', function (e) {
        var openPanel = document.querySelector('.nav-group-panel.open');
        if (!openPanel) return;
        var clickedBtn = e.target.closest('.nav-group-btn');
        if (!openPanel.contains(e.target) && !clickedBtn) closeAllGroups();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAllGroups();
      });
      window.addEventListener('resize', closeAllGroups);
      window.addEventListener('scroll', function () {
        var openPanel = document.querySelector('.nav-group-panel.open');
        if (!openPanel) return;
        var btn = document.querySelector('.nav-group-btn[data-group="' + openPanel.dataset.panel + '"]');
        if (btn) positionPanel(btn, openPanel);
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
