/* qmhub.cc.cd · 灵兽家族 · 一行式自举 (qm-boot.js)
 * 宿主只需: <script src="assets/js/qm-boot.js"></script>
 * 自动完成: 注入 poster.css → 创建 #qmPosterMount → 按需加载海报组件与接入层
 */
(function () {
  if (window.__qmBootLoaded) return;
  window.__qmBootLoaded = 1;
  var B = 'assets/';

  function css(h) {
    if (document.querySelector('link[data-qm-style]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = h; l.setAttribute('data-qm-style', '1');
    document.head.appendChild(l);
  }

  function mount() {
    var e = document.getElementById('qmPosterMount');
    if (e) return e;
    e = document.createElement('div');
    e.id = 'qmPosterMount'; e.className = 'qm-on-dark';
    var s = document.querySelector('.forum-stats'),
        L = document.querySelector('.main-layout'),
        C = document.querySelector('.container');
    if (s && s.parentNode) s.parentNode.insertBefore(e, s.nextSibling);
    else if (L && L.parentNode) L.parentNode.insertBefore(e, L);
    else if (C) C.insertBefore(e, C.firstChild);
    else document.body.insertBefore(e, document.body.firstChild);
    return e;
  }

  function load(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = ok;
      s.onerror = function () { no(new Error('404 ' + src)); };
      document.body.appendChild(s);
    });
  }

  function go() {
    try {
      css(B + 'css/poster.css');
      mount();
      var p = Promise.resolve();
      if (!window.QMPosterArt) p = p.then(function () { return load(B + 'js/ui/poster-art.js'); });
      if (!window.QMPoster) p = p.then(function () { return load(B + 'js/ui/poster.js'); });
      p.then(function () { return load(B + 'js/forum-embed.js'); })
        .then(function () {
          var m = document.getElementById('qmPosterMount');
          console.log('[灵兽家族] 自举完成，海报' + ((m && m.querySelector('.qm-poster')) ? '已渲染 ✅' : '未渲染 ⚠️'));
        })
        .catch(function (e) { console.warn('[灵兽家族] 资源加载失败：', e && e.message); });
    } catch (e) {
      console.warn('[灵兽家族] 初始化异常：', e && e.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
