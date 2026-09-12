/* =========================================================================
 * qmhub.cc.cd · 论坛接入层 (forum-embed)
 * ---------------------------------------------------------------------
 * 设计目标：在「完全不改动论坛既有结构、CSS、JS」的前提下接入灵兽玩法。
 *
 * 做了三件事：
 *   ① 在首屏顶部插入「宣传海报横幅」（QMPoster，矢量 / 响应式 / 零请求）
 *   ② 在侧栏「玩法中心」插入「灵兽家族」入口按钮
 *   ③ 提供 openPetWorld() —— 以全屏 iframe 打开灵兽世界
 *
 * 为什么用 iframe？
 *   · 论坛是 2480 行内联 CSS、5900 行内联 JS 的单文件应用，主题变量、
 *     .btn/.card/.modal 等通用类名与游戏样式存在天然冲突风险。
 *   · iframe 提供天然的样式与作用域隔离：游戏的 CSS 不会外泄，
 *     论坛的 CSS 也不会渗进来，双方零回归风险。
 *   · iframe 默认懒加载（首次点击才创建 src）→ 不影响论坛首屏性能。
 * ========================================================================= */
(function (root, doc) {
  'use strict';

  var PETWORLD_URL = 'assets/petworld.html';
  var OVERLAY_ID = 'qmPetWorldOverlay';
  var iframeEl = null;
  var loaded = false;
  var lastRoute = '';

  /* ------------------------------------------------------------------
   * (a) 把海报的 CTA 映射成「打开灵兽世界并直达对应玩法」
   * ------------------------------------------------------------------ */
  function routeOf(cta) {
    var act = cta.act, v = cta.v;
    var map = {
      'nav/pets': 'pets', 'nav/family': 'family', 'nav/battle': 'battle',
      'nav/rank': 'rank', 'nav/shop': 'shop', 'nav/home': 'home',
      'petTab/codex': 'pets/codex', 'petTab/bond': 'pets/bond',
      'petTab/breed': 'pets/breed', 'petTab/gacha': 'pets/gacha', 'petTab/mine': 'pets',
      'battleTab/tower': 'battle/tower', 'battleTab/adventure': 'battle',
      'battleTab/arena': 'battle/arena', 'battleTab/war': 'battle/war',
      'rankTab/tower': 'rank/tower', 'rankTab/power': 'rank', 'rankTab/family': 'rank/family',
      'rankTab/war': 'rank/war', 'rankTab/contrib': 'rank/contrib',
      'tower': 'battle/tower'
    };
    var key = act + '/' + (v || '');
    if (map[key]) return map[key];
    if (act === 'tower') return 'battle/tower';
    if (act === 'nav') return v || 'home';
    return 'home';
  }

  /* ------------------------------------------------------------------
   * (b) 全屏游戏容器
   * ------------------------------------------------------------------ */
  function ensureOverlay() {
    var ov = doc.getElementById(OVERLAY_ID);
    if (ov) return ov;

    ov = doc.createElement('div');
    ov.id = OVERLAY_ID;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', '灵兽家族');
    ov.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:999999',
      'background:#f4f1e8',
      'display:none', 'flex-direction:column',
      'opacity:0', 'transition:opacity .24s ease'
    ].join(';');

    var bar = doc.createElement('div');
    bar.style.cssText = [
      'flex:0 0 auto', 'display:flex', 'align-items:center', 'gap:12px',
      'padding:8px 14px', 'background:rgba(255,255,255,.92)',
      'border-bottom:1px solid #e4ded0', 'backdrop-filter:blur(10px)',
      'font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif'
    ].join(';');
    bar.innerHTML =
      '<span style="font-size:16px">🐯</span>' +
      '<strong style="font-size:13.5px;color:#23282e;letter-spacing:1px">灵兽家族</strong>' +
      '<span style="font-size:11px;color:#939ba4">qmhub.cc.cd</span>' +
      '<span style="flex:1"></span>' +
      '<span id="qmPetWorldHint" style="font-size:11px;color:#939ba4"></span>' +
      '<button id="qmPetWorldClose" type="button" style="' + [
        'border:1px solid #e4ded0', 'background:#faf8f2', 'color:#5d6771',
        'padding:6px 16px', 'border-radius:9px', 'font-size:12.5px',
        'font-weight:600', 'cursor:pointer'
      ].join(';') + '">返回论坛</button>';

    var holder = doc.createElement('div');
    holder.id = 'qmPetWorldHolder';
    holder.style.cssText = 'flex:1 1 auto;min-height:0;position:relative;background:#f4f1e8';

    ov.appendChild(bar);
    ov.appendChild(holder);
    doc.body.appendChild(ov);

    doc.getElementById('qmPetWorldClose').onclick = closePetWorld;

    /* 点击空白遮罩不关闭（避免误触丢失战斗进度），仅 ESC 关闭 */
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.style.display !== 'none') closePetWorld();
    });
    return ov;
  }

  function openPetWorld(route) {
    route = route || 'home';
    var ov = ensureOverlay();
    var holder = doc.getElementById('qmPetWorldHolder');

    if (!loaded) {
      iframeEl = doc.createElement('iframe');
      iframeEl.id = 'qmPetWorldFrame';
      iframeEl.title = '灵兽家族';
      iframeEl.setAttribute('allow', 'clipboard-write');
      iframeEl.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#f4f1e8';
      iframeEl.src = PETWORLD_URL + '#' + route;      // ← 首次点击才加载
      holder.appendChild(iframeEl);
      loaded = true;
      lastRoute = route;
    } else if (route && route !== lastRoute) {
      navigateTo(route);
    }

    ov.style.display = 'flex';
    doc.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { ov.style.opacity = '1'; });
    var hint = doc.getElementById('qmPetWorldHint');
    if (hint) hint.textContent = '按 ESC 返回论坛';
  }

  function closePetWorld() {
    var ov = doc.getElementById(OVERLAY_ID);
    if (!ov) return;
    ov.style.opacity = '0';
    doc.documentElement.style.overflow = '';
    setTimeout(function () { ov.style.display = 'none'; }, 220);
    // 关闭后刷新论坛统计数据，保持数据一致
    if (typeof root.loadStats === 'function') { try { root.loadStats(); } catch (e) {} }
  }

  function navigateTo(route) {
    lastRoute = route;
    if (iframeEl && iframeEl.contentWindow) {
      try {
        iframeEl.contentWindow.postMessage({ type: 'qm-navigate', route: route }, '*');
        return;
      } catch (e) { /* 跨域时降级为重载 */ }
    }
    if (iframeEl) iframeEl.src = PETWORLD_URL + '#' + route;
  }

  root.openPetWorld = openPetWorld;
  root.closePetWorld = closePetWorld;

  /* ------------------------------------------------------------------
   * (c) 海报区块
   * ------------------------------------------------------------------ */
  function mountPoster() {
    var host = doc.getElementById('qmPosterMount');
    if (!host || !root.QMPoster || !root.QMPosterArt) return;

    root.QMPoster.configure({
      ctaAttr: function (c) { return 'onclick="openPetWorld(\'' + routeOf(c) + '\')"'; }
    });
    host.innerHTML = root.QMPoster.html();

    /* 让海报按钮继承字号（宿主可能设置了全局 button 样式，这里显式复位） */
    host.querySelectorAll('.qm-btn').forEach(function (b) {
      b.style.fontFamily = 'inherit';
      b.style.cursor = 'pointer';
    });

    root.QMPoster.mount(host);

    /* 跟随论坛主题明暗，自动加描边 */
    syncTheme();
    try {
      new MutationObserver(syncTheme).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
      if (doc.body) new MutationObserver(syncTheme).observe(doc.body, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    } catch (e) { /* 忽略 */ }
  }

  function syncTheme() {
    var host = doc.getElementById('qmPosterMount');
    if (!host) return;
    var bg = '';
    try {
      var rs = getComputedStyle(doc.documentElement);
      bg = (rs.getPropertyValue('--bg-primary') || '').trim() || getComputedStyle(doc.body).backgroundColor || '';
    } catch (e) { bg = ''; }
    var dark = isDark(bg);
    host.classList.toggle('qm-on-dark', dark);
  }
  function isDark(color) {
    color = String(color || '').trim();
    var m = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) {
      var m2 = color.match(/rgba?\(([^)]+)\)/i);
      if (!m2) return true;                    // 取不到就按深色处理（论坛默认深色）
      var p = m2[1].split(',').map(function (x) { return parseFloat(x); });
      return lum(p[0], p[1], p[2]) < 0.5;
    }
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return lum(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)) < 0.5;
  }
  function lum(r, g, b) { return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  /* ------------------------------------------------------------------
   * (d) 侧栏「玩法中心」入口
   * ------------------------------------------------------------------ */
  function mountEntry() {
    var grid = doc.querySelector('.games-grid');
    if (!grid || grid.querySelector('[data-qm-entry]')) return;

    var btn = doc.createElement('div');
    btn.className = 'gp-btn';
    btn.setAttribute('data-qm-entry', '1');
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.title = '灵兽家族 · 宠物养成 × 家族争霸 × 联盟协作';
    btn.style.cssText = 'background:linear-gradient(135deg,#1f6f5c,#3fa98a);color:#fff;';
    btn.innerHTML = '<span class="gp-icon">&#x1F42F;</span>灵兽家族';
    btn.onclick = function () { openPetWorld('home'); };
    btn.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPetWorld('home'); } };
    grid.insertBefore(btn, grid.firstChild);

    /* 顺带在顶部导航加一个入口（若存在 navMenu） */
    var navMenu = doc.getElementById('navMenu');
    if (navMenu && !navMenu.querySelector('[data-qm-nav]')) {
      var li = doc.createElement('li');
      li.setAttribute('data-qm-nav', '1');
      li.innerHTML = '<button type="button" style="color:#3fa98a;font-weight:700">🐯 灵兽家族</button>';
      li.firstChild.onclick = function () { openPetWorld('home'); };
      navMenu.appendChild(li);
    }
  }

  /* ------------------------------------------------------------------
   * (e) 启动
   * ------------------------------------------------------------------ */
  function boot() {
    mountPoster();
    mountEntry();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 论坛可能在登录后才渲染 navMenu，这里做一次轻量补挂 */
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    mountEntry();
    if (tries > 20) clearInterval(t);
  }, 700);
})(typeof window !== 'undefined' ? window : globalThis, document);
