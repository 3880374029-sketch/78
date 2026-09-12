/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 扩展玩法配置（v2 增量）
 * ---------------------------------------------------------------------
 * 本文件在 config.js 之后加载，只做「新增」，不修改任何既有数值，
 * 因此对原有玩法完全兼容。
 *
 * 新增内容：
 *   §12 神兽试炼塔   §13 灵兽羁绊   §14 灵兽繁育
 *   §15 每日委托     §16 宣传海报
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var D = Q.DATA;
  if (!D) throw new Error('[config-ext] 需先加载 config.js');
  if (D.__extLoaded) return;
  D.__extLoaded = true;

  /* =====================================================================
   * §12 神兽试炼塔
   * 玩法：单人爬塔，层数无上限（配置上限 100），每 5 层为首领层。
   *      每日 3 次免费挑战机会，可花灵玉购买额外次数。
   *      层数进度每日不重置（长期养成目标），但挑战次数每日刷新。
   * =================================================================== */
  D.TOWER = {
    id: 'tower',
    name: '神兽试炼塔',
    emoji: '🗼',
    maxFloor: 100,
    dailyAttempts: 3,
    extraAttemptCost: { gem: 60 },
    enemyLevelBase: 6,
    enemyLevelPerFloor: 2.15,
    enemyCountBase: 2,          // 1-9 层 2 只
    enemyCountMax: 3,           // 10 层起 3 只
    bossEvery: 5,
    bossStatMul: 1.25,
    /** 每层奖励 */
    reward: function (floor) {
      var boss = floor % 5 === 0;
      var r = {
        gold: Math.round(300 + floor * 145),
        soul_shard: boss ? 12 + Math.floor(floor / 5) * 3 : 4 + Math.floor(floor / 10),
        contrib: 30 + floor * 8
      };
      if (boss) r.break_stone = 1 + Math.floor(floor / 20);
      if (floor % 10 === 0) r.skill_book = 1;
      if (floor % 25 === 0) r.gem = 120;
      return r;
    },
    /** 首次通关额外奖励 */
    firstClearBonus: { gem: 80, soul_shard: 20 },
    rankName: '试炼塔榜',
    lore: '青丘之巅有塔，凡百层。每上一层，灵气愈重，兽威愈盛。塔顶封着一枚太古兽魂。'
  };

  /* =====================================================================
   * §13 灵兽羁绊
   * 玩法：上阵灵兽按「物种组合」激活羁绊，给出全队或个体增益。
   *      战斗、面板、排行榜战力全部实时生效。
   * effects 字段：
   *   hp/atk/def/spd  → 乘区（+12% 记作 0.12）
   *   crit/critDmg/damageReduce → 加算
   *   selfDamageTaken → 己方受到伤害增加（负面代价）
   * =================================================================== */
  D.BONDS = [
    {
      id: 'trinity', name: '天地人三才阵', emoji: '☯️', grade: 'SSR',
      members: ['white_tiger', 'yellow_ox', 'dawn_chicken'],
      requireAll: true,
      desc: '白虎主杀伐、黄牛承厚土、司晨掌生息，三才既立，气运自成。',
      effects: { hp: 0.12, atk: 0.12, def: 0.10, crit: 0.05 },
      color: '#b8860b'
    },
    {
      id: 'metal_earth', name: '金石相生', emoji: '⛰️', grade: 'SR',
      members: ['white_tiger', 'yellow_ox'],
      desc: '金生于土，锋刃得地气所养。全队暴击率 +8%。',
      effects: { crit: 0.08 },
      color: '#8b6a3f'
    },
    {
      id: 'earth_wood', name: '土木相济', emoji: '🌳', grade: 'SR',
      members: ['yellow_ox', 'dawn_chicken'],
      desc: '厚土载木，生机不竭。全队受到伤害降低 10%。',
      effects: { damageReduce: 0.10 },
      color: '#4c9a6a'
    },
    {
      id: 'metal_wood', name: '金木相克', emoji: '⚡', grade: 'SR',
      members: ['white_tiger', 'dawn_chicken'],
      desc: '金克木，戾气反噬。全队暴击伤害 +20%，但自身承受伤害 +5%。',
      effects: { critDmg: 0.20, selfDamageTaken: 0.05 },
      color: '#c1462f'
    },
    {
      id: 'twin_soul', name: '双生同源', emoji: '♊', grade: 'R',
      sameSpecies: true, sameCount: 2,
      desc: '同源双灵同阵，气血共鸣。该灵兽攻击 +6%。',
      effects: { atk: 0.06 },
      color: '#3b7dd8'
    },
    {
      id: 'full_species', name: '三兽同心', emoji: '🔱', grade: 'UR',
      members: ['white_tiger', 'yellow_ox', 'dawn_chicken'],
      requireDistinct: true, requireCount: 3,
      desc: '三系齐聚且互不重复，攻守治疗各司其职。额外获得：治疗量 +15%、速度 +8%。',
      effects: { healBonus: 0.15, spd: 0.08 },
      color: '#a0399e'
    }
  ];

  /* =====================================================================
   * §14 灵兽繁育
   * 玩法：两只需要 ≥30 级的灵兽献出魂力，孵化出新一代灵兽。
   *      子代星级 = round(双亲平均星) + 概率加成；物种按权重继承。
   *      每日 1 次免费，超出消耗灵玉。
   * =================================================================== */
  D.BREED = {
    id: 'breed',
    name: '灵兽繁育',
    emoji: '🥚',
    minLevel: 30,
    dailyFreeTimes: 1,
    costGem: 300,
    /** 星级继承：平均值向下取整 + 加成概率 */
    bonusStarChance: 0.28,
    /** 物种继承权重 */
    speciesWeight: { sameAsA: 0.42, sameAsB: 0.42, mutated: 0.16 },
    mutatePool: ['white_tiger', 'yellow_ox', 'dawn_chicken'],
    /** 子代初始等级 */
    childLevel: 5,
    /** 子代天赋加成（洗髓点数，0-20，双亲等级越高越容易出高天赋） */
    talentRoll: function (lvA, lvB) {
      var base = Math.min(18, Math.floor((lvA + lvB) / 12));
      return Math.floor(Math.random() * (base + 3));
    },
    lore: '把两只灵兽的魂力放进同一枚茧里，睡上三日。醒来时，茧会告诉你答案。'
  };

  /* =====================================================================
   * §15 每日委托
   * 玩法：5 项个人日常，完成度 3/5 领小奖、5/5 领大奖。
   *      与「家族任务」互补：家族任务产出贡献，每日委托产出灵玉与材料。
   * =================================================================== */
  D.DAILY = {
    tasks: [
      { id: 'login',   name: '每日签到',     desc: '在主城点击每日签到',       need: 1, emoji: '📅', reward: { gem: 30 } },
      { id: 'levelup', name: '培育灵兽',     desc: '完成 3 次灵兽升级',        need: 3, emoji: '⬆️', reward: { gold: 1200 } },
      { id: 'battle',  name: '实战演练',     desc: '赢得 3 场战斗',            need: 3, emoji: '⚔️', reward: { exp_pill: 2 } },
      { id: 'donate',  name: '家族贡献',     desc: '向家族捐献 1 次',          need: 1, emoji: '🏵️', reward: { contrib: 60 } },
      { id: 'tower',   name: '挑战试炼塔',   desc: '完成 1 次试炼塔挑战',      need: 1, emoji: '🗼', reward: { soul_shard: 15 } }
    ],
    milestones: [
      { need: 3, name: '勤勉之证', reward: { gem: 60, gold: 2000 } },
      { need: 5, name: '圆满之证', reward: { gem: 200, item: 'skill_book' } }
    ]
  };

  /* =====================================================================
   * §16 宣传海报（首屏轮播横幅）
   * 海报的视觉配置与插画位于独立模块，便于「论坛首页」与「灵兽世界」
   * 共用同一套素材，避免重复维护：
   *     assets/js/ui/poster-art.js  → 矢量插画（QMPosterArt）
   *     assets/js/ui/poster.js      → 轮播组件与海报文案（QMPoster）
   *     assets/css/poster.css       → 响应式样式（全作用域隔离）
   * 若需在游戏内覆盖文案，运行时调用：
   *     QMPoster.configure({ posters: [...] })
   * =================================================================== */
  D.POSTER_AUTOPLAY_MS = 6500;

  /* 新增排行榜类型（追加，不覆盖原有 4 种） */
  D.RANK_TYPES = D.RANK_TYPES.concat([
    { id: 'tower', name: '试炼塔榜', emoji: '🗼', desc: '按最高到达层数排序' }
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
