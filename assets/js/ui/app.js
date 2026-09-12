/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 应用主程序
 * 负责：启动、路由、状态、顶部资源栏、事件分发
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var D = Q.DATA, S = Q.Store, API = Q.API, K = Q.Kit, U = Q.UI;

  var state = {
    view: 'home',
    petTab: 'mine',
    battleTab: 'adventure',
    famTab: 'overview',
    rankType: 'power',
    chapter: 0
  };
  var App = (Q.App = {});
  App.state = state;

  var NAV = [
    { id: 'home', name: '主城', ico: '🏯' },
    { id: 'pets', name: '灵兽', ico: '🐾' },
    { id: 'battle', name: '征战', ico: '⚔️' },
    { id: 'family', name: '家族', ico: '🏛️' },
    { id: 'rank', name: '排行', ico: '🏆' },
    { id: 'shop', name: '商店', ico: '🛒' }
  ];

  /* ------------------------------------------------------------ 顶栏 */
  function renderTop() {
    var save = S.getSave(), inv = save.inventory, pl = save.player;
    document.getElementById('resBar').innerHTML =
      ['gold', 'gem', 'contrib', 'soul_shard', 'break_stone'].map(function (k) {
        var it = D.ITEMS[k];
        return '<div class="res" title="' + K.esc(it.desc) + '"><span class="emoji">' + it.emoji + '</span>' + K.fmt(inv[k] || 0) +
          ' <small>' + it.name + '</small></div>';
      }).join('');
    document.getElementById('playerChip').innerHTML =
      '<div class="avatar">' + K.esc(pl.avatar) + '</div>' +
      '<div><div class="nm">' + K.esc(pl.name) + '</div>' +
      '<div class="lv">Lv.' + pl.level + ' · 战力 ' + K.fmt(S.teamPower()) + '</div></div>';
  }

  /* ------------------------------------------------------------ 侧栏 */
  function renderSide() {
    var fam = S.getFamily();
    var badgeCount = fam && (fam.allyRequests || []).length ? fam.allyRequests.length : 0;
    document.getElementById('sidebar').innerHTML = NAV.map(function (n) {
      var dot = (n.id === 'family' && badgeCount) ? '<span class="dot">' + badgeCount + '</span>' : '';
      return '<button class="nav-item' + (state.view === n.id ? ' active' : '') + '" data-act="nav" data-v="' + n.id + '">' +
        '<span class="ico">' + n.ico + '</span>' + n.name + dot + '</button>';
    }).join('');
  }

  /* ------------------------------------------------------------ 内容 */
  function renderContent() {
    var view = U.views[state.view] || U.views.home;
    var host = document.getElementById('content');
    host.innerHTML = view(state);
    if (U.after[state.view]) {
      try { U.after[state.view](host, state); } catch (e) { console.error('[after]', e); }
    }
  }

  function render() {
    renderTop(); renderSide(); renderContent();
  }
  App.refresh = render;

  function go(view) {
    state.view = view;
    render();
    document.getElementById('content').scrollTop = 0;
  }
  App.go = go;

  /* 主城渲染完成后挂载海报轮播 */
  U.after.home = function (host) { root.QMPoster && QMPoster.mount(host); };

  /* ------------------------------------------------------------ 事件分发 */
  function onAction(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.dataset.act;
    var fn = U.actions[act];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    fn(btn, { state: state, refresh: render, go: go });
  }

  /* =====================================================================
   * 动作表
   * =================================================================== */
  U.actions.nav = function (btn) {
    var v = btn.dataset.v || 'home';
    if (btn.dataset.tab) {
      if (v === 'battle') state.battleTab = btn.dataset.tab;
      else if (v === 'pets') state.petTab = btn.dataset.tab;
      else if (v === 'family') state.famTab = btn.dataset.tab;
    }
    go(v);
  };

  ['petTab', 'battleTab', 'famTab', 'rankTab'].forEach(function (t) {
    U.actions[t] = function (btn) {
      var key = { petTab: 'petTab', battleTab: 'battleTab', famTab: 'famTab', rankTab: 'rankType' }[t];
      state[key] = btn.dataset.v;
      if (t === 'petTab') state.view = 'pets';
      if (t === 'battleTab') state.view = 'battle';
      if (t === 'famTab') state.view = 'family';
      if (t === 'rankTab') state.view = 'rank';
      render();
      document.getElementById('content').scrollTop = 0;
    };
  });

  /* 海报 CTA 直达试炼塔 */
  U.actions.tower = function () { state.battleTab = 'tower'; go('battle'); };

  U.actions.chapter = function (btn) { state.chapter = +btn.dataset.v; render(); };

  /* ---------------- 战斗 ---------------- */
  function runBattle(promise, title, subtitle) {
    promise.then(function (res) {
      if (!res.result) return;
      U.playBattle({
        data: res.result, title: title, subtitle: subtitle,
        onEnd: function () {
          render();
          var rewards = [];
          if (res.rewards) rewards = K.rewardChips(res.rewards);
          else if (res.reward) rewards = K.rewardChips(res.reward);
          if (rewards.length) setTimeout(function () { K.toast('获得：' + rewards.join('、')); }, 380);
          if (res.firstClear) K.toast('🏅 首次通关奖励已发放！');
        }
      });
    }).catch(K.err);
  }

  U.actions.stage = function (btn) {
    var idx = +btn.dataset.v;
    var locked = D.CHAPTERS.reduce(function (a, c) { return a.concat(c.stages); }, []).filter(function (s) { return s.idx === idx; })[0];
    if (locked && locked.idx > S.getSave().world.stageProgress) return K.err(new Error('尚未解锁该关卡'));
    runBattle(API.battlePve(idx), '冒险 · ' + (locked ? locked.name : ''), '战力 ' + K.fmt(S.teamPower()));
  };

  U.actions.arenaBattle = function () {
    runBattle(API.battleArena(), '竞技场', '匹配中…');
  };

  U.actions.towerBattle = function () {
    API.towerInfo().then(function (info) {
      if (info.remaining <= 0) throw new Error('今日挑战次数已用完');
      runBattle(API.towerBattle(), '🗼 试炼塔 · 第 ' + info.floor + ' 层' + (info.isBoss ? '（首领层）' : ''), '战力 ' + K.fmt(S.teamPower()));
    }).catch(K.err);
  };

  U.actions.towerBuy = function () {
    API.towerBuyAttempt().then(function (info) {
      K.ok('购买成功，剩余 ' + info.remaining + ' 次');
      render();
    }).catch(K.err);
  };

  U.actions.warStart = function (btn) {
    var id = btn.dataset.id;
    API.startWar(id).then(function (res) {
      U.playBattle({
        data: res.result, title: '家族战', subtitle: '对手：' + res.target.name + ' Lv.' + res.target.level,
        onEnd: function () {
          render();
          var chips = K.rewardChips(res.reward);
          setTimeout(function () { K.toast((res.result.win ? '家族战胜利！' : '家族战失利。') + '获得 ' + chips.join('、')); }, 380);
        }
      });
    }).catch(K.err);
  };

  /* ---------------- 玩家 ---------------- */
  U.actions.signin = function () {
    API.signIn().then(function (r) {
      S.dailyTick('login', 1);
      K.ok('签到成功（第 ' + r.day + ' 天）：' + K.rewardChips(r.reward).join('、'));
      render();
    }).catch(K.err);
  };

  U.actions.reset = function () {
    if (!confirm('确定要重置存档吗？所有灵兽、家族与进度都会清空，此操作不可撤销。')) return;
    S.reset();
    S.dailyExtCheck();
    K.ok('存档已重置');
    go('home');
  };

  /* ---------------- 灵兽 ---------------- */
  U.actions.petOpen = function (btn) { U.openPetDetail(btn.dataset.uid, render); };

  U.actions.gacha = function (btn) {
    var n = +btn.dataset.n;
    API.gacha(n).then(function (results) {
      var cells = results.map(function (r, i) {
        var sp = D.getSpecies(r.speciesId);
        var cls = r.type === 'shard' ? 'shard' : (sp.rarity === 'SSR' ? 'ssr' : sp.rarity === 'SR' ? 'sr' : '');
        return '<div class="gacha-cell ' + cls + '" style="animation-delay:' + (i * 55) + 'ms">' +
          '<span class="e">' + sp.emoji + '</span><span class="n">' + sp.name + '</span>' +
          '<small class="hint">' + (r.type === 'shard' ? '兽魂 ×' + r.amount : 'Lv.' + r.pet.level + ' ★' + r.pet.star) + '</small></div>';
      }).join('');
      var m = K.modal('召唤结果', '<div class="gacha-box">' + cells + '</div>', '<button class="btn primary" data-close2>确定</button>');
      m.mask.querySelector('[data-close2]').onclick = function () { m.close(); render(); };
      render();
    }).catch(K.err);
  };

  /* ---------------- 羁绊 ---------------- */
  U.actions.bondRecommend = function () {
    API.applyRecommendTeam().then(function (uids) {
      var bonds = S.activeBonds().filter(function (b) { return b.active; });
      K.ok('已应用推荐编队' + (bonds.length ? '，激活：' + bonds.map(function (b) { return b.def.name; }).join('、') : ''));
      render();
    }).catch(K.err);
  };

  /* ---------------- 繁育 ---------------- */
  U._breedSel = [];
  U.actions.breedPick = function (btn) {
    var uid = btn.dataset.uid;
    var sel = U._breedSel;
    var i = sel.indexOf(uid);
    if (i >= 0) sel.splice(i, 1);
    else {
      if (sel.length >= 2) sel.shift();
      sel.push(uid);
    }
    render();
  };
  U.actions.breedClear = function () { U._breedSel = []; render(); };
  U.actions.breedDo = function () {
    var sel = U._breedSel;
    if (sel.length !== 2) return K.err(new Error('请选择两只灵兽'));
    API.breed(sel[0], sel[1]).then(function (r) {
      U._breedSel = [];
      var sp = r.species;
      var m = K.modal('🥚 孵化成功',
        '<div class="result-banner">' +
        '<div style="font-size:64px">' + sp.emoji + '</div>' +
        '<h2>' + K.esc(r.child.nickname) + '</h2>' +
        '<div class="hint mt8">' + sp.title + ' · ' + sp.rarity + ' · ★' + r.star + ' · Lv.' + r.child.level + '</div>' +
        '<div class="row-flex mt12" style="justify-content:center">' + K.tag('天赋点数 ' + r.talentTotal, 'gold') +
        K.tag('血脉：' + r.child.heritage.from.join(' × '), 'jade') + '</div>' +
        '</div>',
        '<button class="btn primary" data-close2>收下</button>');
      m.mask.querySelector('[data-close2]').onclick = function () { m.close(); render(); };
      render();
    }).catch(K.err);
  };

  /* ---------------- 每日委托 ---------------- */
  U.actions.dailyClaim = function (btn) {
    API.claimDaily(btn.dataset.id).then(function (msgs) {
      K.ok('领取成功：' + K.rewardsToText(msgs));
      render();
    }).catch(K.err);
  };
  U.actions.dailyMilestone = function (btn) {
    API.claimDailyMilestone(btn.dataset.idx).then(function (msgs) {
      K.ok('里程碑达成：' + K.rewardsToText(msgs));
      render();
    }).catch(K.err);
  };

  /* ---------------- 家族 ---------------- */
  U.actions.famCreate = function () {
    var name = (document.getElementById('famName') || {}).value || '';
    var notice = (document.getElementById('famNotice') || {}).value || '';
    var badgeEl = document.querySelector('#famBadge .emblem-btn.on');
    var badge = badgeEl ? badgeEl.dataset.e : '🏯';
    API.createFamily(name.trim(), badge, notice.trim()).then(function (f) {
      K.ok('家族【' + f.name + '】创建成功！');
      state.famTab = 'overview';
      render();
    }).catch(K.err);
  };

  U.actions.famJoin = function (btn) {
    API.joinFamily(btn.dataset.id).then(function (f) {
      K.ok('已加入【' + f.name + '】');
      render();
    }).catch(K.err);
  };

  U.actions.famLeave = function () {
    if (!confirm('确定退出家族吗？家族贡献不会返还。')) return;
    API.leaveFamily().then(function () { K.ok('已退出家族'); render(); }).catch(K.err);
  };

  U.actions.famDonate = function (btn) {
    API.donate(+btn.dataset.n).then(function (r) {
      K.ok('捐献成功，获得 ' + r.contrib + ' 家族贡献');
      render();
    }).catch(K.err);
  };

  U.actions.famTech = function (btn) {
    API.upgradeTech(btn.dataset.id).then(function () { K.ok('科技升级成功'); render(); }).catch(K.err);
  };

  U.actions.famQuest = function (btn) {
    API.claimFamilyQuest(btn.dataset.id).then(function (msgs) {
      K.ok('任务奖励：' + K.rewardsToText(msgs));
      render();
    }).catch(K.err);
  };

  /* ---------------- 联盟 ---------------- */
  U.actions.allyRequest = function (btn) {
    API.requestAlly(btn.dataset.id).then(function () { K.ok('结盟邀请已发出，等待对方族长同意'); render(); }).catch(K.err);
  };
  U.actions.allyAccept = function (btn) {
    API.acceptAlly(btn.dataset.id).then(function () { K.ok('结盟成功！'); render(); }).catch(K.err);
  };
  U.actions.allyReject = function (btn) {
    API.rejectAlly(btn.dataset.id).then(function () { K.ok('已拒绝该申请'); render(); }).catch(K.err);
  };
  U.actions.allyDissolve = function (btn) {
    if (!confirm('确定解除与该家族的结盟吗？联盟 BOSS 进度会清零。')) return;
    API.dissolveAlly(btn.dataset.id).then(function () { K.ok('已解除结盟'); render(); }).catch(K.err);
  };
  U.actions.bossAttack = function () {
    var dmg = Math.round(S.teamPower() * 0.35);
    API.attackBoss(dmg).then(function (r) {
      K.ok('出战造成 ' + K.fmt(dmg) + ' 伤害，获得 ' + r.contrib + ' 贡献。BOSS 剩余 ' + K.fmt(r.hp));
      render();
    }).catch(K.err);
  };
  U.actions.bossClaim = function (btn) {
    API.claimBossTask(btn.dataset.id).then(function (msgs) {
      K.ok('协作奖励：' + K.rewardsToText(msgs));
      render();
    }).catch(K.err);
  };

  /* ---------------- 商店 ---------------- */
  U.actions.buy = function (btn) {
    API.buyItem(btn.dataset.id, 1).then(function () {
      K.ok('购买成功：' + D.ITEMS[btn.dataset.id].name);
      render();
    }).catch(K.err);
  };

  /* ------------------------------------------------------------ 启动 */
  App.boot = function () {
    try {
      S.load();
      S.dailyExtCheck();
    } catch (e) {
      console.error('[boot]', e);
      K.err(e);
    }

    document.body.addEventListener('click', onAction);

    /* 家族创建页的徽章选择（事件委托） */
    document.body.addEventListener('click', function (e) {
      var eb = e.target.closest('.emblem-btn');
      if (!eb) return;
      var wrap = eb.closest('.emblem-pick');
      if (!wrap) return;
      wrap.querySelectorAll('.emblem-btn').forEach(function (b) { b.classList.remove('on'); });
      eb.classList.add('on');
    });

    /* Logo 点击回主城 */
    var brand = document.querySelector('.brand');
    if (brand) { brand.style.cursor = 'pointer'; brand.onclick = function () { go('home'); }; }

    /* 玩家卡片 → 个人档案 */
    var chip = document.getElementById('playerChip');
    if (chip) chip.onclick = function () { go('home'); };

    /* ---------- 外部路由：支持论坛通过 hash / postMessage 直达玩法 ---------- */
    function applyRoute(route) {
      if (!route) return;
      var parts = String(route).replace(/^#/, '').split('/');
      var view = parts[0], sub = parts[1];
      if (!U.views[view]) return;
      state.view = view;
      if (view === 'pets' && sub) state.petTab = sub;
      if (view === 'battle' && sub) state.battleTab = sub;
      if (view === 'rank' && sub) state.rankType = sub;
      if (view === 'family' && sub) state.famTab = sub;
    }
    window.addEventListener('message', function (e) {
      var d = e && e.data;
      if (!d || d.type !== 'qm-navigate') return;
      applyRoute(d.route);
      render();
      document.getElementById('content').scrollTop = 0;
    });
    applyRoute(location.hash);

    render();

    /* 每日首次进入的提示 */
    var save = S.getSave();
    if (!save.quests.welcomed || save.quests.welcomed !== S.today()) {
      save.quests.welcomed = S.today();
      S.save();
      setTimeout(function () {
        K.toast('欢迎回来，' + save.player.name + '！今日委托与试炼塔次数已刷新');
      }, 700);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
