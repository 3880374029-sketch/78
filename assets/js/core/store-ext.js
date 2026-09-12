/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 扩展玩法逻辑层（v2 增量）
 * ---------------------------------------------------------------------
 * 采用「装饰器」方式扩展 Store，不改写任何既有函数体：
 *   - 只包装（wrap）需要联动的方法（升级/战斗/捐献/签到）
 *   - 只新增新的命名空间（羁绊 / 试炼塔 / 繁育 / 每日委托）
 * 因此对 v1 存档与 v1 玩法 100% 兼容。
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var S = Q.Store, D = Q.DATA;

  /* =====================================================================
   * A. 灵兽羁绊
   * =================================================================== */

  /**
   * 计算当前出战队伍的羁绊聚合效果
   * @param  {Object|null} family 家族（用于复用缓存，可空）
   * @param  {Array} teamPets     指定队伍，默认取当前出战队伍
   * @return {Object} { hp, atk, def, spd, crit, critDmg, damageReduce, healBonus, selfDamageTaken }
   */
  S.teamBondEffects = function (family, teamPets) {
    var save = S.getSave();
    var pets = teamPets;
    if (!pets) {
      pets = (save.team || []).map(function (u) { return S.findPet(save, u); }).filter(Boolean);
    }
    var effects = {};
    var add = function (k, v) { effects[k] = (effects[k] || 0) + v; };

    S.activeBonds(pets).forEach(function (b) {
      if (!b.active) return;
      Object.keys(b.def.effects).forEach(function (k) { add(k, b.def.effects[k]); });
    });
    return effects;
  };

  /**
   * 列出全部羁绊及激活状态
   * @param {Array} pets 队伍
   * @return [{ def, active, matched: [speciesId], progress: 0..1, hint }]
   */
  S.activeBonds = function (pets) {
    var save = S.getSave();
    if (!pets) pets = (save.team || []).map(function (u) { return S.findPet(save, u); }).filter(Boolean);
    var speciesInTeam = pets.map(function (p) { return p.speciesId; });
    var distinct = speciesInTeam.filter(function (v, i, a) { return a.indexOf(v) === i; });

    return D.BONDS.map(function (bond) {
      var active = false, matched = [], hint = '';

      if (bond.sameSpecies) {
        // 同源双生：队内同种灵兽 ≥ N 只
        var counts = {};
        speciesInTeam.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
        var hit = Object.keys(counts).filter(function (k) { return counts[k] >= (bond.sameCount || 2); });
        active = hit.length > 0;
        matched = hit;
        if (!active) hint = '需要队内出现 2 只同种灵兽（当前最多 ' + (Math.max.apply(null, [0].concat(Object.keys(counts).map(function (k) { return counts[k]; }))) || 0) + ' 只）';
      } else if (bond.requireDistinct && bond.requireCount) {
        // 三兽同心：三系齐备且互不重复
        var need = bond.members;
        var has = need.filter(function (m) { return speciesInTeam.indexOf(m) >= 0; });
        active = has.length >= bond.requireCount && distinct.length === speciesInTeam.length && speciesInTeam.length >= bond.requireCount;
        matched = has;
        if (!active) hint = '需要上阵 ' + bond.requireCount + ' 只灵兽且物种各不相同（当前 ' + speciesInTeam.length + ' 只 / ' + distinct.length + ' 种）';
      } else {
        var has2 = bond.members.filter(function (m) { return speciesInTeam.indexOf(m) >= 0; });
        active = has2.length === bond.members.length;
        matched = has2;
        if (!active) {
          var missing = bond.members.filter(function (m) { return speciesInTeam.indexOf(m) < 0; })
            .map(function (m) { return D.getSpecies(m).name; });
          hint = '还缺：' + missing.join('、');
        }
      }

      return {
        def: bond, active: active, matched: matched,
        progress: bond.requireAll || bond.members ? Math.min(1, matched.length / (bond.members ? bond.members.length : 1)) : (active ? 1 : 0),
        hint: hint
      };
    });
  };

  /** 依据已拥有的灵兽，推荐一套能激活最多羁绊的编队 */
  S.recommendTeam = function () {
    var save = S.getSave();
    if (save.pets.length <= 3) return save.pets.map(function (p) { return p.uid; });
    var best = null, bestScore = -1;
    // 每种物种取战力最高的一只作为候选
    var bySpecies = {};
    save.pets.forEach(function (p) {
      if (!bySpecies[p.speciesId] || S.powerOf(p) > S.powerOf(bySpecies[p.speciesId])) bySpecies[p.speciesId] = p;
    });
    var pool = Object.keys(bySpecies).map(function (k) { return bySpecies[k]; });
    // 组合枚举（物种数 ≤ 3，规模很小）
    function combine(arr, k) {
      var out = [];
      (function go(start, cur) {
        if (cur.length === k) { out.push(cur.slice()); return; }
        for (var i = start; i < arr.length; i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); }
      })(0, []);
      return out;
    }
    var size = Math.min(3, Math.max(1, pool.length));
    // 凑不满 3 只时用战力最高的补齐
    var teamSizes = [];
    for (var sz = size; sz >= 1; sz--) teamSizes.push(sz);
    teamSizes.forEach(function (sz) {
      combine(pool, sz).forEach(function (combo) {
        var extra = save.pets.filter(function (p) { return combo.indexOf(p) < 0; })
          .sort(function (a, b) { return S.powerOf(b) - S.powerOf(a); }).slice(0, 3 - sz);
        var team = combo.concat(extra);
        if (!team.length) return;
        var eff = S.teamBondEffects(null, team);
        var score = S.activeBonds(team).filter(function (b) { return b.active; }).length * 1000;
        score += (eff.atk || 0) * 2000 + (eff.hp || 0) * 1500 + (eff.crit || 0) * 1200 + (eff.critDmg || 0) * 800 + (eff.damageReduce || 0) * 1200;
        score += team.reduce(function (a, p) { return a + S.powerOf(p); }, 0) / 1000;
        if (score > bestScore) { bestScore = score; best = team; }
      });
    });
    return (best || pool.slice(0, 3)).map(function (p) { return p.uid; });
  };

  /* --- 用羁绊效果增强属性计算（不修改原函数，仅包装） --- */
  var _computeStats = S.computeStats;
  S.computeStats = function (pet, opts) {
    opts = opts || {};
    var s = _computeStats.call(S, pet, opts);
    var be = opts.bonds;
    if (be === undefined) {
      // 羁绊只作用于「出战队伍内的灵兽」，替补席灵兽不吃羁绊加成
      var cur = S.getSave();
      var inTeam = (cur.team || []).indexOf(pet.uid) >= 0;
      be = inTeam ? S.teamBondEffects(opts.family) : {};
    }
    if (be && Object.keys(be).length) {
      if (be.hp) s.hp = Math.round(s.hp * (1 + be.hp));
      if (be.atk) s.atk = Math.round(s.atk * (1 + be.atk));
      if (be.def) s.def = Math.round(s.def * (1 + be.def));
      if (be.spd) s.spd = Math.round(s.spd * (1 + be.spd));
      if (be.crit) s.crit = Math.min(D.FORMULA.critCap, s.crit + be.crit);
      if (be.critDmg) s.critDmg += be.critDmg;
      if (be.damageReduce) s.damageReduce += be.damageReduce;
      if (be.healBonus) s.healBonus += be.healBonus;
      if (be.selfDamageTaken) s.damageReduce -= be.selfDamageTaken;   // 负面代价
      s.damageReduce = Math.max(-0.5, Math.min(0.75, s.damageReduce));
    }
    s.bondEffects = be || {};
    return s;
  };
  // 同步包装战力计算，使羁绊加成体现在战力与排行榜
  var _powerOf = S.powerOf;
  S.powerOf = function (pet, fam) {
    // 利用 computeStats 内的默认羁绊逻辑：直接重新计算一次更准确
    var s = S.computeStats(pet, { family: fam });
    return Math.round(s.hp * 0.3 + s.atk * 3.0 + s.def * 2.0 + s.spd * 1.2 + s.crit * 800 + s.critDmg * 300 + s.dodge * 500);
  };
  var _teamPower = S.teamPower;
  S.teamPower = function (save) {
    save = save || S.getSave();
    var fam = S.getFamily(save);
    var pets = (save.team || []).map(function (u) { return S.findPet(save, u); }).filter(Boolean);
    var be = S.teamBondEffects(fam, pets);
    var total = 0;
    pets.forEach(function (p) { total += S.powerOf(p, fam); });
    return total;
  };

  /* =====================================================================
   * B. 神兽试炼塔
   * =================================================================== */
  function towerState() {
    var save = S.getSave();
    if (!save.world.tower) {
      save.world.tower = { floor: 1, best: 1, used: 0, extra: 0, date: S.today(), history: [] };
    }
    var t = save.world.tower;
    if (t.date !== S.today()) { t.date = S.today(); t.used = 0; t.extra = 0; }
    return t;
  }

  S.towerInfo = function () {
    var t = towerState();
    var T = D.TOWER;
    return {
      def: T,
      floor: t.floor,
      best: t.best,
      used: t.used,
      extra: t.extra,
      remaining: Math.max(0, T.dailyAttempts + t.extra - t.used),
      dailyAttempts: T.dailyAttempts,
      maxFloor: T.maxFloor,
      cleared: t.floor - 1,
      nextReward: T.reward(t.floor),
      isBoss: t.floor % T.bossEvery === 0,
      history: t.history.slice(0, 10)
    };
  };

  S.makeTowerEnemies = function (floor) {
    var T = D.TOWER;
    var count = floor >= 10 ? T.enemyCountMax : T.enemyCountBase;
    var lvl = Math.round(T.enemyLevelBase + floor * T.enemyLevelPerFloor);
    var boss = floor % T.bossEvery === 0;
    var pool = ['white_tiger', 'yellow_ox', 'dawn_chicken'];
    var out = [];
    for (var i = 0; i < count; i++) {
      var spId = pool[(i + floor) % 3];
      var pet = S.makePet(spId, Math.min(60, lvl + (boss ? 3 : 0)), Math.min(5, 1 + Math.floor(floor / 12)));
      if (boss) { pet.nickname = '塔灵·' + D.getSpecies(spId).name; pet.boss = true; }
      else pet.nickname = '试炼傀儡·' + D.getSpecies(spId).name;
      if (boss) { pet.bossMul = T.bossStatMul; }
      out.push(pet);
    }
    return out;
  };

  S.consumeTowerAttempt = function () {
    var t = towerState();
    if (t.used >= D.TOWER.dailyAttempts + t.extra) throw new Error('今日挑战次数已用完');
    t.used++;
    return t;
  };
  S.buyTowerAttempt = function () {
    var t = towerState();
    if (!S.pay(D.TOWER.extraAttemptCost)) throw new Error('灵玉不足，需要 ' + D.TOWER.extraAttemptCost.gem);
    t.extra++;
    S.save();
    return t;
  };

  S.finishTower = function (floor, result) {
    var t = towerState();
    var rewards = [], firstClear = false;
    t.history.unshift({ floor: floor, win: result.win, at: Date.now() });
    if (t.history.length > 30) t.history.length = 30;

    if (result.win) {
      var r = D.TOWER.reward(floor);
      if (floor >= t.best) { firstClear = true; Object.keys(D.TOWER.firstClearBonus).forEach(function (k) { r[k] = (r[k] || 0) + D.TOWER.firstClearBonus[k]; }); }
      rewards = S.gain(r);
      var save = S.getSave();
      save.team.forEach(function (u) { var p = S.findPet(save, u); if (p) S.addExp(p, 300 + floor * 90); });
      save.player.stats.towerBest = Math.max(save.player.stats.towerBest || 0, floor);
      if (floor >= t.best) { t.best = floor + 1; }
      if (floor >= t.floor) t.floor = Math.min(D.TOWER.maxFloor, floor + 1);
      S.log('试炼塔第 ' + floor + ' 层通关' + (firstClear ? '（首通）' : ''));
      dailyTick('tower', 1);
      S.save();
    } else {
      S.log('试炼塔第 ' + floor + ' 层挑战失败');
      S.save();
    }
    return { rewards: rewards, firstClear: firstClear, win: result.win, nextFloor: t.floor };
  };

  /* =====================================================================
   * C. 灵兽繁育
   * =================================================================== */
  function breedState() {
    var save = S.getSave();
    if (!save.world.breed) save.world.breed = { used: 0, date: S.today(), count: 0 };
    var b = save.world.breed;
    if (b.date !== S.today()) { b.date = S.today(); b.used = 0; }
    return b;
  }
  S.breedInfo = function () {
    var b = breedState(), B = D.BREED;
    return {
      def: B, used: b.used, free: Math.max(0, B.dailyFreeTimes - b.used),
      dailyFree: B.dailyFreeTimes, cost: B.costGem, total: b.count || 0
    };
  };

  S.breed = function (uidA, uidB) {
    var save = S.getSave();
    var B = D.BREED;
    if (uidA === uidB) throw new Error('不能选择同一只灵兽');
    var a = S.findPet(save, uidA), b = S.findPet(save, uidB);
    if (!a || !b) throw new Error('灵兽不存在');
    if (a.level < B.minLevel || b.level < B.minLevel) throw new Error('双亲均需达到 Lv.' + B.minLevel);
    var st = breedState();
    if (st.used >= B.dailyFreeTimes) {
      if (!S.pay({ gem: B.costGem })) throw new Error('免费次数已用完，需 ' + B.costGem + ' 灵玉');
    }
    st.used++; st.count = (st.count || 0) + 1;

    // 物种继承
    var r = Math.random();
    var sid;
    if (r < B.speciesWeight.sameAsA) sid = a.speciesId;
    else if (r < B.speciesWeight.sameAsA + B.speciesWeight.sameAsB) sid = b.speciesId;
    else sid = B.mutatePool[Math.floor(Math.random() * B.mutatePool.length)];

    // 星级继承
    var avgStar = (a.star + b.star) / 2;
    var star = Math.max(1, Math.floor(avgStar));
    if (Math.random() < B.bonusStarChance) star++;
    var cap = D.RARITY[D.getSpecies(sid).rarity].starCap;
    star = Math.min(star, cap);

    var child = S.addPet(sid, B.childLevel, star);
    var talentTotal = B.talentRoll(a.level, b.level);
    // 随天赋点分配到四项
    for (var i = 0; i < talentTotal; i++) {
      var keys = ['hp', 'atk', 'def', 'spd'];
      child.talent[keys[Math.floor(Math.random() * 4)]]++;
    }
    child.heritage = { from: [a.nickname, b.nickname], species: [a.speciesId, b.speciesId], at: Date.now() };
    child.nickname = D.getSpecies(sid).name + '·' + (st.count);

    // 双亲消耗部分精力（降低亲密度但不消失，避免玩家痛点）
    a.intimacy = Math.max(0, a.intimacy - 10);
    b.intimacy = Math.max(0, b.intimacy - 10);

    S.log('灵兽繁育成功：' + a.nickname + ' × ' + b.nickname + ' → 【' + child.nickname + '】★' + star);
    S.save();
    return { child: child, talentTotal: talentTotal, star: star, species: D.getSpecies(sid) };
  };

  /* =====================================================================
   * D. 每日委托
   * =================================================================== */
  function dailyState() {
    var save = S.getSave();
    if (!save.quests.daily) save.quests.daily = { date: S.today(), progress: {}, claimed: {} };
    var d = save.quests.daily;
    if (d.date !== S.today()) { d.date = S.today(); d.progress = {}; d.claimed = {}; }
    return d;
  }
  function dailyTick(taskId, n) {
    var d = dailyState();
    d.progress[taskId] = (d.progress[taskId] || 0) + (n || 1);
    return d.progress[taskId];
  }
  S.dailyTick = dailyTick;

  S.dailyInfo = function () {
    var d = dailyState();
    var tasks = D.DAILY.tasks.map(function (t) {
      var cur = Math.min(t.need, d.progress[t.id] || 0);
      return { def: t, current: cur, done: cur >= t.need, claimed: !!d.claimed[t.id] };
    });
    var doneCount = tasks.filter(function (t) { return t.done; }).length;
    return {
      date: d.date,
      tasks: tasks,
      doneCount: doneCount,
      total: D.DAILY.tasks.length,
      milestones: D.DAILY.milestones.map(function (m, i) {
        return { def: m, index: i, reached: doneCount >= m.need, claimed: !!d.claimed['ms_' + i] };
      })
    };
  };

  S.claimDaily = function (taskId) {
    var d = dailyState();
    var t = null;
    D.DAILY.tasks.forEach(function (x) { if (x.id === taskId) t = x; });
    if (!t) throw new Error('未知委托');
    if (d.claimed[taskId]) throw new Error('该委托奖励已领取');
    if ((d.progress[taskId] || 0) < t.need) throw new Error('委托尚未完成');
    d.claimed[taskId] = true;
    var msgs = S.gain(t.reward);
    S.save();
    return msgs;
  };

  S.claimDailyMilestone = function (idx) {
    var d = dailyState();
    var info = S.dailyInfo();
    var m = info.milestones[idx];
    if (!m) throw new Error('未知里程碑');
    if (!m.reached) throw new Error('完成度不足（' + info.doneCount + '/' + m.def.need + '）');
    if (m.claimed) throw new Error('该里程碑奖励已领取');
    d.claimed['ms_' + idx] = true;
    var msgs = S.gain(m.def.reward);
    S.save();
    return msgs;
  };

  /* =====================================================================
   * E. 与既有玩法的联动：包装旧方法，让新系统自动计数
   * =================================================================== */
  var _levelUpPet = S.levelUpPet;
  S.levelUpPet = function (uid, times) {
    var r = _levelUpPet.call(S, uid, times);
    dailyTick('levelup', r.levels || 1);
    return r;
  };

  var _donate = S.donate;
  S.donate = function (amount) {
    var r = _donate.call(S, amount);
    dailyTick('donate', 1);
    return r;
  };

  var _finishPve = S.finishPve;
  S.finishPve = function (stage, result) {
    var r = _finishPve.call(S, stage, result);
    if (result.win) dailyTick('battle', 1);
    return r;
  };

  var _finishArena = S.finishArena;
  S.finishArena = function (result) {
    var r = _finishArena.call(S, result);
    if (result.win) dailyTick('battle', 1);
    return r;
  };

  var _finishFamilyWar = S.finishFamilyWar;
  S.finishFamilyWar = function (targetId, result) {
    var r = _finishFamilyWar.call(S, targetId, result);
    if (result.win) dailyTick('battle', 1);
    return r;
  };

  /* =====================================================================
   * F. 排行榜：新增「试炼塔榜」
   * =================================================================== */
  var _getLeaderboard = S.getLeaderboard;
  S.getLeaderboard = function (type) {
    if (type !== 'tower') return _getLeaderboard.call(S, type);
    var save = S.getSave();
    var rows = [];
    save.world.families.forEach(function (f) {
      f.members.forEach(function (m) {
        if (m.towerBest === undefined) {
          // 由名字与家族等级稳定派生，保证每次一致
          var h = 0, str = f.name + m.name;
          for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973;
          m.towerBest = Math.max(1, Math.min(D.TOWER.maxFloor, Math.round(f.level * 4.2 + (h % 23) - 6)));
        }
        rows.push({ name: m.name, family: f.name, familyId: f.id, value: m.towerBest, isMe: m.id === save.player.id });
      });
    });
    var fam = S.getFamily();
    var myBest = save.player.stats.towerBest || 0;
    if (!rows.some(function (r) { return r.isMe; })) {
      rows.push({ name: save.player.name, family: fam ? fam.name : '无', familyId: fam ? fam.id : null, value: myBest, isMe: true });
    } else {
      rows.forEach(function (r) { if (r.isMe) r.value = myBest; });
    }
    rows.sort(function (a, b) { return b.value - a.value; });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  };

  /* =====================================================================
   * G. 每日重置扩展（塔次数 / 繁育次数 / 商店限购）
   * =================================================================== */
  S.dailyExtCheck = function () {
    var save = S.getSave();
    var today = S.today();
    var changed = false;
    if (!save.world.tower) { save.world.tower = { floor: 1, best: 1, used: 0, extra: 0, date: today, history: [] }; changed = true; }
    if (save.world.tower.date !== today) { save.world.tower.date = today; save.world.tower.used = 0; save.world.tower.extra = 0; changed = true; }
    if (!save.world.breed) { save.world.breed = { used: 0, date: today, count: 0 }; changed = true; }
    if (save.world.breed.date !== today) { save.world.breed.date = today; save.world.breed.used = 0; changed = true; }
    if (!save.quests.daily || save.quests.daily.date !== today) {
      save.quests.daily = { date: today, progress: {}, claimed: {} }; changed = true;
    }
    if (save.inventory.shopDate !== today) { save.inventory.shopDate = today; save.inventory.shopBought = {}; changed = true; }
    if (changed) S.save();
    return changed;
  };
})(typeof window !== 'undefined' ? window : globalThis);
