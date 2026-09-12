/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · UI 工具库
 * 统一封装 DOM / 格式化 / 提示 / 弹窗，供各视图复用
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var K = (Q.Kit = {});

  K.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  };
  K.fmt = function (n) {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + '万';
    return String(Math.round(n));
  };
  K.pct = function (v) { return (v * 100).toFixed(1) + '%'; };
  K.star = function (n) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); };
  K.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  K.el = function (tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  };

  /* ---------------- 提示 ---------------- */
  K.toast = function (msg, type) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var t = K.el('div', 'toast' + (type ? ' ' + type : ''),
      '<span>' + (type === 'err' ? '⚠️' : type === 'warn' ? '💡' : '✅') + '</span><span>' + K.esc(msg) + '</span>');
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, 2600);
  };
  K.ok = function (m) { K.toast(m); };
  K.err = function (e) { K.toast(e && e.message ? e.message : String(e), 'err'); };
  K.warn = function (m) { K.toast(m, 'warn'); };
  K.rewardsToText = function (msgs) { return (msgs || []).join('、'); };

  /* ---------------- 弹窗 ---------------- */
  K.modal = function (title, bodyHtml, footerHtml, opts) {
    opts = opts || {};
    var mask = K.el('div', 'modal-mask');
    mask.innerHTML =
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + K.esc(title) + '">' +
      '<div class="modal-h"><h3>' + K.esc(title) + '</h3><span style="flex:1"></span><button class="x" data-close aria-label="关闭">✕</button></div>' +
      '<div class="modal-b">' + bodyHtml + '</div>' +
      (footerHtml ? '<div class="modal-f">' + footerHtml + '</div>' : '') +
      '</div>';
    document.getElementById('modalRoot').appendChild(mask);
    function close() { mask.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    mask.querySelector('[data-close]').onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    return { mask: mask, close: close };
  };

  /* ---------------- 小组件 ---------------- */
  K.bar = function (val, max, cls) {
    var w = K.clamp(max ? val / max * 100 : 0, 0, 100);
    return '<div class="bar ' + (cls || '') + '"><i style="width:' + w + '%"></i></div>';
  };
  K.tag = function (text, cls) { return '<span class="tag ' + (cls || '') + '">' + text + '</span>'; };
  K.kv = function (k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; };
  K.statRow = function (k, v) { return '<div class="stat-row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; };
  K.empty = function (ico, text, btnHtml) {
    return '<div class="empty"><span class="ico">' + ico + '</span>' + text + (btnHtml ? '<div class="mt12">' + btnHtml + '</div>' : '') + '</div>';
  };
  K.petThumb = function (pet, extraCls) {
    var D = Q.DATA, sp = D.getSpecies(pet.speciesId), rar = D.RARITY[sp.rarity];
    return '<div class="pet-thumb ' + (extraCls || '') + '" style="--tone:' + sp.palette.main + ';--glow:' + sp.palette.glow + '">' + sp.emoji +
      '<span class="badge-lv">Lv.' + pet.level + '</span>' +
      '<span class="rar" style="background:' + rar.color + '">' + sp.rarity + '</span>' +
      '<span class="stars">' + K.star(pet.star) + '</span></div>';
  };
  K.rewardChips = function (obj) {
    var D = Q.DATA, out = [];
    Object.keys(obj || {}).forEach(function (k) {
      if (k === 'item') { var it = D.ITEMS[obj[k]]; out.push((it ? it.emoji + ' ' + it.name : obj[k]) + ' ×1'); }
      else { var it2 = D.ITEMS[k]; out.push((it2 ? it2.emoji + ' ' + it2.name : k) + ' ×' + K.fmt(obj[k])); }
    });
    return out;
  };

  /* ---------------- 一次性事件绑定（避免重复注册） ---------------- */
  K.bindOnce = function (node, key, type, handler) {
    var flag = '__bound_' + key;
    if (node[flag]) return;
    node[flag] = true;
    node.addEventListener(type, handler);
  };
})(typeof window !== 'undefined' ? window : globalThis);
