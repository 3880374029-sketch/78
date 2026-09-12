/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 视图：征战 / 试炼塔 / 家族 / 联盟 / 排行 / 商店 / 委托
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var D = Q.DATA, S = Q.Store, API = Q.API, K = Q.Kit;
  var U = (Q.UI = Q.UI || {});
  U.views = U.views || {};
  U.actions = U.actions || {};

  /* =====================================================================
   * 征战
   * =================================================================== */
  U.views.battle = function (st) {
    var tabs = [['adventure', '🗺️ 冒险'], ['tower', '🗼 试炼塔'], ['arena', '🏟️ 竞技场'], ['war', '🎖️ 家族战']];
    var body =
      st.battleTab === 'tower' ? tabTower() :
      st.battleTab === 'arena' ? tabArena() :
      st.battleTab === 'war' ? tabWar() : tabAdventure(st);

    return '<div class="page">' +
      '<div class="page-head"><h1>征战</h1><p>当前编队战力 ' + K.fmt(S.teamPower()) + '</p>' +
      '<div class="spacer"></div><button class="btn sm" data-act="nav" data-v="pets">调整编队</button></div>' +
      '<div class="tabs">' + tabs.map(function (t) {
        return '<button class="tab' + (st.battleTab === t[0] ? ' active' : '') + '" data-act="battleTab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' + body + '</div>';
  };

  /* ---------------------------- 冒险 ---------------------------- */
  function tabAdventure(st) {
    var p = S.getSave();
    var chapter = D.CHAPTERS[st.chapter] || D.CHAPTERS[0];
    return '<div class="g-col230">' +
      '<div class="card"><div class="card-h"><h3>章节</h3></div><div class="card-b tight">' +
      D.CHAPTERS.map(function (c, i) {
        var unlocked = c.stages[0].idx <= p.world.stageProgress;
        var cleared = c.stages[4].idx < p.world.stageProgress;
        return '<div class="stage-node' + (unlocked ? '' : ' locked') + '" data-act="chapter" data-v="' + i + '"' +
          (st.chapter === i ? ' style="background:var(--jade-soft);border-color:#cbe5dc"' : '') + '>' +
          '<div class="no">' + (i + 1) + '</div><div class="si"><b>' + c.name + '</b>' +
          '<span>' + (cleared ? '已通关' : unlocked ? '进行中' : '未解锁') + '</span></div></div>';
      }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h3>' + chapter.name + '</h3><span class="sub">推荐 Lv.' + chapter.stages[0].level + ' 起</span></div><div class="card-b">' +
      chapter.stages.map(function (s) {
        var unlocked = s.idx <= p.world.stageProgress;
        var cleared = s.idx < p.world.stageProgress;
        return '<div class="stage-node' + (unlocked ? '' : ' locked') + (cleared ? ' clear' : '') + (s.boss ? ' boss' : '') + '" data-act="stage" data-v="' + s.idx + '">' +
          '<div class="no">' + (s.boss ? '👑' : s.idx) + '</div>' +
          '<div class="si"><b>' + s.name + (s.boss ? ' · 首领战' : '') + '</b>' +
          '<span>敌方 ' + s.enemyCount + ' 只 · 等级 ' + s.level + ' · ' + K.fmt(s.reward.gold) + '🪙 + ' + K.fmt(s.reward.exp) + '经验' +
          (s.reward.item ? ' + ' + D.ITEMS[s.reward.item].name : '') + '</span></div>' +
          '<div>' + (cleared ? K.tag('已通关', 'jade') : unlocked ? K.tag('可挑战', 'gold') : K.tag('未解锁')) + '</div></div>';
      }).join('') + '</div></div></div>';
  }

  /* ---------------------------- 试炼塔（新增玩法） ---------------------------- */
  function tabTower() {
    var info = S.towerInfo();
    var T = info.def;
    var save = S.getSave();
    var myBest = save.player.stats.towerBest || 0;
    var enemies = S.makeTowerEnemies(info.floor);
    var ranks = S.getLeaderboard('tower').slice(0, 8);

    return '<div class="g-side320">' +
      '<div class="card"><div class="card-h"><h3>🗼 神兽试炼塔</h3>' +
      '<span class="sub">' + T.lore + '</span></div><div class="card-b">' +

      '<div class="tower-hero">' +
      '<div class="th-floor"><span>当前层</span><b>' + info.floor + '</b><small>/ ' + info.maxFloor + '</small></div>' +
      '<div class="th-meta">' +
      '<div class="kv"><span class="k">历史最高</span><span class="v">第 ' + info.best + ' 层</span></div>' +
      '<div class="kv"><span class="k">今日挑战次数</span><span class="v">' + info.remaining + ' / ' + (T.dailyAttempts + info.extra) + '</span></div>' +
      '<div class="kv"><span class="k">本层类型</span><span class="v">' + (info.isBoss ? '👑 首领层（属性 ×1.25）' : '普通层') + '</span></div>' +
      '</div></div>' +

      '<div class="tower-preview">' +
      '<div class="hint mb8">本层守关（等级 ' + enemies[0].level + '）</div>' +
      '<div class="row-flex">' + enemies.map(function (e) {
        var sp = D.getSpecies(e.speciesId);
        return '<div class="tower-enemy"><div class="te-art" style="--tone:' + sp.palette.main + ';--glow:' + sp.palette.glow + '">' + sp.emoji + '</div>' +
          '<small>' + K.esc(e.nickname) + '</small><span class="tag">Lv.' + e.level + '</span></div>';
      }).join('') + '</div>' +
      '<div class="hint mt12">通关奖励：' + K.rewardChips(T.reward(info.floor)).join('　') + '</div>' +
      '</div>' +

      '<div class="row-flex mt16">' +
      '<button class="btn primary lg" data-act="towerBattle"' + (info.remaining <= 0 ? ' disabled' : '') + '>' +
      (info.remaining > 0 ? '⚔️ 挑战第 ' + info.floor + ' 层' : '今日次数已用完') + '</button>' +
      '<button class="btn" data-act="towerBuy">购买次数 · ' + T.extraAttemptCost.gem + ' 💎</button>' +
      '<button class="btn ghost" data-act="nav" data-v="rank">查看层数榜</button>' +
      '</div>' +
      '<div class="hint mt12">规则：每日 ' + T.dailyAttempts + ' 次免费挑战，失败不扣层数；每 ' + T.bossEvery + ' 层为首领层，属性 ×1.25；首次通关额外获得 ' +
      K.rewardChips(T.firstClearBonus).join(' + ') + ' 并在世界频道播报。</div>' +
      '</div></div>' +

      '<div>' +
      '<div class="card"><div class="card-h"><h3>我的战绩</h3></div><div class="card-b">' +
      K.kv('最高到达', '第 ' + myBest + ' 层') +
      K.kv('累计通关', Math.max(0, info.floor - 1) + ' 层') +
      '<div class="divider"></div>' +
      '<div class="hint mb8">最近挑战</div>' +
      (info.history.length ? info.history.map(function (h) {
        return '<div class="kv"><span class="k">第 ' + h.floor + ' 层</span><span class="v" style="color:' + (h.win ? 'var(--jade)' : 'var(--cinnabar)') + '">' + (h.win ? '通关' : '失败') + '</span></div>';
      }).join('') : '<div class="hint">暂无记录</div>') +
      '</div></div>' +

      '<div class="card"><div class="card-h"><h3>试炼塔榜</h3><span class="sub">Top 8</span></div><div class="card-b tight">' +
      ranks.map(function (r) {
        return '<div class="rank-row' + (r.isMe ? ' me' : '') + '"><span class="rank-no ' + (r.rank <= 3 ? 't' + r.rank : '') + '">' + r.rank + '</span>' +
          '<span style="flex:1"><b>' + K.esc(r.name) + '</b><br><small class="hint">' + K.esc(r.family) + '</small></span>' +
          '<span class="val">' + r.value + ' 层</span></div>';
      }).join('') +
      '</div></div></div></div>';
  }

  /* ---------------------------- 竞技场 ---------------------------- */
  function tabArena() {
    return '<div class="card"><div class="card-h"><h3>🏟️ 竞技场</h3><span class="sub">匹配战力相近的御兽师</span></div><div class="card-b">' +
      '<div class="arena-intro">' +
      '<div class="ai-ico">🏟️</div>' +
      '<div><b>随时开战</b><div class="hint mt8">胜利获得 30 灵玉 + 800 金币 + 20 贡献；失败也有 200 金币安慰奖。战力越高，对手越强。</div></div>' +
      '</div>' +
      '<div class="row-flex mt16"><button class="btn primary lg" data-act="arenaBattle">⚔️ 快速匹配</button>' +
      '<span class="hint">当前战力 ' + K.fmt(S.teamPower()) + '（含羁绊加成）</span></div>' +
      '</div></div>';
  }

  /* ---------------------------- 家族战 ---------------------------- */
  function tabWar() {
    var fam = S.getFamily();
    if (!fam) return '<div class="card">' + K.empty('🏛️', '尚未加入家族，无法参加家族战', '<button class="btn primary" data-act="nav" data-v="family">前往家族</button>') + '</div>';
    var opps = S.warOpponents();
    var me = S.myMember();
    var canWar = me && ['leader', 'vice', 'elder', 'elite'].indexOf(me.position) >= 0;
    var rank = D.rankOfWarScore(fam.warScore);
    var W = D.FAMILY.war;

    return '<div class="card"><div class="card-h"><h3>🎖️ 家族战 · 本赛季</h3>' +
      '<span class="sub">段位 ' + rank.emoji + ' ' + rank.name + ' · 积分 ' + fam.warScore + '</span><div class="spacer"></div>' +
      K.tag('胜 ' + (fam.seasonWins || 0), 'jade') + ' ' + K.tag('负 ' + (fam.seasonLosses || 0), 'red') + '</div><div class="card-b">' +
      (canWar ? '' : '<div class="hint mb12" style="color:var(--cinnabar)">你的职位（' + (me ? me.position : '-') + '）无权发起家族战，仅族长/副族长/长老/精英可发起。</div>') +
      '<div class="hint mb12">规则：3v3 自动战斗，胜 +' + W.winScore + ' 分、平 +' + W.drawScore + ' 分；每分奖励 ' + W.rewardPerScore.contrib + ' 贡献 + ' +
      K.fmt(W.rewardPerScore.gold) + ' 金币。段位阈值：' + W.ranks.map(function (r) { return r.emoji + r.name + '（' + r.min + '）'; }).join(' → ') + '。</div>' +
      '<div class="grid g2">' + opps.map(function (f) {
        var r = D.rankOfWarScore(f.warScore);
        return '<div class="war-target">' +
          '<div class="wt-head"><span class="wt-emblem">' + f.badge + '</span>' +
          '<div style="flex:1;min-width:0"><b>' + K.esc(f.name) + '</b><div class="hint">Lv.' + f.level + ' · ' + f.members.length + ' 人 · ' + r.emoji + r.name + '</div></div>' +
          '<span class="tag gold">积分 ' + f.warScore + '</span></div>' +
          '<div class="hint mt8">主力：' + f.members.slice(0, 3).map(function (m) { return K.esc(m.name) + '（' + K.fmt(m.power) + '）'; }).join('、') + '</div>' +
          '<button class="btn ' + (canWar ? 'primary' : '') + ' block mt12" data-act="warStart" data-id="' + f.id + '"' + (canWar ? '' : ' disabled') + '>⚔️ 发起家族战</button>' +
          '</div>';
      }).join('') + '</div>' +
      '</div></div>';
  }

  /* =====================================================================
   * 家族
   * =================================================================== */
  U.views.family = function (st) {
    var fam = S.getFamily();
    if (!fam) return familyJoinView();

    var tabs = [['overview', '概览'], ['members', '成员'], ['tech', '科技'], ['quest', '任务'], ['ally', '联盟']];
    var body =
      st.famTab === 'members' ? famMembers(fam) :
      st.famTab === 'tech' ? famTech(fam) :
      st.famTab === 'quest' ? famQuest(fam) :
      st.famTab === 'ally' ? famAlly(fam) : famOverview(fam);

    return '<div class="page">' +
      '<div class="page-head"><h1>家族</h1><p>' + K.esc(fam.badge + ' ' + fam.name) + ' · Lv.' + fam.level + '</p></div>' +
      '<div class="tabs">' + tabs.map(function (t) {
        var dot = (t[0] === 'ally' && (fam.allyRequests || []).length) ? ' <span class="tag red">' + fam.allyRequests.length + '</span>' : '';
        return '<button class="tab' + (st.famTab === t[0] ? ' active' : '') + '" data-act="famTab" data-v="' + t[0] + '">' + t[1] + dot + '</button>';
      }).join('') + '</div>' + body + '</div>';
  };

  function familyJoinView() {
    var fams = S.recruitTargets();
    var cost = D.FAMILY.createCost.gold;
    return '<div class="page">' +
      '<div class="page-head"><h1>家族</h1><p>创建或加入一个家族，参与家族战与联盟协作</p></div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-h"><h3>🏗️ 创建家族</h3><span class="sub">消耗 ' + K.fmt(cost) + ' 金币</span></div><div class="card-b">' +
      '<div class="field"><label>家族名称（' + D.FAMILY.nameMin + '-' + D.FAMILY.nameMax + ' 字）</label><input type="text" id="famName" maxlength="' + D.FAMILY.nameMax + '" placeholder="例如：青丘阁"></div>' +
      '<div class="field"><label>家族徽章</label><div class="emblem-pick" id="famBadge">' +
      ['🐉', '🔥', '🌊', '⚔️', '🌙', '⭐', '🏔️', '🌸', '🐯', '🐂'].map(function (e, i) {
        return '<button class="emblem-btn' + (i === 0 ? ' on' : '') + '" data-e="' + e + '">' + e + '</button>';
      }).join('') + '</div></div>' +
      '<div class="field"><label>家族公告</label><textarea id="famNotice" rows="2" placeholder="欢迎加入我们的家族！"></textarea></div>' +
      '<button class="btn primary block" data-act="famCreate">创建家族（' + K.fmt(cost) + ' 🪙）</button>' +
      '</div></div>' +
      '<div class="card"><div class="card-h"><h3>📜 加入家族</h3><span class="sub">共 ' + fams.length + ' 个可选</span></div>' +
      '<div class="card-b" style="max-height:460px;overflow:auto">' +
      fams.map(function (f) {
        var full = f.members.length >= S.memberCap(f);
        return '<div class="fam-list-row">' +
          '<span class="flr-emblem">' + f.badge + '</span>' +
          '<div style="flex:1;min-width:0"><b>' + K.esc(f.name) + '</b>' +
          '<div class="hint">Lv.' + f.level + ' · ' + f.members.length + '/' + S.memberCap(f) + ' 人 · 积分 ' + f.warScore + ' · 盟友 ' + (f.allies || []).length + '</div></div>' +
          '<button class="btn sm' + (full ? '' : ' primary') + '" data-act="famJoin" data-id="' + f.id + '"' + (full ? ' disabled' : '') + '>' + (full ? '已满' : '加入') + '</button>' +
          '</div>';
      }).join('') + '</div></div></div></div>';
  }

  function famOverview(fam) {
    var me = S.myMember();
    var cap = S.memberCap(fam);
    var need = D.familyExpToNext(fam.level);
    var totalPower = fam.members.reduce(function (a, m) { return a + (m.power || 0); }, 0);
    var myContrib = me ? me.contribution : 0;
    return '<div class="fam-banner">' +
      '<div class="row"><div class="fam-emblem">' + fam.badge + '</div>' +
      '<div style="flex:1;min-width:0"><h2>' + K.esc(fam.name) + '</h2>' +
      '<div class="meta">Lv.' + fam.level + ' / ' + D.FAMILY.maxLevel + ' · ' + fam.members.length + '/' + cap + ' 人 · 成立于 ' +
      new Date(fam.createdAt).toLocaleDateString('zh-CN') + '</div></div>' +
      '<div class="fam-rank-chip">' + D.rankOfWarScore(fam.warScore).emoji + '<div><b>' + D.rankOfWarScore(fam.warScore).name + '</b><small>积分 ' + fam.warScore + '</small></div></div>' +
      '</div>' +
      '<div class="stats">' +
      '<div><small>家族等级</small><b>' + fam.level + '</b></div>' +
      '<div><small>家族总战力</small><b>' + K.fmt(totalPower) + '</b></div>' +
      '<div><small>家族资金</small><b>' + K.fmt(fam.funds) + '</b></div>' +
      '<div><small>累计贡献</small><b>' + K.fmt(fam.contribution) + '</b></div>' +
      '<div><small>盟友</small><b>' + (fam.allies || []).length + ' / ' + D.FAMILY.maxAllies + '</b></div>' +
      '</div>' +
      '<div class="fam-expbar"><div class="bar"><i style="width:' + K.clamp(fam.exp / need * 100, 0, 100) + '%"></i></div>' +
      '<div class="hint" style="color:rgba(255,255,255,.8)">家族经验 ' + K.fmt(fam.exp) + ' / ' + K.fmt(need) + '</div></div>' +
      '</div>' +

      '<div class="grid g2 mt16">' +
      '<div class="card"><div class="card-h"><h3>公告</h3></div><div class="card-b">' +
      '<div style="padding:12px;background:var(--panel-2);border-radius:9px;border:1px dashed var(--border-2);font-size:13px">' + K.esc(fam.notice) + '</div>' +
      '<div class="divider"></div>' +
      '<div class="field"><label>向家族捐献金币（100 金币 = 1 贡献）</label>' +
      '<div class="row-flex"><button class="btn" data-act="famDonate" data-n="1000">捐 1,000</button>' +
      '<button class="btn" data-act="famDonate" data-n="5000">捐 5,000</button>' +
      '<button class="btn" data-act="famDonate" data-n="20000">捐 20,000</button></div></div>' +
      '<div class="row-flex mt12">' +
      '<button class="btn danger" data-act="famLeave">退出家族</button>' +
      '</div>' +
      '</div></div>' +

      '<div class="card"><div class="card-h"><h3>我的家族数据</h3></div><div class="card-b">' +
      K.kv('职位', posTag(me ? me.position : 'member')) +
      K.kv('我的贡献', K.fmt(myContrib)) +
      K.kv('我的战力（含羁绊）', K.fmt(S.teamPower())) +
      K.kv('已持有家族贡献', K.fmt(S.getSave().inventory.contrib)) +
      '<div class="divider"></div>' +
      '<div class="hint">家族等级加成：全族灵兽全属性 +' + K.pct((D.FAMILY.levelBuff(fam.level) - 1)) + '（随家族等级提升）</div>' +
      '<div class="hint mt8">家族科技加成见「科技」页；两者与灵兽羁绊<b>乘算叠加</b>。</div>' +
      '</div></div></div>';
  }

  function posTag(pos) {
    var map = {};
    D.FAMILY.positions.forEach(function (p) { map[p.id] = p.name; });
    var cls = 'pos-' + pos;
    return '<span class="' + cls + '" style="padding:1px 8px;border-radius:5px;font-size:11px;font-weight:700">' + (map[pos] || pos) + '</span>';
  }

  function famMembers(fam) {
    var sorted = fam.members.slice().sort(function (a, b) {
      var oa = posOrder(a.position), ob = posOrder(b.position);
      if (oa !== ob) return oa - ob;
      return (b.power || 0) - (a.power || 0);
    });
    return '<div class="card"><div class="card-h"><h3>成员</h3><span class="sub">' + fam.members.length + ' / ' + S.memberCap(fam) + '</span></div>' +
      '<div class="card-b tight">' + sorted.map(function (m) {
        return '<div class="member-row' + (m.id === S.getSave().player.id ? ' me' : '') + '">' +
          '<span style="font-size:20px">' + (m.position === 'leader' ? '👑' : m.position === 'vice' ? '🎖️' : '🧑‍🌾') + '</span>' +
          '<span class="nm">' + K.esc(m.name) + '</span>' + posTag(m.position) +
          '<span class="right"><span title="贡献">🏵️ ' + K.fmt(m.contribution) + '</span>' +
          '<span title="战力">⚔️ ' + K.fmt(m.power) + '</span>' +
          '<span title="活跃">' + (m.active === false ? '💤' : '🟢') + '</span></span></div>';
      }).join('') + '</div></div>';
  }
  function posOrder(p) { for (var i = 0; i < D.FAMILY.positions.length; i++) if (D.FAMILY.positions[i].id === p) return D.FAMILY.positions[i].order; return 9; }

  function famTech(fam) {
    var me = S.myMember();
    var can = me && ['leader', 'vice'].indexOf(me.position) >= 0;
    return '<div class="card"><div class="card-h"><h3>家族科技</h3>' +
      '<span class="sub">全族共享 · ' + (can ? '你有升级权限' : '仅族长/副族长可升级') + '</span><div class="spacer"></div>' +
      '<span class="hint">我的贡献：' + K.fmt(S.getSave().inventory.contrib) + '</span></div><div class="card-b">' +
      '<div class="grid g2">' + D.FAMILY.techs.map(function (t) {
        var lv = fam.techs[t.id] || 0;
        var cost = D.FAMILY.techCost(lv);
        var maxed = lv >= t.maxLevel;
        return '<div class="tech-card">' +
          '<div class="row-flex"><span style="font-size:26px">' + t.emoji + '</span>' +
          '<div style="flex:1"><b>' + t.name + '</b><div class="hint">' + t.effect + '</div></div>' +
          '<span class="tag gold">Lv.' + lv + '/' + t.maxLevel + '</span></div>' +
          '<div class="bar thin mt12"><i style="width:' + (lv / t.maxLevel * 100) + '%"></i></div>' +
          '<div class="hint mt8">当前总效果：+' + K.pct(parseFloat((Object.values(t.perLevel)[0] * lv * 100).toFixed(1)) / 100) + '</div>' +
          (maxed ? '<button class="btn block mt12" disabled>已满级</button>'
            : '<button class="btn ' + (can ? 'primary' : '') + ' block mt12" data-act="famTech" data-id="' + t.id + '"' + (can ? '' : ' disabled') + '>' +
            '升级 · ' + cost.contrib + '🏵️ + ' + K.fmt(cost.gold) + '🪙</button>') +
          '</div>';
      }).join('') + '</div></div></div>';
  }

  function famQuest(fam) {
    var done = S.getSave().quests.family || {};
    return '<div class="card"><div class="card-h"><h3>家族日常任务</h3><span class="sub">每日 0 点刷新</span></div><div class="card-b">' +
      D.FAMILY.quests.map(function (q) {
        var progress = Math.min(q.need, done[q.id] || 0);
        var complete = progress >= q.need;
        var claimed = !!done[q.id + '_done'];
        return '<div class="quest-row">' +
          '<div style="flex:1;min-width:0"><div class="row-flex"><b>' + q.name + '</b>' +
          (claimed ? K.tag('已领取', 'jade') : complete ? K.tag('可领取', 'gold') : K.tag('进行中')) + '</div>' +
          '<div class="hint mt8">' + q.desc + ' · ' + progress + '/' + q.need + '</div>' +
          '<div class="bar thin mt8"><i style="width:' + (progress / q.need * 100) + '%"></i></div>' +
          '<div class="hint mt8">奖励：' + K.rewardChips(q.reward).join('　') + '</div></div>' +
          '<button class="btn ' + (complete && !claimed ? 'primary' : '') + '" data-act="famQuest" data-id="' + q.id + '"' + (complete && !claimed ? '' : ' disabled') + '>领取</button>' +
          '</div>';
      }).join('') + '</div></div>';
  }

  /* ---------------------------- 联盟（新增玩法） ---------------------------- */
  function famAlly(fam) {
    var me = S.myMember();
    var isLeader = me && me.position === 'leader';
    var allies = fam.allies || [];
    var reqs = fam.allyRequests || [];
    var boss = S.getSave().world.boss;
    var AB = D.FAMILY.allianceBoss;
    var candidates = S.allFamilies().filter(function (f) {
      return f.id !== fam.id && allies.indexOf(f.id) < 0 && f.allies.length < D.FAMILY.maxAllies;
    }).slice(0, 6);
    var bossDmg = Math.round(S.teamPower() * 0.35);

    return '<div class="g-side340">' +
      '<div>' +
      '<div class="card"><div class="card-h"><h3>🤝 盟友列表</h3>' +
      '<span class="sub">' + allies.length + ' / ' + D.FAMILY.maxAllies + '</span></div><div class="card-b">' +
      (allies.length ? '<div class="grid g2">' + allies.map(function (id) {
        var a = S.getFamilyById(id);
        if (!a) return '';
        return '<div class="ally-card"><span class="em">' + a.badge + '</span>' +
          '<div style="flex:1;min-width:0"><b>' + K.esc(a.name) + '</b>' +
          '<div class="hint">Lv.' + a.level + ' · ' + a.members.length + ' 人 · 积分 ' + a.warScore + '</div></div>' +
          (isLeader ? '<button class="btn sm danger" data-act="allyDissolve" data-id="' + a.id + '">解除</button>' : '') +
          '</div>';
      }).join('') + '</div>'
        : K.empty('🕊️', '还没有盟友。<br><span class="hint">家族最多可与 ' + D.FAMILY.maxAllies + ' 个家族结盟，结盟后可共同讨伐世界 BOSS。</span>')) +
      '</div></div>' +

      (isLeader && reqs.length ? '<div class="card mt16"><div class="card-h"><h3>待处理的结盟申请</h3>' +
        '<span class="sub">' + reqs.length + ' 条</span></div><div class="card-b">' +
        reqs.map(function (id) {
          var f = S.getFamilyById(id);
          if (!f) return '';
          return '<div class="ally-card"><span class="em">' + f.badge + '</span>' +
            '<div style="flex:1;min-width:0"><b>' + K.esc(f.name) + '</b><div class="hint">Lv.' + f.level + ' · ' + f.members.length + ' 人</div></div>' +
            '<button class="btn sm primary" data-act="allyAccept" data-id="' + f.id + '">接受</button>' +
            '<button class="btn sm" data-act="allyReject" data-id="' + f.id + '">拒绝</button></div>';
        }).join('') + '</div></div>' : '') +

      '<div class="card mt16"><div class="card-h"><h3>发现家族</h3>' +
      '<span class="sub">可发起结盟' + (isLeader ? '' : '（仅族长可发起）') + '</span></div><div class="card-b tight">' +
      candidates.map(function (f) {
        return '<div class="member-row"><span style="font-size:20px">' + f.badge + '</span>' +
          '<span class="nm">' + K.esc(f.name) + '</span>' +
          '<span class="right"><span>Lv.' + f.level + '</span><span>盟友 ' + f.allies.length + '/' + D.FAMILY.maxAllies + '</span></span>' +
          '<button class="btn sm' + (isLeader ? ' primary' : '') + '" data-act="allyRequest" data-id="' + f.id + '"' + (isLeader ? '' : ' disabled') + '>结盟</button></div>';
      }).join('') + '</div></div></div>' +

      /* --- 联盟协作任务 / 世界 BOSS --- */
      '<div>' +
      '<div class="card"><div class="card-h"><h3>🐍 世界 BOSS · ' + AB.name + '</h3></div><div class="card-b">' +
      '<div class="boss-bar"><i style="width:' + K.clamp((1 - boss.hp / boss.maxHp) * 100, 0, 100) + '%"></i>' +
      '<span class="txt">' + K.fmt(boss.hp) + ' / ' + K.fmt(boss.maxHp) + '</span></div>' +
      '<div class="row-flex mt12">' +
      '<span class="tag red">已讨伐 ' + ((1 - boss.hp / boss.maxHp) * 100).toFixed(1) + '%</span>' +
      '<span class="tag jade">我的累计伤害 ' + K.fmt(boss.participantDamage) + '</span>' +
      '</div>' +
      '<button class="btn primary block mt12" data-act="bossAttack"' + (allies.length ? '' : ' disabled') + '>' +
      (allies.length ? '⚔️ 出战（预计 ' + K.fmt(bossDmg) + ' 伤害）' : '需要至少 1 个盟友') + '</button>' +
      '<div class="hint mt12">每次出战伤害 = 当前编队战力（含羁绊）× 0.35，并折算为家族贡献。</div>' +
      '</div></div>' +

      '<div class="card"><div class="card-h"><h3>联盟协作任务</h3></div><div class="card-b">' +
      AB.tasks.map(function (t) {
        var p = K.clamp(boss.participantDamage / (boss.maxHp * t.threshold), 0, 1);
        var claimed = boss.claimedTasks.indexOf(t.id) >= 0;
        var reached = p >= 1;
        return '<div class="quest-row"><div style="flex:1;min-width:0">' +
          '<div class="row-flex"><b>' + t.name + '</b>' + (claimed ? K.tag('已领取', 'jade') : reached ? K.tag('可领取', 'gold') : K.tag('进行中')) + '</div>' +
          '<div class="hint mt8">' + t.desc + '</div>' +
          '<div class="bar thin mt8"><i style="width:' + (p * 100) + '%"></i></div>' +
          '<div class="hint mt8">奖励：' + K.rewardChips(t.reward).join('　') + '</div></div>' +
          '<button class="btn ' + (reached && !claimed ? 'primary' : '') + '" data-act="bossClaim" data-id="' + t.id + '"' + (reached && !claimed ? '' : ' disabled') + '>领取</button>' +
          '</div>';
      }).join('') +
      '</div></div>' +
      '</div></div>';
  }

  /* =====================================================================
   * 排行榜
   * =================================================================== */
  U.views.rank = function (st) {
    var rows = S.getLeaderboard(st.rankType);
    var my = rows.filter(function (r) { return r.isMe; })[0];
    var typeDef = D.RANK_TYPES.filter(function (t) { return t.id === st.rankType; })[0] || D.RANK_TYPES[0];
    var isFamily = st.rankType === 'family' || st.rankType === 'war';
    var unit = st.rankType === 'tower' ? ' 层' : '';

    return '<div class="page">' +
      '<div class="page-head"><h1>排行榜</h1><p>' + typeDef.emoji + ' ' + typeDef.name + ' · ' + typeDef.desc + '</p></div>' +
      '<div class="tabs">' + D.RANK_TYPES.map(function (t) {
        return '<button class="tab' + (st.rankType === t.id ? ' active' : '') + '" data-act="rankTab" data-v="' + t.id + '">' + t.emoji + ' ' + t.name + '</button>';
      }).join('') + '</div>' +

      (my ? '<div class="card mb16"><div class="card-b" style="display:flex;align-items:center;gap:14px">' +
        '<span class="rank-no ' + (my.rank <= 3 ? 't' + my.rank : '') + '">' + my.rank + '</span>' +
        '<div><b>我的排名</b><div class="hint">' + (my.family ? K.esc(my.family) : '—') + '</div></div>' +
        '<span style="margin-left:auto;font-weight:800;color:var(--gold);font-size:18px">' + K.fmt(my.value) + unit + '</span></div></div>' : '') +

      '<div class="card"><div class="card-h"><h3>' + typeDef.name + '</h3><span class="sub">共 ' + rows.length + ' 条</span></div>' +
      '<div class="card-b tight">' + rows.slice(0, 60).map(function (r) {
        return '<div class="rank-row' + (r.isMe ? ' me' : '') + '">' +
          '<span class="rank-no ' + (r.rank <= 3 ? 't' + r.rank : '') + '">' + r.rank + '</span>' +
          (isFamily && r.badge ? '<span style="font-size:18px">' + r.badge + '</span>' : '') +
          '<span style="flex:1;min-width:0"><b>' + K.esc(r.name) + '</b>' +
          (isFamily
            ? '<br><small class="hint">Lv.' + r.level + ' · ' + r.members + ' 人 · 盟友 ' + (r.allies || 0) + (r.wins !== undefined ? ' · 胜 ' + r.wins + ' 负 ' + r.losses : '') + '</small>'
            : '<br><small class="hint">' + K.esc(r.family || '—') + '</small>') +
          '</span>' +
          '<span class="val">' + K.fmt(r.value) + unit + '</span></div>';
      }).join('') + '</div></div></div>';
  };

  /* =====================================================================
   * 商店 / 背包
   * =================================================================== */
  U.views.shop = function (st) {
    var inv = S.getSave().inventory;
    var bought = inv.shopBought || {};
    return '<div class="page">' +
      '<div class="page-head"><h1>商店</h1><p>每日限购刷新 · 部分商品仅可用家族贡献兑换</p></div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-h"><h3>🛒 补给商店</h3></div><div class="card-b">' +
      D.SHOP.map(function (it) {
        var item = D.ITEMS[it.itemId];
        var used = bought[it.itemId] || 0;
        var left = it.limit - used;
        var costText = Object.keys(it.cost).map(function (k) { return K.fmt(it.cost[k]) + D.ITEMS[k].emoji; }).join(' ');
        return '<div class="shop-item"><span class="em">' + item.emoji + '</span>' +
          '<div style="flex:1;min-width:0"><b>' + item.name + '</b>' +
          '<div class="hint">' + item.desc + '</div>' +
          '<div class="hint mt8">今日剩余 <b>' + left + '</b> / ' + it.limit + '</div></div>' +
          '<button class="btn ' + (left > 0 ? 'primary' : '') + '" data-act="buy" data-id="' + it.itemId + '"' + (left > 0 ? '' : ' disabled') + '>' +
          (left > 0 ? costText : '售罄') + '</button></div>';
      }).join('') + '</div></div>' +

      '<div class="card"><div class="card-h"><h3>🎒 我的背包</h3></div><div class="card-b">' +
      Object.keys(D.ITEMS).filter(function (k) { return !D.ITEMS[k].currency; }).map(function (k) {
        return K.kv(D.ITEMS[k].emoji + ' ' + D.ITEMS[k].name, '× ' + K.fmt(inv[k] || 0));
      }).join('') +
      '<div class="divider"></div>' +
      Object.keys(D.ITEMS).filter(function (k) { return D.ITEMS[k].currency; }).map(function (k) {
        return K.kv(D.ITEMS[k].emoji + ' ' + D.ITEMS[k].name, K.fmt(inv[k] || 0));
      }).join('') +
      '<div class="hint mt12">经验丹与嫩灵草需在【灵兽详情】中喂食使用。</div>' +
      '</div></div></div></div>';
  };

  /* =====================================================================
   * 每日委托（新增玩法 · 独立页）
   * =================================================================== */
  U.views.daily = function () {
    var info = S.dailyInfo();
    var pctv = info.doneCount / info.total * 100;
    return '<div class="page">' +
      '<div class="page-head"><h1>每日委托</h1><p>每天 0 点刷新 · 完成度越高奖励越好</p></div>' +
      '<div class="card"><div class="card-h"><h3>📜 今日委托</h3>' +
      '<span class="sub">完成度 ' + info.doneCount + ' / ' + info.total + '</span></div><div class="card-b">' +
      '<div class="bar fat"><i style="width:' + pctv + '%"></i></div>' +
      '<div class="divider"></div>' +
      info.tasks.map(function (t) {
        var p = K.clamp(t.current / t.def.need, 0, 1) * 100;
        return '<div class="daily-row' + (t.done ? ' done' : '') + '">' +
          '<span class="dr-ico">' + t.def.emoji + '</span>' +
          '<span class="dr-body"><b>' + t.def.name + '</b><small>' + t.def.desc + ' · ' + t.current + '/' + t.def.need + '</small>' +
          '<div class="bar thin" style="margin-top:5px"><i style="width:' + p + '%"></i></div>' +
          '<small class="hint">奖励：' + K.rewardChips(t.def.reward).join('　') + '</small></span>' +
          (t.claimed ? K.tag('已领取', 'jade') : t.done ? '<button class="btn sm primary" data-act="dailyClaim" data-id="' + t.def.id + '">领取</button>' : K.tag('进行中')) +
          '</div>';
      }).join('') +
      '<div class="divider"></div>' +
      '<div class="hint mb8">里程碑宝箱</div>' +
      info.milestones.map(function (m) {
        return '<div class="quest-row"><div style="flex:1"><b>' + m.def.name + '</b>' +
          '<div class="hint mt8">完成 ' + m.def.need + ' 项委托 · 奖励：' + K.rewardChips(m.def.reward).join('　') + '</div></div>' +
          '<button class="btn ' + (m.reached && !m.claimed ? 'primary' : '') + '" data-act="dailyMilestone" data-idx="' + m.index + '"' + (m.reached && !m.claimed ? '' : ' disabled') + '>' +
          (m.claimed ? '已领取' : m.reached ? '领取' : '未达成') + '</button></div>';
      }).join('') +
      '</div></div></div>';
  };

  /* =====================================================================
   * 灵兽详情弹窗（供多个视图复用）
   * =================================================================== */
  U.openPetDetail = function (uid, refresh) {
    var save = S.getSave(), pet = S.findPet(save, uid);
    if (!pet) return;
    var sp = D.getSpecies(pet.speciesId);
    var st2 = S.computeStats(pet);
    var inTeam = save.team.indexOf(pet.uid) >= 0;
    var stage = D.getStage(pet.level);
    var need = D.expToNext(pet.level);
    var rar = D.RARITY[sp.rarity];
    var be = st2.bondEffects || {};

    var body =
      '<div class="pet-hero">' +
      '<div class="art" style="--tone:' + sp.palette.main + ';--glow:' + sp.palette.glow + '">' + sp.emoji + '</div>' +
      '<div class="info"><h2>' + K.esc(pet.nickname) + '</h2>' +
      '<div class="sub">' + sp.title + ' · ' + sp.role + ' · ' + sp.element + '元素 · ' + rar.name + '</div>' +
      '<div class="tags">' + K.tag('Lv.' + pet.level + ' / ' + D.FORMULA.maxLevel, 'gold') +
      '<span class="tag" style="background:' + stage.color + '22;color:' + stage.color + '">' + stage.name + '期</span>' +
      '<span class="tag gold">' + K.star(pet.star) + '</span>' + K.tag('战力 ' + K.fmt(S.powerOf(pet)), 'jade') +
      (inTeam ? K.tag('出战中', 'jade') : '') + '</div>' +
      '<div class="bar mt12"><i style="width:' + Math.min(100, pet.exp / need * 100) + '%"></i></div>' +
      '<div class="hint mt8">经验 ' + K.fmt(pet.exp) + ' / ' + K.fmt(need) + '</div>' +
      '</div></div>' +

      '<div class="grid g2">' +
      '<div><h4 class="sec-t">📊 当前属性</h4>' +
      K.statRow('生命', K.fmt(st2.hp)) + K.statRow('攻击', K.fmt(st2.atk)) + K.statRow('防御', K.fmt(st2.def)) +
      K.statRow('速度', K.fmt(st2.spd)) + K.statRow('暴击率', K.pct(st2.crit)) + K.statRow('暴击伤害', '+' + K.pct(st2.critDmg)) +
      K.statRow('闪避', K.pct(st2.dodge)) + K.statRow('伤害减免', K.pct(st2.damageReduce)) +
      K.statRow('治疗加成', '+' + K.pct(st2.healBonus)) +
      K.statRow('亲密度', pet.intimacy + ' / 100 <span class="up">+' + (pet.intimacy * D.FORMULA.intimacyBonus * 100).toFixed(1) + '%全属性</span>') +
      K.statRow('突破次数', pet.breakCount) +
      (Object.keys(be).length ? K.statRow('羁绊加成', Object.keys(be).map(function (k) { return k + ' ' + K.pct(be[k]); }).join('、')) : '') +
      '</div>' +
      '<div><h4 class="sec-t">🎯 培养操作</h4>' +
      '<div class="row-flex">' +
      '<button class="btn primary" data-act="petLevelUp" data-uid="' + pet.uid + '" data-n="1">升级 ×1（' + K.fmt(S.levelUpCost(pet.level)) + '🪙）</button>' +
      '<button class="btn" data-act="petLevelUp" data-uid="' + pet.uid + '" data-n="5">×5</button>' +
      '<button class="btn" data-act="petLevelUp" data-uid="' + pet.uid + '" data-n="10">×10</button></div>' +
      '<div class="row-flex mt8">' +
      '<button class="btn" data-act="petUse" data-uid="' + pet.uid + '" data-item="exp_pill">🔵 经验丹（' + (save.inventory.exp_pill || 0) + '）</button>' +
      '<button class="btn" data-act="petUse" data-uid="' + pet.uid + '" data-item="tender_grass">🌿 嫩灵草（' + (save.inventory.tender_grass || 0) + '）</button></div>' +
      '<div class="row-flex mt8">' +
      '<button class="btn gold" data-act="petBreak" data-uid="' + pet.uid + '">💠 突破（需 ' + (1 + pet.breakCount) + ' 破境石）</button>' +
      '<button class="btn gold" data-act="petStar" data-uid="' + pet.uid + '">🔷 升星（需 ' + (30 + (pet.star - 1) * 20) + ' 兽魂）</button></div>' +
      '<div class="row-flex mt8">' +
      (inTeam ? '<button class="btn danger" data-act="petTeamRemove" data-uid="' + pet.uid + '">下阵</button>'
        : '<button class="btn primary" data-act="petTeamAdd" data-uid="' + pet.uid + '">上阵</button>') +
      '<button class="btn" data-act="petRename" data-uid="' + pet.uid + '">✏️ 改名</button></div>' +
      '<div class="hint mt12">属性 = 基础 × (1 + 11.5%×等级) × 星级 × 进化阶段 × 亲密度 × 家族加成，再叠加羁绊与技能被动。</div>' +
      '</div></div>' +

      '<div class="divider"></div>' +
      '<h4 class="sec-t">📖 技能（升级消耗技能秘典，每级效果 +6%）</h4>' +
      sp.skills.map(function (sid, i) {
        var sk = D.getSkill(sid), lv = pet.skillLevels[i] || 1;
        var kn = { normal: '普通攻击', active: '主动技能', ultimate: '终极技能', passive: '被动技能' }[sk.type];
        return '<div class="skill-item ' + sk.type + '"><div class="si">' + sk.icon + '</div><div class="sb">' +
          '<div class="st"><b>' + sk.name + '</b>' + K.tag(kn, sk.type === 'ultimate' ? 'gold' : sk.type === 'passive' ? 'purple' : 'jade') +
          K.tag('Lv.' + lv + '/10') + (sk.cost ? K.tag('怒气 ' + sk.cost) : '') + (sk.cd ? K.tag('CD ' + sk.cd + '回合') : '') + '</div>' +
          '<div class="sd">' + sk.desc + '</div></div>' +
          (lv < 10 ? '<div style="display:flex;align-items:center"><button class="btn sm" data-act="petSkill" data-uid="' + pet.uid + '" data-idx="' + i + '">升级</button></div>'
            : '<span class="tag gold">已满级</span>') +
          '</div>';
      }).join('');

    var m = K.modal('灵兽详情', body, '<button class="btn" data-close2>关闭</button>', { wide: true });
    m.mask.querySelector('[data-close2]').onclick = m.close;

    m.mask.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn || !btn.dataset.uid) return;
      var act = btn.dataset.act, u = btn.dataset.uid;
      function reopen() { m.close(); U.openPetDetail(u, refresh); if (refresh) refresh(); }
      if (act === 'petLevelUp') API.levelUp(u, +btn.dataset.n).then(function (r) { K.ok(r.pet.nickname + ' 升级，当前 Lv.' + r.pet.level); reopen(); }).catch(K.err);
      else if (act === 'petUse') API.useItem(u, btn.dataset.item, 1).then(function (r) { K.ok(r.message); reopen(); }).catch(K.err);
      else if (act === 'petBreak') API.breakthrough(u).then(function (p) { K.ok('突破成功！Lv.' + p.level); reopen(); }).catch(K.err);
      else if (act === 'petStar') API.starUp(u).then(function (p) { K.ok('升星成功！★' + p.star); reopen(); }).catch(K.err);
      else if (act === 'petSkill') API.upgradeSkill(u, btn.dataset.idx).then(function () { K.ok('技能升级成功'); reopen(); }).catch(K.err);
      else if (act === 'petTeamAdd') {
        var team = S.getSave().team.slice();
        if (team.length >= 3) { K.err(new Error('编队已满，请先下阵一只灵兽')); return; }
        team.push(u);
        API.setTeam(team).then(function (r) { bondToast(r); reopen(); }).catch(K.err);
      } else if (act === 'petTeamRemove') {
        API.setTeam(S.getSave().team.filter(function (x) { return x !== u; })).then(function (r) { bondToast(r); reopen(); }).catch(K.err);
      } else if (act === 'petRename') {
        var nm = prompt('输入新的名字（最多 8 字）', pet.nickname);
        if (nm) { pet.nickname = nm.slice(0, 8); S.save(); reopen(); }
      }
    });
  };

  function bondToast(r) {
    if (r && r.bonds && r.bonds.length) K.ok('编队已更新 · 激活羁绊：' + r.bonds.map(function (b) { return b.def.name; }).join('、'));
    else K.ok('编队已更新');
  }
  U.bondToast = bondToast;
})(typeof window !== 'undefined' ? window : globalThis);
