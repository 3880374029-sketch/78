/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 扩展玩法 API（v2 增量）
 * 与 docs/API接口文档.md 的 §v2 段落一一对应
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var S = Q.Store, API = Q.API, D = Q.DATA;

  function ok(d) { return Promise.resolve(d); }
  function bad(m) { return Promise.reject(new Error(m)); }
  function wrap(fn) {
    return function () {
      var a = Array.prototype.slice.call(arguments);
      try { return ok(fn.apply(null, a)); } catch (e) { return bad(e.message || String(e)); }
    };
  }
  function myTeam() {
    var s = S.getSave();
    var t = s.team.map(function (u) { return S.findPet(s, u); }).filter(Boolean);
    if (!t.length) throw new Error('请先设置出战队伍');
    return t;
  }

  /* ---------------------------- 羁绊 ---------------------------- */
  API.bondInfo = wrap(function () {
    var s = S.getSave();
    var team = s.team.map(function (u) { return S.findPet(s, u); }).filter(Boolean);
    var bonds = S.activeBonds(team);
    var eff = S.teamBondEffects(null, team);
    return {
      bonds: bonds,
      effects: eff,
      team: team.map(function (p) { return { uid: p.uid, speciesId: p.speciesId, nickname: p.nickname, level: p.level, emoji: D.getSpecies(p.speciesId).emoji }; }),
      activeCount: bonds.filter(function (b) { return b.active; }).length,
      total: bonds.length,
      /** 可用于补全羁绊的推荐编队 */
      recommend: S.recommendTeam()
    };
  });

  API.applyRecommendTeam = wrap(function () {
    var uids = S.recommendTeam();
    S.setTeam(uids);
    return uids;
  });

  /* ---------------------------- 试炼塔 ---------------------------- */
  API.towerInfo = wrap(function () { return S.towerInfo(); });
  API.towerBuyAttempt = wrap(function () { S.buyTowerAttempt(); return S.towerInfo(); });

  API.towerBattle = wrap(function () {
    var team = myTeam();
    S.consumeTowerAttempt();
    var info = S.towerInfo();
    var floor = info.floor;
    var enemies = S.makeTowerEnemies(floor);
    var result = Q.Battle.run({ allies: team, enemies: enemies, family: S.getFamily(), bonds: S.teamBondEffects() });
    var fin = S.finishTower(floor, result);
    S.save();
    return { result: result, floor: floor, isBoss: info.isBoss, rewards: fin.rewards, firstClear: fin.firstClear, info: S.towerInfo() };
  });

  /* ---------------------------- 繁育 ---------------------------- */
  API.breedInfo = wrap(function () { return S.breedInfo(); });

  API.breed = wrap(function (uidA, uidB) {
    var r = S.breed(uidA, uidB);
    return { child: r.child, talentTotal: r.talentTotal, star: r.star, species: r.species, info: S.breedInfo() };
  });

  /* ---------------------------- 每日委托 ---------------------------- */
  API.dailyInfo = wrap(function () { return S.dailyInfo(); });
  API.claimDaily = wrap(function (id) { return S.claimDaily(id); });
  API.claimDailyMilestone = wrap(function (idx) { return S.claimDailyMilestone(parseInt(idx, 10)); });

  /* ---------------------------- 编队与羁绊联动 ---------------------------- */
  var _setTeam = API.setTeam;
  API.setTeam = function (uids) {
    return _setTeam(uids).then(function (r) {
      // 编队变化后同步羁绊，返回新羁绊供 UI 提示
      var be = S.teamBondEffects();
      var active = S.activeBonds().filter(function (b) { return b.active; });
      return { team: r, bonds: active, effects: be };
    });
  };

  /* 路由表补充 */
  Object.assign(API.routes, {
    'GET /api/pets/bonds':            'bondInfo',
    'PUT /api/team/recommend':        'applyRecommendTeam',
    'GET /api/tower':                 'towerInfo',
    'POST /api/tower/battle':         'towerBattle',
    'POST /api/tower/buy-attempt':    'towerBuyAttempt',
    'GET /api/breed':                 'breedInfo',
    'POST /api/breed':                'breed',
    'GET /api/daily':                 'dailyInfo',
    'POST /api/daily/:id/claim':      'claimDaily',
    'POST /api/daily/milestone/:idx': 'claimDailyMilestone'
  });
})(typeof window !== 'undefined' ? window : globalThis);
