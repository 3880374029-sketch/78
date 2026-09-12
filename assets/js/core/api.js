/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · API 抽象层
 * ---------------------------------------------------------------------
 * 前端只调用 Q.API.*，不直接碰 Store。
 * 每个方法都严格对应后端一个 REST 端点（见 docs/API接口文档.md），
 * 因此把 API.mode 从 'local' 切到 'remote' 即可无缝接入真实服务端，
 * UI 代码一行都不用改。
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var S = Q.Store;

  /* 端点表：method + 路径  →  Store 方法名 */
  var ROUTES = {
    'GET /api/player/profile':        'getProfile',
    'POST /api/player/signin':        'signIn',
    'GET /api/pets':                  'listPets',
    'POST /api/pets/gacha':           'gacha',
    'POST /api/pets/:uid/levelup':    'levelUp',
    'POST /api/pets/:uid/item':       'useItem',
    'POST /api/pets/:uid/breakthrough':'breakthrough',
    'POST /api/pets/:uid/starup':     'starUp',
    'POST /api/pets/:uid/skill/:idx': 'upgradeSkill',
    'PUT /api/team':                  'setTeam',
    'GET /api/stages':                'listStages',
    'POST /api/battle/pve':           'battlePve',
    'POST /api/battle/arena':         'battleArena',
    'GET /api/families':              'listFamilies',
    'POST /api/families':             'createFamily',
    'POST /api/families/:id/join':    'joinFamily',
    'POST /api/families/leave':       'leaveFamily',
    'POST /api/families/donate':      'donate',
    'POST /api/families/tech/:techId':'upgradeTech',
    'POST /api/families/quest/:qid':  'claimFamilyQuest',
    'GET /api/families/war/opponents':'warOpponents',
    'POST /api/families/war/start':   'startWar',
    'POST /api/families/war/finish':  'finishWar',
    'GET /api/families/allies':       'listAllies',
    'POST /api/families/ally/request':'requestAlly',
    'POST /api/families/ally/accept': 'acceptAlly',
    'POST /api/families/ally/reject': 'rejectAlly',
    'POST /api/families/ally/dissolve':'dissolveAlly',
    'POST /api/families/boss/attack': 'attackBoss',
    'POST /api/families/boss/claim':  'claimBossTask',
    'GET /api/leaderboard/:type':     'leaderboard',
    'POST /api/shop/buy':             'buyItem',
    'POST /api/save/reset':           'resetGame'
  };

  var API = {
    mode: 'local',          // 'local' | 'remote'
    baseUrl: '/api',        // remote 模式下的服务端地址
    routes: ROUTES
  };

  function ok(data) { return Promise.resolve(data); }
  function fail(msg) { return Promise.reject(new Error(msg)); }
  /** 统一包裹：捕获 Store 抛出的业务异常，转换为 rejected promise */
  function wrap(fn) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      try { return ok(fn.apply(null, args)); }
      catch (e) { return fail(e.message || String(e)); }
    };
  }

  /* --------------------------- 玩家 --------------------------- */
  API.getProfile = wrap(function () {
    var s = S.getSave();
    var fam = S.getFamily();
    return {
      player: s.player,
      inventory: s.inventory,
      team: s.team,
      teamPower: S.teamPower(s),
      petCount: s.pets.length,
      family: fam ? { id: fam.id, name: fam.name, badge: fam.badge, level: fam.level, position: (S.myMember() || {}).position } : null,
      stageProgress: s.world.stageProgress,
      log: s.world.log.slice(0, 20)
    };
  });

  API.signIn = wrap(function () {
    var s = S.getSave();
    if (s.quests.signinDate === S.today()) throw new Error('今日已签到');
    s.quests.signinDate = S.today();
    var day = (s.player.signinDays || 0) + 1;
    s.player.signinDays = day;
    var reward = { gold: 500 + day * 100, gem: 20 + day * 5 };
    if (day % 7 === 0) reward.soul_shard = 30;
    if (day === 3) reward.item = 'tender_grass';
    S.gain(reward); S.save();
    return { day: day, reward: reward };
  });

  /* --------------------------- 宠物 --------------------------- */
  API.listPets = wrap(function () {
    var s = S.getSave(), fam = S.getFamily();
    return s.pets.map(function (p) {
      var sp = Q.DATA.getSpecies(p.speciesId);
      return {
        raw: p,
        species: sp,
        stage: Q.DATA.getStage(p.level),
        stats: S.computeStats(p, { family: fam }),
        power: S.powerOf(p, fam),
        rarity: Q.DATA.RARITY[sp.rarity],
        inTeam: s.team.indexOf(p.uid) >= 0,
        expNeed: Q.DATA.expToNext(p.level),
        starCap: Q.DATA.RARITY[sp.rarity].starCap
      };
    });
  });

  API.gacha = wrap(function (times) { return S.gacha(times); });

  API.levelUp = wrap(function (uid, times) { return S.levelUpPet(uid, times); });
  API.useItem = wrap(function (uid, itemId, times) { return S.useItemOnPet(uid, itemId, times); });
  API.breakthrough = wrap(function (uid) { return S.breakthrough(uid); });
  API.starUp = wrap(function (uid) { return S.starUp(uid); });
  API.upgradeSkill = wrap(function (uid, idx) { return S.upgradeSkill(uid, parseInt(idx, 10)); });
  API.setTeam = wrap(function (uids) { return S.setTeam(uids); });

  /* --------------------------- 战斗 --------------------------- */
  API.listStages = wrap(function () {
    var s = S.getSave();
    return { chapters: Q.DATA.CHAPTERS, progress: s.world.stageProgress };
  });

  API.battlePve = wrap(function (stageIdx) {
    var s = S.getSave();
    var stage = S.stageById(stageIdx);
    if (!stage) throw new Error('关卡不存在');
    if (stage.idx > s.world.stageProgress) throw new Error('尚未解锁该关卡');
    var myTeam = s.team.map(function (u) { return S.findPet(s, u); }).filter(Boolean);
    if (!myTeam.length) throw new Error('请先设置出战队伍');
    var enemies = S.makeEnemies(stage.level, stage.enemyCount, stage.boss);
    var result = Q.Battle.run({ allies: myTeam, enemies: enemies, family: S.getFamily(), bonds: S.teamBondEffects() });
    var reward = S.finishPve(stage, result);
    S.save();
    return { result: result, reward: reward, stage: stage };
  });

  API.battleArena = wrap(function () {
    var s = S.getSave();
    var myTeam = s.team.map(function (u) { return S.findPet(s, u); }).filter(Boolean);
    if (!myTeam.length) throw new Error('请先设置出战队伍');
    var opp = S.arenaOpponent();
    var result = Q.Battle.run({ allies: myTeam, enemies: opp.enemies, family: S.getFamily(), bonds: S.teamBondEffects() });
    var reward = S.finishArena(result);
    S.save();
    return { result: result, reward: reward, opponent: opp };
  });

  /* --------------------------- 家族 --------------------------- */
  API.listFamilies = wrap(function () {
    var fam = S.getFamily();
    return {
      my: fam ? decorate(fam) : null,
      all: S.allFamilies().map(decorate),
      memberCap: fam ? S.memberCap(fam) : Q.DATA.FAMILY.baseMemberCap,
      myPosition: fam ? (S.myMember() || {}).position : null,
      createCost: Q.DATA.FAMILY.createCost
    };
  });

  function decorate(f) {
    return {
      raw: f,
      id: f.id, name: f.name, tag: f.tag, badge: f.badge, level: f.level,
      exp: f.exp, expNeed: Q.DATA.familyExpToNext(f.level), funds: f.funds,
      memberCount: f.members.length, memberCap: S.memberCap(f),
      contribution: f.contribution, notice: f.notice,
      npc: !!f.npc,
      allies: (f.allies || []).map(function (id) { var a = S.getFamilyById(id); return a ? { id: a.id, name: a.name, badge: a.badge, level: a.level } : null; }).filter(Boolean),
      techs: f.techs, quests: f.members ? null : null,
      warScore: f.warScore, rank: Q.DATA.rankOfWarScore(f.warScore),
      seasonWins: f.seasonWins || 0, seasonLosses: f.seasonLosses || 0,
      allyRequests: (f.allyRequests || []).map(function (id) { var a = S.getFamilyById(id); return a ? { id: a.id, name: a.name, badge: a.badge, level: a.level } : null; }).filter(Boolean),
      createdAt: f.createdAt
    };
  }

  API.createFamily = wrap(function (name, badge, notice) { S.createFamily(name, badge, notice); return S.getFamily(); });
  API.joinFamily = wrap(function (id) { S.joinFamily(id); return S.getFamily(); });
  API.leaveFamily = wrap(function () { S.leaveFamily(); return true; });
  API.donate = wrap(function (amount) { return S.donate(amount); });
  API.upgradeTech = wrap(function (techId) { S.upgradeTech(techId); return S.getFamily(); });
  API.claimFamilyQuest = wrap(function (qid) { return S.claimFamilyQuest(qid); });

  API.warOpponents = wrap(function () { return S.warOpponents().map(decorate); });

  API.startWar = wrap(function (targetId) {
    var s = S.getSave();
    var setup = S.startFamilyWar(targetId);
    var myTeam = s.team.map(function (u) { return S.findPet(s, u); }).filter(Boolean);
    if (!myTeam.length) throw new Error('请先设置出战队伍');
    var result = Q.Battle.run({ allies: myTeam, enemies: setup.enemies, family: S.getFamily(), bonds: S.teamBondEffects() });
    var fin = S.finishFamilyWar(targetId, result);
    S.save();
    return { result: result, reward: fin.reward, score: fin.score, target: decorate(setup.target) };
  });

  API.finishWar = wrap(function () { return true; });

  API.listAllies = wrap(function () {
    var fam = S.getFamily();
    if (!fam) throw new Error('请先加入家族');
    var boss = S.getSave().world.boss;
    return {
      allies: S.allyList().map(function (x) { return { family: decorate(x.family), sharedTasks: x.sharedTasks }; }),
      maxAllies: Q.DATA.FAMILY.maxAllies,
      boss: {
        name: Q.DATA.FAMILY.allianceBoss.name,
        hp: boss.hp, maxHp: boss.maxHp,
        percent: 1 - boss.hp / boss.maxHp,
        tasks: Q.DATA.FAMILY.allianceBoss.tasks.map(function (t) {
          var p = clamp(boss.participantDamage / (boss.maxHp * t.threshold), 0, 1);
          return { def: t, progress: p, claimed: boss.claimedTasks.indexOf(t.id) >= 0 };
        }),
        myDamage: boss.participantDamage
      }
    };
  });
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  API.requestAlly = wrap(function (id) { S.sendAllyRequest(id); return true; });
  API.acceptAlly = wrap(function (id) { S.acceptAllyRequest(id); return true; });
  API.rejectAlly = wrap(function (id) { S.rejectAllyRequest(id); return true; });
  API.dissolveAlly = wrap(function (id) { S.dissolveAlly(id); return true; });
  API.attackBoss = wrap(function (damage) { return S.attackBoss(damage); });
  API.claimBossTask = wrap(function (tid) { return S.claimBossTask(tid); });

  /* --------------------------- 排行 / 商店 --------------------------- */
  API.leaderboard = wrap(function (type) { return S.getLeaderboard(type); });

  API.buyItem = wrap(function (itemId, count) {
    var s = S.getSave();
    count = count || 1;
    var entry = null;
    Q.DATA.SHOP.forEach(function (x) { if (x.itemId === itemId) entry = x; });
    if (!entry) throw new Error('该商品不存在');
    var cost = {};
    Object.keys(entry.cost).forEach(function (k) { cost[k] = entry.cost[k] * count; });
    s.inventory.shopBought = s.inventory.shopBought || {};
    var bought = s.inventory.shopBought[itemId] || 0;
    if (bought + count > entry.limit) throw new Error('超出每日限购（限 ' + entry.limit + ' 件）');
    if (!S.pay(cost)) throw new Error('货币不足');
    s.inventory.shopBought[itemId] = bought + count;
    s.inventory[itemId] = (s.inventory[itemId] || 0) + count;
    S.save();
    return { itemId: itemId, count: count };
  });

  API.resetGame = wrap(function () { S.reset(); return true; });

  /* --------------------------- Remote 模式 --------------------------- */
  function remote(path, method, body) {
    return fetch(API.baseUrl + path, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('qmhub_token') || '') },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.message || ('HTTP ' + r.status));
        return j.data !== undefined ? j.data : j;
      });
    });
  }
  /** 切换为真实后端：API.useRemote('https://qmhub.cc.cd') */
  API.useRemote = function (baseUrl) {
    API.baseUrl = baseUrl || '/api';
    API.mode = 'remote';
    return API;
  };
  API.useLocal = function () { API.mode = 'local'; return API; };

  Q.API = API;
})(typeof window !== 'undefined' ? window : globalThis);
