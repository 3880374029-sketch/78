/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 视图：主城 / 灵兽 / 羁绊 / 繁育 / 每日委托
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var D = Q.DATA, S = Q.Store, API = Q.API, K = Q.Kit;
  var U = (Q.UI = Q.UI || {});
  U.views = U.views || {};
  U.actions = U.actions || {};
  U.after = U.after || {};

  function tone(sp) { return sp.palette.main; }
  function glow(sp) { return sp.palette.glow; }

  /* =====================================================================
   * 主城
   * =================================================================== */
  U.views.home = function (st) {
    var save = S.getSave(), pl = save.player, fam = S.getFamily();
    var team = save.team.map(function (u) { return S.findPet(save, u); }).filter(Boolean);
    var signedIn = save.quests.signinDate === S.today();
    var daily = S.dailyInfo();
    var tower = S.towerInfo();

    /* --- 出战编队 --- */
    var teamHtml = '';
    for (var i = 0; i < 3; i++) {
      var pet = team[i];
      if (pet) {
        var sp = D.getSpecies(pet.speciesId);
        teamHtml += '<div class="team-slot" data-act="petOpen" data-uid="' + pet.uid + '">' +
          '<div class="ts-art" style="--tone:' + tone(sp) + ';--glow:' + glow(sp) + '">' + sp.emoji + '</div>' +
          '<div class="ts-info"><b>' + K.esc(pet.nickname) + '</b>' +
          '<span>Lv.' + pet.level + ' · ' + K.star(pet.star) + ' · ' + D.getStage(pet.level).name + '</span></div>' +
          '<div class="ts-pw">⚔️ ' + K.fmt(S.powerOf(pet)) + '</div></div>';
      } else {
        teamHtml += '<div class="team-slot empty-slot" data-act="nav" data-v="pets">＋ 空位<br><small>点击前往编队</small></div>';
      }
    }

    /* --- 新增玩法快捷入口 --- */
    var quick = [
      { act: 'nav', v: 'battle', tab: 'tower', ico: '🗼', name: '神兽试炼塔', sub: '第 ' + tower.floor + ' 层 · 剩余 ' + tower.remaining + ' 次', theme: 'gold' },
      { act: 'petTab', v: 'bond', ico: '☯️', name: '灵兽羁绊', sub: '已激活 ' + S.activeBonds().filter(function (b) { return b.active; }).length + ' / ' + D.BONDS.length + ' 组', theme: 'jade' },
      { act: 'petTab', v: 'breed', ico: '🥚', name: '灵兽繁育', sub: '今日免费 ' + S.breedInfo().free + ' 次', theme: 'jade' },
      { act: 'nav', v: 'family', ico: '🏛️', name: '家族 · 联盟', sub: fam ? fam.name + ' Lv.' + fam.level : '尚未加入家族', theme: 'jade' },
      { act: 'nav', v: 'rank', ico: '🏆', name: '排行榜', sub: '战力 / 家族 / 试炼塔', theme: 'gold' }
    ];

    return '<div class="page">' +

      /* ============ 宣传海报（首屏视觉焦点） ============ */
      QMPoster.html() +

      /* ============ 新增玩法入口 ============ */
      '<div class="quick-row">' + quick.map(function (q) {
        return '<button class="quick-card ' + q.theme + '" data-act="' + q.act + '"' + (q.v ? ' data-v="' + q.v + '"' : '') + (q.tab ? ' data-tab="' + q.tab + '"' : '') + '>' +
          '<span class="qc-ico">' + q.ico + '</span>' +
          '<span class="qc-txt"><b>' + q.name + '</b><small>' + q.sub + '</small></span>' +
          (q.theme === 'gold' ? '<span class="qc-new">NEW</span>' : '') +
          '</button>';
      }).join('') + '</div>' +

      '<div class="grid g2 mt16">' +
        /* --- 编队 --- */
        '<div class="card"><div class="card-h"><h3>出战编队</h3><span class="sub">战力 ' + K.fmt(S.teamPower(save)) + '</span>' +
          '<div class="spacer"></div><button class="btn sm" data-act="nav" data-v="pets">调整编队</button></div>' +
          '<div class="card-b">' + teamHtml + '</div></div>' +

        /* --- 每日委托（新增玩法） --- */
        '<div class="card"><div class="card-h"><h3>📜 每日委托</h3>' +
          '<span class="sub">完成度 ' + daily.doneCount + '/' + daily.total + '</span><div class="spacer"></div>' +
          '<button class="btn sm" data-act="nav" data-v="daily">全部</button></div>' +
          '<div class="card-b" style="padding:12px 18px">' +
          daily.tasks.slice(0, 3).map(dailyRow).join('') +
          '<div class="hint mt8">完成 3 项领【勤勉之证】，5 项领【圆满之证】。</div>' +
          '</div></div>' +
      '</div>' +

      '<div class="grid g2 mt16">' +
        /* --- 档案 --- */
        '<div class="card"><div class="card-h"><h3>御兽师档案</h3></div><div class="card-b">' +
          K.kv('称号', K.esc(pl.title)) +
          K.kv('等级 / 经验', 'Lv.' + pl.level + ' · ' + K.fmt(pl.exp)) +
          K.kv('拥有灵兽', save.pets.length + ' 只') +
          K.kv('冒险进度', '第 ' + save.world.stageProgress + ' 关') +
          K.kv('试炼塔最高', '第 ' + tower.best + ' 层') +
          K.kv('家族', fam ? K.esc(fam.badge + ' ' + fam.name) + ' Lv.' + fam.level : '未加入') +
          K.kv('胜 / 负', pl.stats.battlesWon + ' / ' + pl.stats.battlesLost) +
          K.kv('联盟 BOSS 累计伤害', K.fmt(pl.stats.raidDamage)) +
          '<div class="row-flex mt12">' +
          '<button class="btn primary' + (signedIn ? '' : '') + '" data-act="signin"' + (signedIn ? ' disabled' : '') + '>' + (signedIn ? '今日已签到' : '📅 每日签到') + '</button>' +
          '<button class="btn" data-act="nav" data-v="shop">🛒 商店</button>' +
          '<button class="btn ghost" data-act="reset">重置存档</button>' +
          '</div>' +
        '</div></div>' +

        /* --- 动向 --- */
        '<div class="card"><div class="card-h"><h3>动向</h3><span class="sub">最近 12 条</span></div>' +
          '<div class="card-b" style="max-height:330px;overflow:auto">' +
          (save.world.log.length ? save.world.log.slice(0, 12).map(function (l) {
            return '<div class="log-line"><span class="hint">' + new Date(l.t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</span><span>' + K.esc(l.text) + '</span></div>';
          }).join('') : K.empty('📜', '暂无记录')) +
          '</div></div>' +
      '</div>' +

      /* --- 图鉴速览 --- */
      '<div class="card mt16"><div class="card-h"><h3>灵兽图鉴</h3><span class="sub">三大基础灵兽 · 属性互补</span>' +
        '<div class="spacer"></div><button class="btn sm" data-act="petTab" data-v="codex">完整图鉴</button></div>' +
        '<div class="card-b"><div class="grid g3">' + D.SPECIES.map(speciesCard).join('') + '</div></div></div>' +
      '</div>';
  };

  function dailyRow(t) {
    var pctv = K.clamp(t.current / t.def.need, 0, 1) * 100;
    return '<div class="daily-row' + (t.done ? ' done' : '') + '">' +
      '<span class="dr-ico">' + t.def.emoji + '</span>' +
      '<span class="dr-body"><b>' + K.esc(t.def.name) + '</b><small>' + K.esc(t.def.desc) + ' · ' + t.current + '/' + t.def.need + '</small>' +
      '<div class="bar thin" style="margin-top:5px"><i style="width:' + pctv + '%"></i></div></span>' +
      (t.claimed ? '<span class="tag jade">已领取</span>'
        : t.done ? '<button class="btn sm primary" data-act="dailyClaim" data-id="' + t.def.id + '">领取</button>'
          : '<span class="tag">进行中</span>') +
      '</div>';
  }

  function speciesCard(sp) {
    var owned = S.getSave().pets.filter(function (p) { return p.speciesId === sp.id; });
    var best = owned.slice().sort(function (a, b) { return S.powerOf(b) - S.powerOf(a); })[0];
    return '<div class="codex-card">' +
      '<div class="cc-art" style="--tone:' + tone(sp) + ';--glow:' + glow(sp) + '">' + sp.emoji + '</div>' +
      '<div class="cc-body">' +
      '<div class="row-flex"><b style="font-size:15px">' + sp.name + '</b>' +
      '<span class="tag" style="background:' + sp.elementColor + '22;color:' + sp.elementColor + ';border-color:' + sp.elementColor + '44">' + sp.element + '</span>' +
      K.tag(sp.rarity, sp.rarity === 'SSR' ? 'gold' : sp.rarity === 'SR' ? 'blue' : '') +
      K.tag(sp.role, 'jade') + '</div>' +
      '<div class="hint mt8">' + K.esc(sp.intro) + '</div>' +
      '<div class="divider" style="margin:10px 0"></div>' +
      K.kv('已拥有', owned.length + ' 只') +
      K.kv('最强个体', best ? 'Lv.' + best.level + ' / 战力 ' + K.fmt(S.powerOf(best)) : '—') +
      '<div class="hint mt8">⭐ 优势：' + sp.strengths.join('・') + '</div>' +
      '<div class="hint" style="color:var(--cinnabar)">⚠️ 弱点：' + sp.weakness + '</div>' +
      '</div></div>';
  }

  /* =====================================================================
   * 灵兽
   * =================================================================== */
  U.views.pets = function (st) {
    var tabs = [
      ['mine', '我的灵兽'],
      ['bond', '☯️ 羁绊'],
      ['breed', '🥚 繁育'],
      ['codex', '图鉴'],
      ['gacha', '召唤']
    ];
    var body =
      st.petTab === 'mine' ? tabMine() :
      st.petTab === 'bond' ? tabBond() :
      st.petTab === 'breed' ? tabBreed() :
      st.petTab === 'codex' ? tabCodex() : tabGacha();

    return '<div class="page">' +
      '<div class="page-head"><h1>灵兽</h1><p>获取 · 培养 · 进化 · 羁绊 · 繁育</p>' +
      '<div class="spacer"></div><span class="hint">当前编队战力 ' + K.fmt(S.teamPower()) + '</span></div>' +
      '<div class="tabs">' + tabs.map(function (t) {
        return '<button class="tab' + (st.petTab === t[0] ? ' active' : '') + '" data-act="petTab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' + body + '</div>';
  };

  function tabMine() {
    var save = S.getSave();
    if (!save.pets.length) return '<div class="card">' + K.empty('🥚', '还没有灵兽，去召唤一只吧', '<button class="btn primary" data-act="petTab" data-v="gacha">前往召唤</button>') + '</div>';
    var sorted = save.pets.slice().sort(function (a, b) { return S.powerOf(b) - S.powerOf(a); });
    return '<div class="card"><div class="card-h"><h3>我的灵兽</h3>' +
      '<span class="sub">共 ' + save.pets.length + ' 只 · 上阵 ' + save.team.length + '/3</span><div class="spacer"></div>' +
      '<span class="hint">点击卡片查看详情与培养</span></div><div class="card-b">' +
      '<div class="pet-grid">' + sorted.map(petCard).join('') + '</div></div></div>';
  }

  function petCard(pet) {
    var sp = D.getSpecies(pet.speciesId), rar = D.RARITY[sp.rarity];
    var inTeam = S.getSave().team.indexOf(pet.uid) >= 0;
    return '<div class="pet-card' + (inTeam ? ' in-team' : '') + '" data-act="petOpen" data-uid="' + pet.uid + '">' +
      K.petThumb(pet) +
      '<div class="pet-meta">' +
      '<div class="nm">' + K.esc(pet.nickname) + K.tag(sp.role, 'jade') + '</div>' +
      '<div class="rl">' + D.getStage(pet.level).name + '期 · 亲密度 ' + pet.intimacy + '</div>' +
      '<div class="pw">⚔️ ' + K.fmt(S.powerOf(pet)) + '</div>' +
      (inTeam ? '<div class="hint" style="color:var(--jade)">出战中</div>' : '') +
      '</div></div>';
  }

  /* ---------------------------- 羁绊（新增玩法） ---------------------------- */
  function tabBond() {
    var save = S.getSave();
    var team = save.team.map(function (u) { return S.findPet(save, u); }).filter(Boolean);
    var info = {
      bonds: S.activeBonds(team),
      effects: S.teamBondEffects(null, team),
      activeCount: 0
    };
    info.activeCount = info.bonds.filter(function (b) { return b.active; }).length;
    var eff = info.effects;

    var effChips = [];
    var labelMap = { hp: '生命', atk: '攻击', def: '防御', spd: '速度', crit: '暴击率', critDmg: '暴击伤害', damageReduce: '伤害减免', healBonus: '治疗效果', selfDamageTaken: '承受伤害' };
    Object.keys(labelMap).forEach(function (k) {
      if (!eff[k]) return;
      var neg = (k === 'selfDamageTaken');
      effChips.push('<span class="tag ' + (neg ? 'red' : 'gold') + '">' + labelMap[k] + ' ' + (neg ? '+' : '+') + K.pct(eff[k]) + '</span>');
    });
    if (!effChips.length) effChips.push('<span class="hint">当前没有激活任何羁绊，试试下方的一键推荐编队。</span>');

    return '<div class="g-split">' +

      '<div class="card"><div class="card-h"><h3>☯️ 羁绊图录</h3>' +
      '<span class="sub">已激活 ' + info.activeCount + ' / ' + info.bonds.length + ' 组</span></div><div class="card-b">' +
      info.bonds.map(function (b) {
        var bd = b.def;
        var tags = Object.keys(bd.effects).map(function (k) {
          return '<span class="tag ' + (k === 'selfDamageTaken' ? 'red' : 'jade') + '">' + (labelMap[k] || k) + ' ' + K.pct(bd.effects[k]) + '</span>';
        }).join('');
        return '<div class="bond-card' + (b.active ? ' active' : '') + '" style="--bond:' + bd.color + '">' +
          '<div class="bc-head">' +
          '<span class="bc-emoji">' + bd.emoji + '</span>' +
          '<div style="flex:1;min-width:0"><div class="row-flex"><b>' + bd.name + '</b>' +
          K.tag(bd.grade, bd.grade === 'UR' ? 'purple' : bd.grade === 'SSR' ? 'gold' : 'blue') +
          (b.active ? '<span class="tag jade">已激活</span>' : '<span class="tag">未激活</span>') + '</div>' +
          '<div class="hint mt8">' + K.esc(bd.desc) + '</div>' +
          '<div class="row-flex mt8">' + tags + '</div>' +
          (b.hint ? '<div class="hint mt8" style="color:var(--cinnabar)">' + K.esc(b.hint) + '</div>' : '') +
          '</div>' +
          /* 成员图腾 */
          '<div class="bc-members">' + (bd.members || []).map(function (m) {
            var sp = D.getSpecies(m);
            var has = team.some(function (p) { return p.speciesId === m; });
            return '<span class="bc-m' + (has ? ' has' : '') + '" title="' + sp.name + '">' + sp.emoji + '</span>';
          }).join('') + (bd.sameSpecies ? '<span class="bc-m has">♊</span>' : '') + '</div>' +
          '</div></div>';
      }).join('') +
      '</div></div>' +

      '<div>' +
      '<div class="card"><div class="card-h"><h3>当前队伍</h3><span class="sub">' + team.length + '/3</span></div><div class="card-b tight">' +
      (team.length ? team.map(function (p) {
        var sp = D.getSpecies(p.speciesId);
        return '<div class="member-row"><span style="font-size:22px">' + sp.emoji + '</span>' +
          '<span class="nm">' + K.esc(p.nickname) + '</span>' +
          '<span class="right"><span>Lv.' + p.level + '</span><span>' + K.fmt(S.powerOf(p)) + '</span></span></div>';
      }).join('') : K.empty('🕳️', '尚未编队')) +
      '<div class="row-flex mt8" style="padding:0 4px 6px">' +
      '<button class="btn primary block" data-act="bondRecommend">✨ 一键推荐编队</button>' +
      '<button class="btn block" data-act="nav" data-v="pets">手动调整</button>' +
      '</div>' +
      '</div></div>' +

      '<div class="card"><div class="card-h"><h3>羁绊总加成</h3><span class="sub">实时生效于战斗</span></div><div class="card-b">' +
      '<div class="row-flex">' + effChips.join('') + '</div>' +
      '<div class="hint mt12">羁绊加成同时计入<b>面板属性</b>与<b>战力排行榜</b>；<br>双方战斗时，只有出战方享受己方羁绊。</div>' +
      '<div class="divider"></div>' +
      '<div class="hint">💡 策略提示：<br>· 【三才阵】+【三兽同心】可同时激活，收益最高；<br>· 【金木相克】爆发最强但有反噬代价，适合速攻流；<br>· 双同种灵兽触发【双生同源】，适合单体突破。</div>' +
      '</div></div>' +
      '</div></div>';
  }

  /* ---------------------------- 繁育（新增玩法） ---------------------------- */
  function tabBreed() {
    var save = S.getSave();
    var info = S.breedInfo();
    var B = info.def;
    var sel = (U._breedSel = U._breedSel || []);
    var eligible = save.pets.filter(function (p) { return p.level >= B.minLevel; });

    var selPets = sel.map(function (uid) { return S.findPet(save, uid); }).filter(Boolean);
    var preview = '';
    if (selPets.length === 2) {
      var avg = (selPets[0].star + selPets[1].star) / 2;
      preview = '<div class="breed-preview">' +
        '<div class="bp-slot">' + D.getSpecies(selPets[0].speciesId).emoji + '<small>' + K.esc(selPets[0].nickname) + '</small></div>' +
        '<div class="bp-plus">＋</div>' +
        '<div class="bp-slot">' + D.getSpecies(selPets[1].speciesId).emoji + '<small>' + K.esc(selPets[1].nickname) + '</small></div>' +
        '<div class="bp-arrow">➜</div>' +
        '<div class="bp-slot result">🥚<small>待孵化</small></div>' +
        '<div class="bp-detail">' +
        K.kv('预计星级', '★' + Math.max(1, Math.floor(avg)) + ' ~ ★' + Math.min(D.RARITY[D.getSpecies(selPets[0].speciesId).rarity].starCap, Math.floor(avg) + 1)) +
        K.kv('物种概率', '各 42% 继承双亲 · 16% 基因突变') +
        K.kv('子代等级', 'Lv.' + B.childLevel + ' 起') +
        K.kv('天赋点数', '随双亲等级提升（当前上限约 ' + Math.min(18, Math.floor((selPets[0].level + selPets[1].level) / 12)) + ' 点）') +
        '</div></div>';
    }

    return '<div class="g-side340">' +

      '<div class="card"><div class="card-h"><h3>🥚 选择双亲</h3>' +
      '<span class="sub">需 Lv.' + B.minLevel + ' 以上 · 已选 ' + sel.length + '/2</span><div class="spacer"></div>' +
      (sel.length ? '<button class="btn sm ghost" data-act="breedClear">清空</button>' : '') +
      '</div><div class="card-b">' +
      (eligible.length < 2
        ? K.empty('🕳️', '至少需要 2 只 Lv.' + B.minLevel + ' 以上的灵兽才能繁育', '<button class="btn primary" data-act="nav" data-v="pets">去培养灵兽</button>')
        : '<div class="pet-grid">' + eligible.map(function (p) {
          var sp = D.getSpecies(p.speciesId);
          var on = sel.indexOf(p.uid) >= 0;
          return '<div class="pet-card' + (on ? ' sel' : '') + '" data-act="breedPick" data-uid="' + p.uid + '">' +
            K.petThumb(p) +
            '<div class="pet-meta"><div class="nm">' + K.esc(p.nickname) + '</div>' +
            '<div class="rl">' + D.getStage(p.level).name + ' · 亲密度 ' + p.intimacy + '</div>' +
            '<div class="pw">' + (on ? '✅ 已选中' : '⚔️ ' + K.fmt(S.powerOf(p))) + '</div></div></div>';
        }).join('') + '</div>') +
      '</div></div>' +

      '<div>' +
      '<div class="card"><div class="card-h"><h3>繁育台</h3></div><div class="card-b">' +
      (preview || K.empty('🧬', '请在上方选择两只灵兽')) +
      '<div class="divider"></div>' +
      K.kv('今日免费次数', info.free + ' / ' + info.dailyFree) +
      K.kv('超出后消耗', info.cost + ' 灵玉 / 次') +
      K.kv('累计繁育', info.total + ' 次') +
      '<button class="btn ' + (sel.length === 2 ? 'primary' : '') + ' block mt12" data-act="breedDo"' + (sel.length === 2 ? '' : ' disabled') + '>🧬 开始孵化</button>' +
      '<div class="hint mt12">' + K.esc(B.lore) + '</div>' +
      '<div class="hint mt8">※ 双亲不会消失，但各自亲密度 -10。</div>' +
      '</div></div>' +
      '</div></div>';
  }

  /* ---------------------------- 图鉴 ---------------------------- */
  function tabCodex() {
    return '<div class="card"><div class="card-h"><h3>灵兽图鉴</h3><span class="sub">完整数据与技能说明</span></div><div class="card-b">' +
      D.SPECIES.map(function (sp) {
        var b = sp.base;
        return '<div class="codex-full">' +
          '<div class="row-flex" style="align-items:flex-start;gap:16px">' +
          '<div class="cf-art" style="--tone:' + tone(sp) + ';--glow:' + glow(sp) + '">' + sp.emoji + '</div>' +
          '<div style="flex:1;min-width:240px">' +
          '<div class="row-flex"><b class="cf-name">' + sp.name + '</b>' + K.tag(sp.title, '') + K.tag(sp.role, 'jade') +
          '<span class="tag" style="background:' + sp.elementColor + '22;color:' + sp.elementColor + '">' + sp.element + '元素</span>' +
          K.tag(sp.rarity + ' ' + D.RARITY[sp.rarity].name, sp.rarity === 'SSR' ? 'gold' : 'blue') + '</div>' +
          '<div class="hint mt8">' + K.esc(sp.intro) + '</div>' +
          '<div class="mt12 stat-grid">' +
          statCell('生命', b.hp) + statCell('攻击', b.atk) + statCell('防御', b.def) + statCell('速度', b.spd) +
          statCell('暴击', K.pct(b.crit)) + statCell('暴伤', '+' + K.pct(b.critDmg)) + statCell('闪避', K.pct(b.dodge)) +
          '</div></div></div>' +
          '<div class="divider"></div>' +
          '<div class="row-flex"><span class="hint" style="flex:0 0 68px">获取途径</span>' + sp.obtain.map(function (o) { return K.tag(K.esc(o)); }).join('') + '</div>' +
          '<div class="row-flex mt8"><span class="hint" style="flex:0 0 68px">技能组</span>' + sp.skills.map(function (sid) {
            var k = D.getSkill(sid);
            return K.tag(k.icon + ' ' + k.name, k.type === 'ultimate' ? 'gold' : k.type === 'passive' ? 'purple' : 'jade');
          }).join('') + '</div>' +
          '<div class="skill-detail mt12">' + sp.skills.map(function (sid) {
            var k = D.getSkill(sid);
            var kn = { normal: '普通攻击', active: '主动技能', ultimate: '终极技能', passive: '被动技能' }[k.type];
            return '<div class="skill-item ' + k.type + '"><div class="si">' + k.icon + '</div><div class="sb">' +
              '<div class="st"><b>' + k.name + '</b>' + K.tag(kn, k.type === 'ultimate' ? 'gold' : k.type === 'passive' ? 'purple' : 'jade') +
              (k.cost ? K.tag('怒气 ' + k.cost) : '') + (k.cd ? K.tag('CD ' + k.cd) : '') + '</div>' +
              '<div class="sd">' + k.desc + '</div></div></div>';
          }).join('') + '</div>' +
          '<div class="hint mt8">⭐ 优势：' + sp.strengths.join('・') + '　⚠️ 弱点：' + sp.weakness + '</div>' +
          '</div>';
      }).join('') + '</div></div>';
  }
  function statCell(k, v) {
    return '<div class="stat-cell"><div class="hint">' + k + '</div><div class="sv">' + v + '</div></div>';
  }

  /* ---------------------------- 召唤 ---------------------------- */
  function tabGacha() {
    var pl = S.getSave().player;
    var pity = D.GACHA.pity - pl.pityCounter;
    return '<div class="grid g2">' +
      '<div class="card"><div class="card-h"><h3>灵兽召唤</h3><span class="sub">消耗灵玉获取灵兽</span></div><div class="card-b">' +
      '<div style="text-align:center;padding:20px 0">' +
      '<div class="gacha-orb">🔮</div>' +
      '<div class="hint mt12">距保底【白虎】还需 <b style="color:var(--gold);font-size:16px">' + pity + '</b> 次</div>' +
      '<div class="bar gold thin mt12" style="max-width:280px;margin:10px auto 0"><i style="width:' + (pl.pityCounter / D.GACHA.pity * 100) + '%"></i></div>' +
      '<div class="hint mt8">累计召唤 ' + pl.totalGacha + ' 次</div>' +
      '</div>' +
      '<div class="row-flex" style="justify-content:center">' +
      '<button class="btn primary lg" data-act="gacha" data-n="1">单抽 · ' + D.GACHA.singleCost.gem + ' 💎</button>' +
      '<button class="btn gold lg" data-act="gacha" data-n="10">十连 · ' + D.GACHA.tenCost.gem + ' 💎</button>' +
      '</div>' +
      '<div class="hint mt16">十连保底至少 1 只 SR 及以上；重复灵兽自动转化为 ' + D.GACHA.dupShard + ' 片兽魂碎片。</div>' +
      '</div></div>' +
      '<div class="card"><div class="card-h"><h3>概率公示</h3><span class="sub">合规要求</span></div><div class="card-b">' +
      D.SPECIES.map(function (sp) {
        var rate = 0;
        D.GACHA.pool.forEach(function (x) { if (x.speciesId === sp.id) rate += x.rate; });
        return K.kv(sp.emoji + ' ' + sp.name + ' ' + K.tag(sp.rarity, sp.rarity === 'SSR' ? 'gold' : 'blue'), (rate * 100).toFixed(2) + '%');
      }).join('') +
      '<div class="hint mt12">保底机制：连续 ' + D.GACHA.pity + ' 次未获得 SSR 时，第 ' + D.GACHA.pity + ' 次必出【白虎】。获得 SSR 后计数重置。</div>' +
      '</div></div></div>';
  }
})(typeof window !== 'undefined' ? window : globalThis);
