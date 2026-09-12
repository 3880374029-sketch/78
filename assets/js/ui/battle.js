/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 战斗回放播放器
 * 把引擎输出的 timeline 渲染成带动画的 3v3 战场
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var U = (Q.UI = Q.UI || {});
  var B = (Q.Battle = Q.Battle || {});
  Q.Battle = Q.Battle || {};

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  /**
   * @param {Object} opts
   *   data     战斗结果（Q.Battle.run 的返回）
   *   title    标题
   *   subtitle 副标题
   *   onEnd    (result) => void  播放结束回调
   */
  U.playBattle = function (opts) {
    var data = opts.data;
    var speed = 1;
    var aborted = false;

    /* 战斗初始状态：满血复活为起始态 */
    var units = {};
    var order = [];
    [].concat(data.allies, data.enemies).forEach(function (u) {
      var copy = {
        uid: u.uid, name: u.name, emoji: u.emoji, palette: u.palette, side: u.side,
        level: u.level, star: u.star, maxHp: u.maxHp, hp: u.maxHp, shield: 0,
        energy: 30, alive: true, buffs: [], boss: u.boss
      };
      units[u.uid] = copy; order.push(copy);
    });

    /* ---------------- DOM ---------------- */
    var mask = el('div', 'modal-mask');
    var modal = el('div', 'modal wide');
    modal.style.maxWidth = '1080px';

    var head = el('div', 'modal-h');
    head.appendChild(el('h3', null, esc(opts.title || '战斗')));
    head.innerHTML += '<span class="sub" style="color:var(--ink-3);font-size:12px">' + esc(opts.subtitle || '') + '</span>';
    var btnSpeed = el('button', 'btn sm ghost', '▶ 1x');
    var btnSkip = el('button', 'btn sm', '跳过');
    var btnClose = el('button', 'x', '✕');
    var sp = el('div', 'spacer'); sp.style.cssText = 'flex:1';
    head.appendChild(sp); head.appendChild(btnSpeed); head.appendChild(btnSkip); head.appendChild(btnClose);

    var body = el('div', 'modal-b');
    body.style.background = 'var(--bg)';

    var arena = el('div', 'arena');
    var arenaTop = el('div', 'arena-top');
    var sideA = el('div', 'side'), sideB = el('div', 'side right');
    [].concat(data.allies, data.enemies).forEach(function (cu) {
      var side = cu.side === 'ally' ? sideA : sideB;
      side.appendChild(buildFighter(cu));
    });
    arenaTop.appendChild(sideA); arenaTop.appendChild(sideB);
    arena.appendChild(arenaTop);

    var logBox = el('div', 'battle-log mt12');
    body.appendChild(arena); body.appendChild(logBox);

    modal.appendChild(head); modal.appendChild(body);
    mask.appendChild(modal);
    document.getElementById('modalRoot').appendChild(mask);

    function buildFighter(cu) {
      var f = el('div', 'fighter');
      f.dataset.uid = cu.uid;
      var tone = cu.palette ? cu.palette.main : '#f6f3ec';
      var glow = cu.palette ? cu.palette.glow : '#eee';
      f.innerHTML =
        '<div class="sprite" style="--tone:' + tone + ';--glow:' + glow + '">' + cu.emoji + '</div>' +
        '<div class="nmline">' + esc(cu.name) + '<span style="color:var(--ink-3);font-weight:500"> Lv.' + cu.level + '</span></div>' +
        '<div class="hpline"><div class="bar thin ' + (cu.side === 'ally' ? '' : 'red') + '"><i style="width:100%"></i></div></div>' +
        '<div class="hptext">' + cu.maxHp + ' / ' + cu.maxHp + '</div>' +
        '<div class="shieldbar"><i style="width:0%"></i></div>' +
        '<div class="rage"><i style="width:30%"></i></div>' +
        '<div class="buffs"></div>';
      return f;
    }

    function unitEl(uid) { return arena.querySelector('.fighter[data-uid="' + uid + '"]'); }

    function syncUnit(u) {
      var node = unitEl(u.uid); if (!node) return;
      var hpPct = Math.max(0, u.hp / u.maxHp * 100);
      node.querySelector('.bar > i').style.width = hpPct + '%';
      node.querySelector('.hptext').textContent = Math.max(0, Math.round(u.hp)) + ' / ' + u.maxHp;
      node.querySelector('.shieldbar > i').style.width = Math.min(100, u.shield / u.maxHp * 100) + '%';
      node.querySelector('.rage > i').style.width = Math.min(100, u.energy) + '%';
      node.classList.toggle('dead', !u.alive);
      var bl = node.querySelector('.buffs');
      bl.innerHTML = (u.buffs || []).map(function (b) { return '<span title="' + esc(b.name) + ' 剩余' + b.turns + '回合">' + b.icon + b.turns + '</span>'; }).join('');
    }

    function float(uid, text, cls) {
      var node = unitEl(uid); if (!node) return;
      var s = el('div', 'dmg-float ' + (cls || ''), text);
      node.appendChild(s);
      setTimeout(function () { s.remove(); }, 950);
    }
    function logLine(text, cls) {
      var d = el('div', cls || '', text);
      logBox.appendChild(d);
      logBox.scrollTop = logBox.scrollHeight;
      while (logBox.children.length > 160) logBox.removeChild(logBox.firstChild);
    }

    /* ---------------- 播放 ---------------- */
    var unitMap = {};
    order.forEach(function (u) { unitMap[u.uid] = u; });
    var baseDelay = 460;

    function delay(ms) { return sleep(ms / speed); }

    function abort() {
      aborted = true;
      logBox.innerHTML = '';
      logLine('⏩ 已跳过战斗动画，直接显示结果', 'l-round');
      order.forEach(function (u) {
        var final = (data.allies.concat(data.enemies)).find(function (x) { return x.uid === u.uid; });
        if (final) { u.hp = Math.max(0, final.hp); u.alive = final.alive; u.shield = final.shield; u.energy = final.energy; syncUnit(u); }
      });
      finish();
    }

    async function play() {
      for (var i = 0; i < data.timeline.length; i++) {
        if (aborted) return;
        var e = data.timeline[i];
        var node;
        switch (e.type) {
          case 'start':
            logLine('⚔️ 战斗开始！', 'l-round');
            await delay(320);
            break;
          case 'round':
            logLine('—— 第 ' + e.round + ' 回合 ——', 'l-round');
            if (e.state) {
              [].concat(e.state.allies, e.state.enemies).forEach(function (s) {
                var u = unitMap[s.uid]; if (!u) return;
                u.shield = s.shield || 0; u.energy = s.energy || 0;
                syncUnit(u);
              });
            }
            await delay(360);
            break;
          case 'cast':
            node = unitEl(e.unit);
            if (node) node.classList.add('acting');
            logLine(e.icon + ' ' + esc(e.name) + ' 施展【' + esc(e.skill) + '】', 'l-cast');
            await delay(baseDelay);
            break;
          case 'damage':
            node = unitEl(e.target);
            if (node) {
              node.classList.remove('hit'); void node.offsetWidth; node.classList.add('hit');
              setTimeout(function (n) { return function () { n.classList.remove('acting'); }; }(unitEl(e.unit) || node), 200);
            }
            float(e.target, '-' + e.amount);
            units[e.target].hp = e.hp;
            syncUnit(units[e.target]);
            logLine('💥 ' + esc(units[e.target].name) + ' 受到 ' + e.amount + ' 伤害（剩余 ' + e.hp + '）', 'l-dmg');
            await delay(baseDelay * 0.5);
            break;
          case 'heal':
            float(e.target, '+' + e.amount, 'heal');
            units[e.target].hp = e.hp;
            syncUnit(units[e.target]);
            logLine('💚 ' + esc(units[e.target].name) + ' 回复 ' + e.amount + ' 生命', 'l-heal');
            await delay(baseDelay * 0.4);
            break;
          case 'miss':
            float(e.target, '闪避', 'miss');
            logLine('🌫️ ' + esc(units[e.target].name) + ' 闪避了攻击', '');
            await delay(baseDelay * 0.35);
            break;
          case 'buff':
            logLine('✦ ' + esc(units[e.target].name) + ' 获得【' + esc(((B.BUFF_DEF || {})[e.buff] || {}).name || e.buff) + '】', '');
            await delay(baseDelay * 0.3);
            break;
          case 'cleanse':
            logLine('✨ ' + esc(units[e.target].name) + ' 的减益被驱散', '');
            await delay(baseDelay * 0.3);
            break;
          case 'revive':
            units[e.unit].alive = true; units[e.unit].hp = e.hp;
            syncUnit(units[e.unit]);
            float(e.unit, '复活!', 'heal');
            logLine('🕊️ ' + esc(e.name) + ' 复活并回复 ' + e.hp + ' 生命', 'l-heal');
            await delay(baseDelay);
            break;
          case 'death':
            units[e.unit].alive = false;
            syncUnit(units[e.unit]);
            logLine('☠️ ' + esc(e.name) + ' 阵亡', 'l-death');
            await delay(baseDelay * 0.6);
            break;
          case 'stunned':
            logLine('💫 ' + esc(e.name) + ' 被眩晕，无法行动', '');
            float(e.unit, '眩晕', 'miss');
            await delay(baseDelay * 0.4);
            break;
        }
      }
      finish();
    }

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      order.forEach(function (u) {
        var f = (data.allies.concat(data.enemies)).find(function (x) { return x.uid === u.uid; });
        if (f) { u.hp = Math.max(0, f.hp); u.alive = f.alive; syncUnit(u); }
      });
      arena.querySelectorAll('.acting').forEach(function (n) { n.classList.remove('acting'); });

      var banner = el('div', 'result-banner mt12' + (data.win ? '' : ' lose'));
      banner.innerHTML = '<h2>' + (data.draw ? '势均力敌' : (data.win ? '战斗胜利' : '战斗失败')) + '</h2>' +
        '<div class="hint mt8">共 ' + data.rounds + ' 回合 · 我方输出 ' + (data.totalDamage ? data.totalDamage.ally : 0) + ' · 敌方输出 ' + (data.totalDamage ? data.totalDamage.enemy : 0) +
        (data.mvp ? ' · MVP ' + data.mvp.emoji + ' ' + esc(data.mvp.name) : '') + '</div>';
      body.appendChild(banner);
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      btnSkip.textContent = '关闭';
      btnSkip.onclick = close;
      if (opts.onEnd) opts.onEnd({ win: data.win, draw: data.draw });
    }

    function close() {
      aborted = true;
      mask.remove();
    }

    btnSkip.onclick = abort;
    btnClose.onclick = close;
    btnSpeed.onclick = function () {
      speed = speed === 1 ? 2 : (speed === 2 ? 4 : 1);
      btnSpeed.textContent = '▶ ' + speed + 'x';
    };
    mask.addEventListener('click', function (ev) { if (ev.target === mask) close(); });

    if (data.timeline.length > 90) { logLine('提示：战斗较长，可点【跳过】直接看结果', ''); }
    play();
    return { close: close };
  };

  /* ------------------------------------------------------------------
   * 快速结算展示（不播动画，直接给结果卡片）
   * ------------------------------------------------------------------ */
  U.showBattleResult = function (data, title, rewards, onClose) {
    var mask = el('div', 'modal-mask');
    var modal = el('div', 'modal');
    var head = el('div', 'modal-h');
    head.innerHTML = '<h3>' + esc(title || '战斗结果') + '</h3><span class="spacer" style="flex:1"></span>';
    var x = el('button', 'x', '✕'); head.appendChild(x);
    var body = el('div', 'modal-b');
    var banner = el('div', 'result-banner' + (data.win ? '' : ' lose'));
    banner.innerHTML = '<h2>' + (data.draw ? '平局' : (data.win ? '胜利' : '失败')) + '</h2>' +
      '<div class="hint mt8">' + data.rounds + ' 回合' + (data.mvp ? ' · MVP ' + data.mvp.emoji + ' ' + esc(data.mvp.name) : '') + '</div>';
    body.appendChild(banner);
    if (rewards && rewards.length) {
      var rr = el('div', 'reward-row');
      rewards.forEach(function (t, i) {
        var c = el('div', 'reward-chip', t); c.style.animationDelay = (i * 70) + 'ms'; rr.appendChild(c);
      });
      body.appendChild(rr);
    }
    modal.appendChild(head); modal.appendChild(body);
    mask.appendChild(modal);
    document.getElementById('modalRoot').appendChild(mask);
    function close() { mask.remove(); if (onClose) onClose(); }
    x.onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
