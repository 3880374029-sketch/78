/* =========================================================================
 * qmhub.cc.cd · 宣传海报轮播组件 (QMPoster)
 * ---------------------------------------------------------------------
 * 独立模块，可同时用于「论坛首页横幅」与「灵兽世界首页」。
 * 依赖：QMPosterArt（矢量插画库）；不依赖 QMHUB 任何内部对象。
 *
 * 需求对应：
 *   尺寸适配  → 容器高度 clamp()、桌面左文右图 / 移动图文叠压两套版式
 *   各设备清晰 → 纯 SVG 矢量，任意 DPI 无锯齿
 *   不影响布局 → 容器高度由 CSS 完全决定，首屏无布局位移
 *   不影响性能 → 零图片请求、总量 < 24KB、未激活幻灯片不参与动画
 * ========================================================================= */
(function (root) {
  'use strict';

  var QMP = (root.QMPoster = {});

  /* 海报配置：三张，覆盖「资料片 / 新玩法 / 家族联盟」三个卖点 */
  QMP.DEFAULT_POSTERS = [
    {
      id: 'key-visual', art: 'keyvisual', theme: 'ink',
      badge: 'v2.0 全新资料片',
      title: '灵兽家族',
      subtitle: '三系灵兽 · 家族争霸 · 联盟协作',
      slogan: '白虎裂风，黄牛撼地，金鸡报晓 —— 在青丘开宗立派，把你的家族名字挂上榜首。',
      cta: { text: '立即召唤灵兽', act: 'nav', v: 'pets' },
      cta2: { text: '查看图鉴', act: 'petTab', v: 'codex' }
    },
    {
      id: 'tower', art: 'tower', theme: 'gold',
      badge: '新玩法 · 已上线',
      title: '神兽试炼塔',
      subtitle: '百层封灵 · 每 5 层首领',
      slogan: '塔顶封着一枚太古兽魂。每天 3 次免费挑战，够你爬到第几层？',
      cta: { text: '前往试炼塔', act: 'tower' },
      cta2: { text: '查看层数榜', act: 'rankTab', v: 'tower' }
    },
    {
      id: 'alliance', art: 'alliance', theme: 'jade',
      badge: '家族 × 联盟',
      title: '联盟争锋',
      subtitle: '结盟 · 协作 · 讨伐九头相柳',
      slogan: '单打独斗能走快，结盟协作才能走远。最多 2 个盟友，一起打穿世界 BOSS。',
      cta: { text: '组建家族', act: 'nav', v: 'family' },
      cta2: { text: '查看羁绊', act: 'petTab', v: 'bond' }
    }
  ];
  QMP.AUTOPLAY_MS = 6500;

  var cfg = { posters: QMP.DEFAULT_POSTERS, autoplay: QMP.AUTOPLAY_MS, ctaAttr: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* 覆盖配置：QMPoster.configure({ posters:[...], ctaAttr: fn }) */
  QMP.configure = function (o) {
    o = o || {};
    if (o.posters) cfg.posters = o.posters;
    if (o.autoplay) cfg.autoplay = o.autoplay;
    if (o.ctaAttr) cfg.ctaAttr = o.ctaAttr;
    return QMP;
  };

  function btnAttr(c, i) {
    /* 默认：游戏内部用 data-act 交给事件总线；外部（论坛）用 ctaAttr 注入 onclick */
    if (cfg.ctaAttr) return cfg.ctaAttr(c, i);
    return 'data-act="' + esc(c.act) + '"' + (c.v ? ' data-v="' + esc(c.v) + '"' : '');
  }

  QMP.html = function () {
    var list = cfg.posters;
    var slides = list.map(function (po, i) {
      var cta = '';
      if (po.cta) cta += '<button class="qm-btn primary" ' + btnAttr(po.cta, i) + '>' + esc(po.cta.text) + '</button>';
      if (po.cta2) cta += '<button class="qm-btn ghost" ' + btnAttr(po.cta2, i) + '>' + esc(po.cta2.text) + '</button>';

      return '<article class="qm-slide qm-theme-' + po.theme + (i === 0 ? ' is-active' : '') + '" data-i="' + i + '"' +
        ' role="group" aria-roledescription="幻灯片" aria-label="' + (i + 1) + ' / ' + list.length + '：' + esc(po.title) + '"' +
        (i === 0 ? '' : ' aria-hidden="true"') + '>' +
        '<div class="qm-art" aria-hidden="true">' + (root.QMPosterArt ? root.QMPosterArt.render(po.art, 'qm' + i + '-') : '') + '</div>' +
        '<div class="qm-scrim" aria-hidden="true"></div>' +
        '<div class="qm-body">' +
        '<span class="qm-badge">' + esc(po.badge) + '</span>' +
        '<h2 class="qm-title">' + esc(po.title) + '</h2>' +
        '<p class="qm-sub">' + esc(po.subtitle) + '</p>' +
        '<p class="qm-slogan">' + esc(po.slogan) + '</p>' +
        '<div class="qm-cta">' + cta + '</div>' +
        '</div>' +
        '<div class="qm-seal" aria-hidden="true"><span>灵</span><span>兽</span><span>家</span><span>族</span></div>' +
        '</article>';
    }).join('');

    var dots = list.map(function (po, i) {
      return '<button class="qm-dot' + (i === 0 ? ' is-active' : '') + '" data-i="' + i + '" aria-label="切换到 ' + esc(po.title) + '"></button>';
    }).join('');

    return '<section class="qm-poster" role="region" aria-label="宣传海报" aria-roledescription="轮播">' +
      '<div class="qm-viewport">' + slides + '</div>' +
      '<button class="qm-nav prev" type="button" aria-label="上一张">‹</button>' +
      '<button class="qm-nav next" type="button" aria-label="下一张">›</button>' +
      '<div class="qm-dots" role="tablist">' + dots + '</div>' +
      '<div class="qm-progress" aria-hidden="true"><i></i></div>' +
      '</section>';
  };

  /* ---------------------------------------------------------------- 轮播控制 */
  var timer = null, idx = 0, paused = false, reduce = false;

  /** @param {Element} host 挂载容器（其内部需存在 .qm-poster） */
  QMP.mount = function (host) {
    host = host || document;
    var box = host.querySelector('.qm-poster');
    if (!box) return null;
    try { reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }

    var slides = box.querySelectorAll('.qm-slide');
    var dots = box.querySelectorAll('.qm-dot');
    if (!slides.length) return null;

    function restart() {
      var bar = box.querySelector('.qm-progress > i');
      if (!bar) return;
      bar.style.transition = 'none';
      bar.style.width = '0%';
      void bar.offsetWidth;
      if (reduce || paused) return;
      bar.style.transition = 'width ' + (cfg.autoplay / 1000) + 's linear';
      bar.style.width = '100%';
    }
    function go(n) {
      idx = (n + slides.length) % slides.length;
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.toggle('is-active', i === idx);
        slides[i].setAttribute('aria-hidden', i === idx ? 'false' : 'true');
        if (dots[i]) dots[i].classList.toggle('is-active', i === idx);
      }
      restart();
    }
    QMP.goTo = go;

    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      if (reduce || slides.length < 2) return;
      stop();
      timer = setInterval(function () { if (!document.hidden && !paused) go(idx + 1); }, cfg.autoplay);
      restart();
    }
    function pause() { paused = true; stop(); box.classList.add('is-paused'); }
    function resume() { paused = false; box.classList.remove('is-paused'); start(); }

    var next = function () { go(idx + 1); };
    var prev = function () { go(idx - 1); };

    box.querySelector('.qm-nav.next').onclick = function () { next(); pause(); };
    box.querySelector('.qm-nav.prev').onclick = function () { prev(); pause(); };
    Array.prototype.forEach.call(dots, function (d) {
      d.onclick = function () { go(+d.dataset.i); pause(); };
    });
    if (!box.__qmKey) {
      box.__qmKey = true;
      box.setAttribute('tabindex', '0');
      box.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { next(); pause(); }
        if (e.key === 'ArrowLeft') { prev(); pause(); }
      });
    }
    if (!box.__qmHover) {
      box.__qmHover = true;
      box.addEventListener('mouseenter', pause);
      box.addEventListener('mouseleave', resume);
      box.addEventListener('focusin', pause);
      box.addEventListener('focusout', resume);
      document.addEventListener('visibilitychange', function () { document.hidden ? stop() : (!paused && start()); });
      var sx = 0, sy = 0, tracking = false;
      box.addEventListener('touchstart', function (e) { tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      box.addEventListener('touchend', function (e) {
        if (!tracking) return; tracking = false;
        var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); pause(); }
      }, { passive: true });
    }
    start();
    return { go: go, stop: stop, start: start };
  };

  QMP.destroy = function () { if (timer) { clearInterval(timer); timer = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
