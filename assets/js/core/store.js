/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 数据持久层 (Store)
 * ---------------------------------------------------------------------
 * 职责：
 *   1. 存档结构定义 / 版本迁移
 *   2. 全部游戏规则的唯一真源（宠物、家族、经济、任务、排行榜）
 *   3. 与后端 REST 接口一一对应，前端只通过 API 层调用
 * 存储：localStorage（演示）；生产替换为后端 PostgreSQL/SQLite，见 docs/
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var D = Q.DATA;
  var F = D.FORMULA;

  var KEY = 'qmhub_save_v' + D.SAVE_VERSION;
  var LEGACY_KEYS = ['qmhub_save_v1', 'qmhub_save_v2'];
  var RNG_SEED_KEY = 'qmhub_rng_seed';

  /* ---------------------------------------------------------------- 工具 */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function round(n) { return Math.round(n); }
  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------------------------------------------------------- 初始存档 */
  function newInventory() {
    return { gold: 8000, gem: 1500, contrib: 0, exp_pill: 5, break_stone: 3, soul_shard: 30, skill_book: 2, tender_grass: 5, revive_feather: 0 };
  }

  function blankSave(playerName) {
    return {
      version: D.SAVE_VERSION,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      player: {
        id: uid('u'),
        name: playerName || '无名御兽师',
        avatar: '🧙',
        level: 1,
        exp: 0,
        title: '初入青丘',
        createdAt: Date.now(),
        pityCounter: 0,
        totalGacha: 0,
        stats: { battlesWon: 0, battlesLost: 0, petsOwned: 0, familiesWarWon: 0, raidDamage: 0 }
      },
      pets: [],
      team: [],
      inventory: newInventory(),
      familyId: null,
      world: {
        families: [],
        boss: { hp: D.FAMILY.allianceBoss.maxHp, maxHp: D.FAMILY.allianceBoss.maxHp, season: 1, claimedTasks: [], participantDamage: 0 },
        stageProgress: 1,
        log: []
      },
      quests: { date: today(), items: {}, family: {} },
      settings: { battleSpeed: 1, autoUltimate: true, sound: false }
    };
  }

  /* ---------------------------------------------------------------- 宠物工厂 */
  function makePet(speciesId, level, star) {
    var sp = D.getSpecies(speciesId);
    if (!sp) throw new Error('未知灵兽: ' + speciesId);
    var lv = level || 1;
    return {
      uid: uid('p'),
      speciesId: speciesId,
      nickname: sp.name,
      level: lv,
      exp: 0,
      star: star || 1,
      intimacy: 0,
      breakCount: 0,
      skillLevels: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1 },
      talent: { hp: 0, atk: 0, def: 0, spd: 0 },   // 洗髓天赋加成点数（0-20）
      locked: false,
      createdAt: Date.now()
    };
  }

  /* ---------------------------------------------------------------- 属性计算（核心） */
  /**
   * 宠物最终属性 = 基础 × 等级成长 × 星级 × 进化阶段 × 亲密度 × 家族加成
   * 再叠加技能被动。
   */
  function computeStats(pet, opts) {
    opts = opts || {};
    var sp = D.getSpecies(pet.speciesId);
    var fam = opts.family !== undefined ? opts.family : getFamily();

    var lvMul = 1 + F.levelGrowth * (pet.level - 1);
    var starMul = 1 + F.starBonus * (pet.star - 1);
    var stageMul = D.getStage(pet.level).mul;
    var intiMul = 1 + F.intimacyBonus * pet.intimacy;
    var core = lvMul * starMul * stageMul * intiMul;

    // 家族等级 buff
    var fLevel = fam ? D.FAMILY.levelBuff(fam.level) : 1;
    // 家族科技 buff
    var tech = { atk: 1, hp: 1, spd: 1, gold: 1, def: 1 };
    if (fam && fam.techs) {
      D.FAMILY.techs.forEach(function (t) {
        var lv = fam.techs[t.id] || 0;
        if (!t.perLevel) return;
        Object.keys(t.perLevel).forEach(function (k) {
          var v = t.perLevel[k] * lv;
          if (tech[k] === undefined) tech[k] = 1;
          if (k === 'gold') tech[k] = 1 + v; else tech[k] = (tech[k] || 1) + v;
        });
      });
    }

    var s = {
      hp:  round(sp.base.hp * core * (sp.grow.hp || 1) * fLevel * tech.hp),
      atk: round(sp.base.atk * core * (sp.grow.atk || 1) * fLevel * tech.atk),
      def: round(sp.base.def * core * (sp.grow.def || 1) * fLevel * (tech.def || 1)),
      spd: round(sp.base.spd * core * (sp.grow.spd || 1) * fLevel * tech.spd),
      crit: sp.base.crit + 0.004 * (pet.star - 1),
      critDmg: sp.base.critDmg,
      dodge: sp.base.dodge,
      hit: sp.base.hit,
      healBonus: 0,
      damageReduce: 0,
      reflect: 0
    };

    // 技能等级对主动技能的伤害/治疗系数加成：每级 +6%
    pet.__skillMul = 1 + 0.06 * 0; // 占位，实际在 engine 中按技能等级计算

    // 叠加被动技能
    sp.skills.forEach(function (sid, idx) {
      var sk = D.getSkill(sid);
      if (!sk || !sk.passive) return;
      var p = sk.passive;
      var slv = pet.skillLevels[idx] || 1;
      var scale = 1 + 0.05 * (slv - 1);          // 被动随技能等级增强
      if (p.crit) s.crit += p.crit * scale;
      if (p.critDmg) s.critDmg += p.critDmg * scale;
      if (p.damageReduce) s.damageReduce += p.damageReduce * scale;
      if (p.healBonus) s.healBonus += p.healBonus * scale;
    });

    // 洗髓天赋
    s.hp += pet.talent.hp * 12;
    s.atk += pet.talent.atk * 4;
    s.def += pet.talent.def * 3;
    s.spd += pet.talent.spd * 2;

    s.crit = Math.min(s.crit, F.critCap);
    s.dodge = Math.min(s.dodge, F.dodgeCap);
    return s;
  }

  function powerOf(pet, fam) {
    var s = computeStats(pet, { family: fam });
    return round(s.hp * 0.3 + s.atk * 3.0 + s.def * 2.0 + s.spd * 1.2 + s.crit * 800 + s.critDmg * 300 + s.dodge * 500);
  }
  function teamPower(save) {
    var fam = getFamily(save);
    var p = 0;
    (save.team || []).forEach(function (u) {
      var pet = findPet(save, u); if (pet) p += powerOf(pet, fam);
    });
    return p;
  }

  function findPet(save, u) {
    for (var i = 0; i < save.pets.length; i++) if (save.pets[i].uid === u) return save.pets[i];
    return null;
  }

  /* ---------------------------------------------------------------- NPC 世界种子 */
  var NPC_NAMES = ['青丘阁', '焚天盟', '玄水殿', '听雪楼', '铁血堡', '万象宗', '逐月坊', '苍梧谷', '长歌门', '惊蛰会', '白玉京', '南柯殿'];
  var NPC_PLAYERS = ['墨白', '青鸾', '孤鸿', '子夜', '拾光', '南山', '溪云', '长庚', '枕月', '落尘', '天青', '砚台', '望舒', '惊蛰', '雪落', '听风', '归舟', '照夜', '碧落', '湛卢'];

  function seedWorld(save) {
    var world = save.world;
    world.families = [];
    // 生成 12 个 NPC 家族
    var shuffled = NPC_NAMES.slice().sort(function () { return Math.random() - 0.5; });
    for (var i = 0; i < 12; i++) {
      var lv = clamp(10 - i + Math.floor(rand(-1, 2)), 1, 10);
      var memCount = clamp(6 + lv * 2 + Math.floor(rand(0, 6)), 5, 40);
      var members = [];
      for (var m = 0; m < memCount; m++) {
        members.push({
          id: 'npc_' + i + '_' + m,
          name: shuffled[m % shuffled.length] + (m > 11 ? m : ''),
          position: m === 0 ? 'leader' : (m === 1 ? 'vice' : (m === 2 || m === 3 ? 'elder' : 'member')),
          contribution: round(rand(200, 6000)),
          power: round(rand(2200, 26000) * (1 + lv * 0.08)),
          active: m < memCount * 0.6
        });
      }
      members.sort(function (a, b) { return b.power - a.power; });
      var techs = { power: 0, tough: 0, swift: 0, fortune: 0 };
      var remain = lv * 4;
      while (remain > 0) { var k = pick(Object.keys(techs)); if (techs[k] < 10) { techs[k]++; remain--; } }
      world.families.push({
        id: uid('f'),
        name: shuffled[i],
        tag: shuffled[i].slice(0, 2),
        badge: pick(['🐉', '🔥', '🌊', '⚔️', '🌙', '⭐', '🏔️', '🌸']),
        level: lv,
        exp: round(D.familyExpToNext(lv) * rand(0.1, 0.9)),
        funds: round(rand(20000, 400000)),
        contribution: members.reduce(function (a, b) { return a + b.contribution; }, 0),
        notice: '欢迎加入' + shuffled[i] + '，团结一心，共赴山海。',
        npc: true,
        techs: techs,
        members: members,
        allies: [],
        warScore: round(rand(0, 240) * (lv / 8)),
        allyRequests: [],
        seasonWins: 0, seasonLosses: 0,
        createdAt: Date.now() - round(rand(30, 300)) * 86400000
      });
    }
    // NPC 之间预置若干联盟关系
    for (var a = 0; a < 4; a++) {
      var f1 = world.families[a * 2], f2 = world.families[a * 2 + 1];
      if (f1 && f2 && f1.id !== f2.id) { f1.allies = [f2.id]; f2.allies = [f1.id]; }
    }
  }

  /* ---------------------------------------------------------------- Store 主体 */
  var save = null;

  function getSave() { return save; }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) {
      // 旧版本存档迁移
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        try {
          var old = localStorage.getItem(LEGACY_KEYS[i]);
          if (old) { raw = migrate(JSON.parse(old)); break; }
        } catch (e) { /* ignore */ }
      }
    }
    if (raw && typeof raw === 'string') {
      try { save = JSON.parse(raw); } catch (e) { save = null; }
    } else if (raw && typeof raw === 'object') {
      save = raw;
    }
    if (!save || !save.version || save.version !== D.SAVE_VERSION) {
      save = blankSave();
      seedWorld(save);
      // 新号：三选一赠送黄牛（示例默认给黄牛 + 鸡）
      var starter = makePet('yellow_ox', 1, 1);
      var starter2 = makePet('dawn_chicken', 1, 1);
      save.pets.push(starter, starter2);
      save.team = [starter.uid, starter2.uid];
      save.player.stats.petsOwned = 2;
      persist();
    } else if (!save.world.families.length) {
      seedWorld(save);
    }
    dailyCheck();
    return save;
  }

  function migrate(old) {
    // 逐版本升级：v1 -> v2 -> v3（此处保留扩展位）
    var s = old;
    if (!s.version) s.version = 1;
    if (s.version < 2) { s.inventory = s.inventory || newInventory(); s.version = 2; }
    if (s.version < 3) { s.world = s.world || { families: [], boss: null, log: [] }; s.version = 3; }
    s.version = D.SAVE_VERSION;
    return s;
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { console.warn('[store] 存档失败', e); }
    Q.Store.emit('change');
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    save = null;
    load();
  }

  function dailyCheck() {
    var d = today();
    if (save.quests.date !== d) {
      save.quests = { date: d, items: {}, family: {} };
      save.world.log.unshift({ t: Date.now(), text: '新的一天开始了，日常任务已刷新。' });
      persist();
    }
  }

  /* ---------------------------------------------------------------- 经济 */
  function canPay(cost) {
    cost = cost || {};
    return Object.keys(cost).every(function (k) { return (save.inventory[k] || 0) >= cost[k]; });
  }
  function pay(cost) {
    if (!canPay(cost)) return false;
    Object.keys(cost).forEach(function (k) { save.inventory[k] -= cost[k]; });
    return true;
  }
  function gain(reward) {
    var msgs = [];
    Object.keys(reward || {}).forEach(function (k) {
      if (k === 'item') { save.inventory[reward[k]] = (save.inventory[reward[k]] || 0) + 1; msgs.push(D.ITEMS[reward[k]] ? D.ITEMS[reward[k]].name : reward[k]); }
      else { save.inventory[k] = (save.inventory[k] || 0) + reward[k]; msgs.push((D.ITEMS[k] ? D.ITEMS[k].name : k) + ' ×' + reward[k]); }
    });
    return msgs;
  }
  function log(text) {
    save.world.log.unshift({ t: Date.now(), text: text });
    if (save.world.log.length > 120) save.world.log.length = 120;
  }

  /* ---------------------------------------------------------------- 宠物：获取 */
  function addPet(speciesId, level, star) {
    var pet = makePet(speciesId, level, star);
    save.pets.push(pet);
    save.player.stats.petsOwned = save.pets.length;
    if (save.team.length < 3) save.team.push(pet.uid);
    log('获得新灵兽【' + pet.nickname + '】');
    return pet;
  }

  function gacha(times) {
    times = times || 1;
    var cost = times === 10 ? D.GACHA.tenCost : { gem: D.GACHA.singleCost.gem * times };
    if (!pay(cost)) throw new Error('灵玉不足，需要 ' + cost.gem + ' 灵玉');
    var results = [];
    for (var i = 0; i < times; i++) {
      save.player.pityCounter++;
      save.player.totalGacha++;
      var isPity = save.player.pityCounter >= D.GACHA.pity;
      var sid = isPity ? 'white_tiger' : weightedPick(D.GACHA.pool);
      var stageBoost = Math.random() < 0.08 ? 2 : 1;
      if (isPity) save.player.pityCounter = 0;
      var existing = save.pets.some(function (p) { return p.speciesId === sid; });
      if (existing && Math.random() < 0.7) {
        save.inventory.soul_shard += D.GACHA.dupShard;
        results.push({ type: 'shard', speciesId: sid, amount: D.GACHA.dupShard });
      } else {
        var pet = addPet(sid, stageBoost === 2 ? 10 : 5, 1);
        results.push({ type: 'pet', pet: pet, speciesId: sid });
      }
    }
    log('灵兽召唤 ' + times + ' 次');
    persist();
    return results;
  }
  function weightedPick(pool) {
    var total = pool.reduce(function (a, b) { return a + b.rate; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= pool[i].rate; if (r <= 0) return pool[i].speciesId; }
    return pool[pool.length - 1].speciesId;
  }

  /* ---------------------------------------------------------------- 宠物：培养 */
  function addExp(pet, amount) {
    pet.exp += amount;
    var levels = 0;
    while (pet.level < F.maxLevel && pet.exp >= D.expToNext(pet.level)) {
      pet.exp -= D.expToNext(pet.level);
      pet.level++;
      levels++;
      // 自动进化（阶段由等级推导，无需额外操作，但给出提示）
    }
    if (pet.level >= F.maxLevel) pet.exp = 0;
    if (levels > 0) {
      save.quests.family.fq_train = (save.quests.family.fq_train || 0) + levels;
      log(pet.nickname + ' 升级至 Lv.' + pet.level);
    }
    return levels;
  }

  function levelUpPet(u, times) {
    times = times || 1;
    var pet = assertPet(u);
    var total = 0;
    for (var i = 0; i < times; i++) {
      if (pet.level >= F.maxLevel) throw new Error('已达等级上限');
      var cost = { gold: levelUpCost(pet.level) };
      if (!pay(cost)) throw new Error('金币不足，需要 ' + cost.gold);
      total += addExp(pet, D.expToNext(pet.level));
    }
    persist();
    return { pet: pet, levels: total };
  }
  function levelUpCost(level) { return 300 + level * 260; }

  function useItemOnPet(u, itemId, times) {
    times = times || 1;
    var pet = assertPet(u);
    if (!D.ITEMS[itemId]) throw new Error('未知道具');
    if ((save.inventory[itemId] || 0) < times) throw new Error('道具数量不足');
    var out = '';
    for (var i = 0; i < times; i++) {
      pay({ }); save.inventory[itemId]--;
      if (itemId === 'exp_pill') { addExp(pet, 800); out = '获得经验 800'; }
      else if (itemId === 'tender_grass') { pet.intimacy = clamp(pet.intimacy + 10, 0, F.intimacyMax); out = '亲密度 +10'; }
      else { save.inventory[itemId]++; throw new Error(itemId + ' 不能直接对宠物使用'); }
    }
    persist();
    return { pet: pet, message: out };
  }

  function breakthrough(u) {
    var pet = assertPet(u);
    if (pet.level < F.maxLevel && pet.level % F.breakEvery !== 0) throw new Error('每 10 级才可突破一次');
    var need = 1 + pet.breakCount;
    if ((save.inventory.break_stone || 0) < need) throw new Error('破境石不足，需要 ' + need + ' 个');
    if (!pay({ break_stone: need, gold: 500 + pet.breakCount * 400 })) throw new Error('资源不足');
    pet.breakCount++;
    addExp(pet, 300 * pet.breakCount);
    log(pet.nickname + ' 突破成功（第 ' + pet.breakCount + ' 次）');
    persist();
    return pet;
  }

  function starUp(u) {
    var pet = assertPet(u);
    var sp = D.getSpecies(pet.speciesId);
    var cap = D.RARITY[sp.rarity].starCap;
    if (pet.star >= cap) throw new Error('该品质最高 ' + cap + ' 星');
    var need = 30 + (pet.star - 1) * 20;
    if ((save.inventory.soul_shard || 0) < need) throw new Error('兽魂碎片不足，需要 ' + need);
    pay({ soul_shard: need, gold: 1500 * pet.star });
    pet.star++;
    log(pet.nickname + ' 升星至 ★' + pet.star);
    persist();
    return pet;
  }

  function upgradeSkill(u, skillIndex) {
    var pet = assertPet(u);
    var lv = pet.skillLevels[skillIndex] || 1;
    if (lv >= 10) throw new Error('技能已满级');
    if ((save.inventory.skill_book || 0) < 1) throw new Error('技能秘典不足');
    pay({ skill_book: 1, gold: 800 * lv });
    pet.skillLevels[skillIndex] = lv + 1;
    log(pet.nickname + ' 技能升级至 Lv.' + (lv + 1));
    persist();
    return pet;
  }

  function setTeam(uids) {
    if (uids.length > 3) throw new Error('最多 3 只宠物上阵');
    var seen = {};
    uids.forEach(function (u) { if (seen[u]) throw new Error('不可重复上阵'); seen[u] = 1; assertPet(u); });
    save.team = uids.slice();
    persist();
    return save.team;
  }

  function assertPet(u) {
    var p = findPet(save, u);
    if (!p) throw new Error('宠物不存在');
    return p;
  }

  /* ---------------------------------------------------------------- 家族 */
  function getFamily(s) {
    s = s || save;
    if (!s || !s.familyId) return null;
    for (var i = 0; i < s.world.families.length; i++) if (s.world.families[i].id === s.familyId) return s.world.families[i];
    return null;
  }
  function getFamilyById(id) {
    for (var i = 0; i < save.world.families.length; i++) if (save.world.families[i].id === id) return save.world.families[i];
    return null;
  }
  function myMember() {
    var fam = getFamily(); if (!fam) return null;
    for (var i = 0; i < fam.members.length; i++) if (fam.members[i].id === save.player.id) return fam.members[i];
    return null;
  }
  function isNpcFamily(fam) { return !!fam.npc; }

  function createFamily(name, badge, notice) {
    if (save.familyId) throw new Error('你已有家族，请先退出');
    name = (name || '').trim();
    if (name.length < D.FAMILY.nameMin || name.length > D.FAMILY.nameMax) throw new Error('家族名需 ' + D.FAMILY.nameMin + '-' + D.FAMILY.nameMax + ' 个字');
    if (save.world.families.some(function (f) { return f.name === name; })) throw new Error('该家族名已被占用');
    if (!pay(D.FAMILY.createCost)) throw new Error('金币不足，创建家族需要 ' + D.FAMILY.createCost.gold + ' 金币');
    var fam = {
      id: uid('f'), name: name, tag: name.slice(0, 2), badge: badge || '🏯',
      level: 1, exp: 0, funds: 0, contribution: 0,
      notice: notice || '欢迎加入我们的家族！',
      npc: false, techs: { power: 0, tough: 0, swift: 0, fortune: 0 },
      members: [{ id: save.player.id, name: save.player.name, position: 'leader', contribution: 0, power: teamPower(save), active: true, isPlayer: true, level: save.player.level }],
      allies: [], allyRequests: [], warScore: 0, seasonWins: 0, seasonLosses: 0,
      createdAt: Date.now()
    };
    save.world.families.push(fam);
    save.familyId = fam.id;
    log('创建家族【' + name + '】');
    persist();
    return fam;
  }

  function joinFamily(id) {
    if (save.familyId) throw new Error('你已有家族，请先退出');
    var fam = getFamilyById(id);
    if (!fam) throw new Error('家族不存在');
    if (fam.members.length >= memberCap(fam)) throw new Error('家族人数已满');
    fam.members.push({ id: save.player.id, name: save.player.name, position: 'member', contribution: 0, power: teamPower(save), active: true, isPlayer: true, level: save.player.level });
    save.familyId = fam.id;
    log('加入家族【' + fam.name + '】');
    persist();
    return fam;
  }

  function leaveFamily() {
    var fam = getFamily();
    if (!fam) throw new Error('你还没有加入家族');
    var me = myMember();
    if (me && me.position === 'leader' && fam.members.length > 1 && !fam.npc) {
      throw new Error('族长需先转让职位才能退出');
    }
    fam.members = fam.members.filter(function (m) { return m.id !== save.player.id; });
    if (fam.members.length === 0 && !fam.npc) {
      save.world.families = save.world.families.filter(function (f) { return f.id !== fam.id; });
      // 清理联盟引用
      save.world.families.forEach(function (f) { f.allies = (f.allies || []).filter(function (a) { return a !== fam.id; }); });
    }
    save.familyId = null;
    log('退出了家族【' + fam.name + '】');
    persist();
    return true;
  }

  function memberCap(fam) { return D.FAMILY.baseMemberCap + (fam.level - 1) * D.FAMILY.capPerLevel; }

  function syncMyMember() {
    var m = myMember();
    if (m) { m.name = save.player.name; m.power = teamPower(save); m.contribution = m.contribution || 0; }
    return m;
  }

  function donate(amount) {
    var fam = getFamily();
    if (!fam) throw new Error('请先加入家族');
    amount = amount || 1000;
    if (!pay({ gold: amount })) throw new Error('金币不足');
    var gainContrib = Math.floor(amount / 100);
    fam.funds += amount;
    fam.contribution += gainContrib;
    var me = syncMyMember();
    me.contribution += gainContrib;
    save.inventory.contrib += gainContrib;
    fam.exp += Math.floor(amount / 20);
    checkFamilyLevel(fam);
    save.quests.family.fq_donate = (save.quests.family.fq_donate || 0) + 1;
    log('向家族捐献 ' + amount + ' 金币，获得 ' + gainContrib + ' 贡献');
    persist();
    return { contrib: gainContrib, family: fam };
  }

  function checkFamilyLevel(fam) {
    while (fam.level < D.FAMILY.maxLevel && fam.exp >= D.familyExpToNext(fam.level)) {
      fam.exp -= D.familyExpToNext(fam.level);
      fam.level++;
      log('家族【' + fam.name + '】升级至 Lv.' + fam.level);
    }
  }

  function upgradeTech(techId) {
    var fam = getFamily();
    if (!fam) throw new Error('请先加入家族');
    var def = null;
    D.FAMILY.techs.forEach(function (t) { if (t.id === techId) def = t; });
    if (!def) throw new Error('未知科技');
    var lv = fam.techs[techId] || 0;
    if (lv >= def.maxLevel) throw new Error('该科技已满级');
    // 需要职位权限
    var me = myMember();
    if (me && ['leader', 'vice'].indexOf(me.position) < 0) throw new Error('仅族长/副族长可升级家族科技');
    var cost = D.FAMILY.techCost(lv);
    var useContrib = Math.min(save.inventory.contrib, cost.contrib);
    var leftContrib = cost.contrib - useContrib;
    if (useContrib + leftContrib > save.inventory.contrib) throw new Error('家族贡献不足，需要 ' + cost.contrib);
    if (!pay({ contrib: cost.contrib, gold: cost.gold })) throw new Error('资源不足：需要 ' + cost.contrib + ' 贡献 + ' + cost.gold + ' 金币');
    fam.techs[techId] = lv + 1;
    log('家族科技【' + def.name + '】提升至 Lv.' + (lv + 1));
    persist();
    return fam;
  }

  function claimFamilyQuest(questId) {
    var fam = getFamily();
    if (!fam) throw new Error('请先加入家族');
    var def = null;
    D.FAMILY.quests.forEach(function (q) { if (q.id === questId) def = q; });
    if (!def) throw new Error('未知任务');
    if (save.quests.family[questId + '_done']) throw new Error('今日已领取');
    var progress = save.quests.family[questId] || 0;
    if (progress < def.need) throw new Error('任务未完成（' + progress + '/' + def.need + '）');
    save.quests.family[questId + '_done'] = true;
    var msgs = gain(def.reward);
    persist();
    return msgs;
  }

  /* ---------------------------------------------------------------- 家族战 */
  function warOpponents() {
    var fam = getFamily();
    var list = save.world.families.filter(function (f) { return f.id !== save.familyId; });
    // 只取排名接近的 4 个
    list.sort(function (a, b) { return rankScore(b) - rankScore(a); });
    if (fam) {
      var my = rankScore(fam);
      list.sort(function (a, b) { return Math.abs(rankScore(a) - my) - Math.abs(rankScore(b) - my); });
    }
    return list.slice(0, 4);
  }
  function rankScore(f) { return f.level * 1000 + f.warScore * 10 + f.members.length * 5; }

  function startFamilyWar(targetId) {
    var fam = getFamily();
    if (!fam) throw new Error('请先加入家族');
    var target = getFamilyById(targetId);
    if (!target) throw new Error('目标家族不存在');
    var me = myMember();
    if (me && ['leader', 'vice', 'elder', 'elite'].indexOf(me.position) < 0) throw new Error('你的职位无权发起家族战');

    // 生成对手阵容：取对方战力最高的成员，按宠物模板构造
    var oppPower = target.members.slice(0, 3);
    var scale = clamp(target.level / 6, 0.5, 2.2);
    var species = ['yellow_ox', 'white_tiger', 'dawn_chicken'];
    var enemies = [];
    for (var i = 0; i < 3; i++) {
      var spId = species[(i + target.level) % 3];
      var lvl = clamp(round(8 + target.level * 4.2 + (2 - i) * 6), 3, 60);
      var pet = makePet(spId, lvl, clamp(1 + Math.floor(target.level / 3), 1, 5));
      pet.nickname = (oppPower[i] ? oppPower[i].name + '的' : '') + D.getSpecies(spId).name;
      pet.ownerPower = oppPower[i] ? oppPower[i].power : 8000;
      enemies.push(pet);
    }
    return { family: fam, target: target, enemies: enemies };
  }

  function finishFamilyWar(targetId, result) {
    var fam = getFamily();
    var target = getFamilyById(targetId);
    var me = syncMyMember();
    var W = D.FAMILY.war;
    var score = result.win ? W.winScore : W.drawScore;
    fam.warScore += score;
    if (result.win) { fam.seasonWins++; fam.exp += 800; save.player.stats.familiesWarWon++; }
    else fam.seasonLosses++;
    target.warScore = Math.max(0, target.warScore + (result.win ? 0 : 1));
    target.seasonLosses += result.win ? 1 : 0;

    var reward = { contrib: W.rewardPerScore.contrib * (score || 1), gold: W.rewardPerScore.gold * (score || 1) };
    save.inventory.contrib += reward.contrib;
    save.inventory.gold += reward.gold;
    if (me) me.contribution += reward.contrib;
    fam.contribution += reward.contrib;
    fam.funds += Math.floor(reward.gold * 0.3);
    save.quests.family.fq_war = (save.quests.family.fq_war || 0) + 1;
    checkFamilyLevel(fam);
    log('家族战 vs【' + target.name + '】' + (result.win ? '胜利' : '落败') + '，获得 ' + reward.contrib + ' 贡献');
    persist();
    return { reward: reward, score: score };
  }

  /* ---------------------------------------------------------------- 家族结盟 */
  function sendAllyRequest(targetId) {
    var fam = getFamily();
    if (!fam) throw new Error('请先加入家族');
    var me = myMember();
    if (me && me.position !== 'leader') throw new Error('仅族长可发起结盟');
    if (fam.allies.length >= D.FAMILY.maxAllies) throw new Error('盟友已满（上限 ' + D.FAMILY.maxAllies + '）');
    var t = getFamilyById(targetId);
    if (!t) throw new Error('目标家族不存在');
    if (t.allies.indexOf(fam.id) >= 0) throw new Error('你们已经是盟友');
    if (t.allies.length >= D.FAMILY.maxAllies) throw new Error('对方盟友已满');
    if (!t.allyRequests) t.allyRequests = [];
    if (t.allyRequests.indexOf(fam.id) < 0) t.allyRequests.push(fam.id);
    log('向【' + t.name + '】发出结盟邀请');
    persist();
    return t;
  }
  function acceptAllyRequest(fromId) {
    var fam = getFamily();
    if (!fam) throw new Error('请先加入家族');
    var me = myMember();
    if (me && me.position !== 'leader') throw new Error('仅族长可处理结盟申请');
    fam.allyRequests = (fam.allyRequests || []).filter(function (i) { return i !== fromId; });
    var f = getFamilyById(fromId);
    if (!f) throw new Error('该家族已不存在');
    if (fam.allies.length >= D.FAMILY.maxAllies) throw new Error('我方盟友已满');
    if (f.allies.length >= D.FAMILY.maxAllies) throw new Error('对方盟友已满');
    fam.allies.push(f.id); f.allies.push(fam.id);
    log('与【' + f.name + '】结为盟友');
    persist();
    return f;
  }
  function rejectAllyRequest(fromId) {
    var fam = getFamily();
    fam.allyRequests = (fam.allyRequests || []).filter(function (i) { return i !== fromId; });
    persist(); return true;
  }
  function dissolveAlly(targetId) {
    var fam = getFamily();
    var me = myMember();
    if (me && me.position !== 'leader') throw new Error('仅族长可解除结盟');
    fam.allies = fam.allies.filter(function (i) { return i !== targetId; });
    var f = getFamilyById(targetId);
    if (f) f.allies = f.allies.filter(function (i) { return i !== fam.id; });
    // 联盟 BOSS 进度清零
    save.world.boss.participantDamage = 0;
    log('与【' + (f ? f.name : '未知') + '】解除结盟');
    persist(); return true;
  }
  function allyList() {
    var fam = getFamily();
    if (!fam) return [];
    return fam.allies.map(function (id) {
      var f = getFamilyById(id);
      if (!f) return null;
      return {
        family: f,
        sharedTasks: D.FAMILY.allianceBoss.tasks.map(function (t) {
          var p = save.world.boss;
          return { def: t, progress: clamp(p.participantDamage / (p.maxHp * t.threshold), 0, 1) };
        })
      };
    }).filter(Boolean);
  }

  /* ---------------------------------------------------------------- 联盟 BOSS（协作任务） */
  function attackBoss(damage) {
    var fam = getFamily();
    if (!fam) throw new Error('请先加入家族');
    if (!fam.allies.length) throw new Error('需要至少 1 个盟友才能挑战联盟 BOSS');
    var b = save.world.boss;
    if (b.hp <= 0) throw new Error('本季 BOSS 已被击杀，等待赛季重置');
    b.hp = Math.max(0, b.hp - damage);
    b.participantDamage += damage;
    save.player.stats.raidDamage += damage;
    var contrib = Math.round(damage / 100);
    save.inventory.contrib += contrib;
    var me = syncMyMember(); if (me) me.contribution += contrib;
    log('联盟 BOSS 战斗中造成 ' + damage + ' 点伤害，获得 ' + contrib + ' 贡献');
    persist();
    return { hp: b.hp, contrib: contrib };
  }
  function claimBossTask(taskId) {
    var b = save.world.boss;
    var t = null;
    D.FAMILY.allianceBoss.tasks.forEach(function (x) { if (x.id === taskId) t = x; });
    if (!t) throw new Error('未知协作任务');
    if (b.claimedTasks.indexOf(taskId) >= 0) throw new Error('该奖励已领取');
    var progress = b.participantDamage / b.maxHp;
    if (progress < t.threshold) throw new Error('进度不足（' + Math.floor(progress * 100) + '% / ' + Math.floor(t.threshold * 100) + '%）');
    b.claimedTasks.push(taskId);
    var msgs = gain(t.reward);
    persist();
    return msgs;
  }

  /* ---------------------------------------------------------------- PVE / 竞技场 */
  function allStages() {
    var out = [];
    D.CHAPTERS.forEach(function (c) { c.stages.forEach(function (s) { out.push(s); }); });
    return out;
  }
  function stageById(idx) {
    var all = allStages();
    for (var i = 0; i < all.length; i++) if (all[i].idx === idx) return all[i];
    return null;
  }
  function makeEnemies(level, count, boss) {
    var species = ['yellow_ox', 'white_tiger', 'dawn_chicken'];
    var out = [];
    for (var i = 0; i < count; i++) {
      var spId = species[(i + Math.floor(level / 7)) % 3];
      var pet = makePet(spId, clamp(level + (boss ? 4 : 0), 1, 60), clamp(1 + Math.floor(level / 14), 1, 5));
      if (boss) { pet.nickname = '首领·' + D.getSpecies(spId).name; pet.boss = true; }
      out.push(pet);
    }
    return out;
  }
  function finishPve(stage, result) {
    if (result.win) {
      if (stage.idx >= save.world.stageProgress) save.world.stageProgress = stage.idx + 1;
      save.player.stats.battlesWon++;
      save.player.exp += Math.floor(stage.level * 12);
      var mul = 1 + (getFamily() ? (getFamily().techs.fortune || 0) * 0.025 : 0);
      var reward = { gold: round(stage.reward.gold * mul), exp: stage.reward.exp };
      save.inventory.gold += reward.gold;
      if (stage.reward.item) { save.inventory[stage.reward.item] = (save.inventory[stage.reward.item] || 0) + 1; }
      // 队伍宠物获得经验
      save.team.forEach(function (u) { var p = findPet(save, u); if (p) addExp(p, reward.exp); });
      checkPlayerLevel();
      log('通过 ' + stage.name + '，获得 ' + reward.gold + ' 金币');
      persist();
      return reward;
    } else {
      save.player.stats.battlesLost++;
      persist();
      return null;
    }
  }
  function checkPlayerLevel() {
    var P = save.player;
    while (P.level < 60 && P.exp >= D.expToNext(P.level) * 1.5) { P.exp -= Math.floor(D.expToNext(P.level) * 1.5); P.level++; }
  }

  function arenaOpponent() {
    var myPower = Math.max(teamPower(save), 3000);
    var factor = rand(0.82, 1.22);
    var targetPower = myPower * factor;
    var level = clamp(round(Math.sqrt(targetPower / 3.2)), 3, 60);
    var members = save.world.families.map(function (f) { return f.members[0] ? f.members[0].name : '无名'; });
    var name = pick(NPC_PLAYERS);
    var enemies = makeEnemies(level, 3, false);
    enemies.forEach(function (e, i) { e.nickname = name + '的' + D.getSpecies(e.speciesId).name; });
    return { owner: name, power: round(targetPower), enemies: enemies };
  }
  function finishArena(result) {
    if (result.win) {
      save.player.stats.battlesWon++;
      var reward = { gem: 30, gold: 800, contrib: 20 };
      gain(reward);
      checkPlayerLevel();
      persist();
      return reward;
    }
    save.player.stats.battlesLost++;
    gain({ gold: 200 });
    persist();
    return { gold: 200 };
  }

  /* ---------------------------------------------------------------- 排行榜 */
  function getLeaderboard(type) {
    var rows = [];
    var fam = getFamily();
    if (type === 'power') {
      save.world.families.forEach(function (f) {
        f.members.forEach(function (m) {
          rows.push({ name: m.name, family: f.name, familyId: f.id, value: m.power, isMe: m.id === save.player.id });
        });
      });
      var myName = save.player.name;
      if (!rows.some(function (r) { return r.isMe; })) {
        rows.push({ name: myName, family: fam ? fam.name : '无', familyId: fam ? fam.id : null, value: teamPower(save), isMe: true });
      }
    } else if (type === 'family') {
      save.world.families.forEach(function (f) {
        rows.push({ name: f.name, badge: f.badge, level: f.level, members: f.members.length, value: rankScore(f), isMe: f.id === save.familyId, familyId: f.id, allies: (f.allies || []).length });
      });
    } else if (type === 'contrib') {
      save.world.families.forEach(function (f) {
        f.members.forEach(function (m) {
          rows.push({ name: m.name, family: f.name, value: m.contribution, isMe: m.id === save.player.id });
        });
      });
    } else if (type === 'war') {
      save.world.families.forEach(function (f) {
        rows.push({ name: f.name, badge: f.badge, level: f.level, value: f.warScore, wins: f.seasonWins || 0, losses: f.seasonLosses || 0, isMe: f.id === save.familyId, familyId: f.id });
      });
    }
    rows.sort(function (a, b) { return b.value - a.value; });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }
  function allFamilies() {
    return save.world.families.slice().sort(function (a, b) { return rankScore(b) - rankScore(a); });
  }
  function recruitTargets() {
    // 供"加入家族"展示：人数未满且非自建
    return allFamilies().filter(function (f) { return f.id !== save.familyId; });
  }

  /* ---------------------------------------------------------------- 事件总线 */
  var listeners = {};
  function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } });
    (listeners['*'] || []).forEach(function (fn) { try { fn(evt, payload); } catch (e) { console.error(e); } });
  }

  /* ---------------------------------------------------------------- 导出 */
  Q.Store = {
    /* 生命周期 */
    load: load, reset: reset, save: persist, getSave: getSave,
    on: on, emit: emit,
    /* 工具 */
    makePet: makePet, findPet: findPet,
    /* 计算 */
    computeStats: computeStats, powerOf: powerOf, teamPower: teamPower, rankScore: rankScore,
    /* 经济 */
    canPay: canPay, pay: pay, gain: gain, log: log,
    /* 宠物 */
    addPet: addPet, gacha: gacha, levelUpPet: levelUpPet, useItemOnPet: useItemOnPet,
    breakthrough: breakthrough, starUp: starUp, upgradeSkill: upgradeSkill, setTeam: setTeam,
    levelUpCost: levelUpCost, addExp: addExp,
    /* 家族 */
    getFamily: getFamily, getFamilyById: getFamilyById, myMember: myMember, memberCap: memberCap,
    createFamily: createFamily, joinFamily: joinFamily, leaveFamily: leaveFamily, donate: donate,
    upgradeTech: upgradeTech, claimFamilyQuest: claimFamilyQuest,
    warOpponents: warOpponents, startFamilyWar: startFamilyWar, finishFamilyWar: finishFamilyWar,
    sendAllyRequest: sendAllyRequest, acceptAllyRequest: acceptAllyRequest,
    rejectAllyRequest: rejectAllyRequest, dissolveAlly: dissolveAlly, allyList: allyList,
    attackBoss: attackBoss, claimBossTask: claimBossTask,
    /* 战斗 */
    allStages: allStages, stageById: stageById, makeEnemies: makeEnemies,
    finishPve: finishPve, arenaOpponent: arenaOpponent, finishArena: finishArena,
    /* 排行 */
    getLeaderboard: getLeaderboard, allFamilies: allFamilies, recruitTargets: recruitTargets,
    /* 其他 */
    isNpcFamily: isNpcFamily, syncMyMember: syncMyMember, checkFamilyLevel: checkFamilyLevel,
    uid: uid, today: today, deepCopy: deepCopy
  };
})(typeof window !== 'undefined' ? window : globalThis);
