<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>灵兽家族 · qmhub.cc.cd</title>
<meta name="description" content="qmhub.cc.cd 灵兽家族 —— 白虎、黄牛、鸡三系灵兽养成 × 家族争霸 × 联盟协作">
<meta name="theme-color" content="#f4f1e8">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐯</text></svg>">

<!--
  注意：本文件位于 assets/ 目录内，
  因此所有资源路径都相对于【本文件所在目录】，即 css/ 与 js/，
  不要再写成 assets/css/...（那会解析成 assets/assets/css/... 从而 404）。
-->
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/main.css">
<link rel="stylesheet" href="css/poster.css">
<link rel="stylesheet" href="css/extras.css">
</head>
<body>
<div id="app">
  <!-- ============ 顶栏 ============ -->
  <header class="topbar">
    <div class="brand" title="返回主城">
      <div class="brand-mark">🐯</div>
      <div class="brand-text">
        <b>灵兽家族</b>
        <span>qmhub.cc.cd</span>
      </div>
    </div>
    <div class="res-bar" id="resBar"></div>
    <div class="player-chip" id="playerChip" title="查看个人信息"></div>
  </header>

  <!-- ============ 主体 ============ -->
  <div class="body-wrap">
    <nav class="sidebar" id="sidebar"></nav>
    <main class="content" id="content"></main>
  </div>
</div>

<div id="toasts"></div>
<div id="modalRoot"></div>

<!-- 数据与规则层 -->
<script src="js/data/config.js"></script>
<script src="js/data/config-ext.js"></script>
<script src="js/core/store.js"></script>
<script src="js/core/store-ext.js"></script>
<script src="js/core/engine.js"></script>
<script src="js/core/api.js"></script>
<script src="js/core/api-ext.js"></script>
<!-- 通用 UI -->
<script src="js/ui/kit.js"></script>
<script src="js/ui/poster-art.js"></script>
<script src="js/ui/poster.js"></script>
<script src="js/ui/battle.js"></script>
<!-- 视图与主程序 -->
<script src="js/ui/views-a.js"></script>
<script src="js/ui/views-b.js"></script>
<script src="js/ui/app.js"></script>

<script>
(function () {
  'use strict';

  /* 启动前诊断：把加载失败的资源列出来，避免只看到一句 "QMHUB is not defined" */
  function failedResources() {
    var out = [];
    try {
      performance.getEntriesByType('resource').forEach(function (e) {
        var isAsset = /\.(js|css)(\?|$)/.test(e.name);
        if (isAsset && (e.responseStatus >= 400 || e.transferSize === 0 && e.decodedBodySize === 0)) {
          out.push(e.name.replace(location.origin + '/', ''));
        }
      });
    } catch (x) { /* 老浏览器忽略 */ }
    return out;
  }

  function showError(title, detail, hints) {
    var box = document.getElementById('content');
    if (!box) box = document.body;
    box.innerHTML =
      '<div style="padding:44px 20px;max-width:660px;margin:0 auto;text-align:center;font-family:system-ui,sans-serif">' +
      '<div style="font-size:52px">🐯</div>' +
      '<h2 style="color:#c1462f;margin:12px 0 8px;font-size:19px">' + title + '</h2>' +
      '<p style="color:#5d6771;font-size:13px;line-height:1.8">' + detail + '</p>' +
      (hints && hints.length
        ? '<div style="text-align:left;margin-top:18px;padding:14px 16px;background:#faf8f2;border:1px solid #e4ded0;' +
          'border-radius:10px;font-size:12.5px;color:#5d6771"><b>排查建议</b><ul style="margin:8px 0 0 18px;line-height:2">' +
          hints.map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ul></div>'
        : '') +
      '</div>';
  }

  function boot() {
    if (typeof window.QMHUB === 'undefined' || !window.QMHUB.App) {
      var bad = failedResources();
      showError(
        '灵兽世界加载失败',
        bad.length
          ? '以下资源没能加载：<br><code style="color:#c1462f">' + bad.join('<br>') + '</code>'
          : '核心脚本 <code>js/core/...</code> 未执行成功，导致 <code>QMHUB</code> 未定义。',
        [
          '确认仓库里 <code>assets/js/</code> 与 <code>assets/css/</code> 的子目录结构完整（js/data、js/core、js/ui 三层都要在）。',
          '本页面必须通过 Web 访问（如 https://qmhub.cc.cd/assets/petworld.html），不要用 file:// 直接双击打开。',
          'F12 → Network 面板刷新一次，看哪个请求是 404，把文件名发我。'
        ]
      );
      return;
    }

    try {
      window.QMHUB.App.boot();
      /* 挂载后兜底：万一渲染后 #content 仍为空，给出可见提示 */
      var c = document.getElementById('content');
      if (c && !c.innerHTML.trim()) {
        showError('灵兽世界未渲染内容', '脚本已加载，但主城视图没有生成 DOM。请把 F12 → Console 的报错发我。', null);
      }
    } catch (err) {
      console.error(err);
      showError('灵兽世界启动异常', String(err && err.message ? err.message : err), null);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>
</body>
</html>
