/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 全局数值配置
 * 所有可调数值集中在此文件，运营调参不需要改逻辑代码。
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var D = (Q.DATA = {});

  /* ---------------------------------------------------------------------
   * 0. 存档版本（结构变更时 +1，store.js 会执行迁移）
   * ------------------------------------------------------------------- */
  D.SAVE_VERSION = 3;
  D.GAME_NAME = '灵兽家族';
  D.GAME_DOMAIN = 'qmhub.cc.cd';

  /* ---------------------------------------------------------------------
   * 1. 基础公式系数
   * ------------------------------------------------------------------- */
  D.FORMULA = {
    levelGrowth: 0.115,        // 每级线性成长 11.5%
    starBonus: 0.08,           // 每星 +8% 全属性
    intimacyMax: 100,          // 亲密度上限
    intimacyBonus: 0.0015,     // 每点亲密度 +0.15% 全属性
    defConst: 420,             // 防御减伤常数 减伤率 = def/(def+K)
    defPerLevel: 6,            // 防御常数随等级成长
    damageVariance: 0.06,      // 伤害浮动 ±6%
    levelExpBase: 120,         // 升到 L+1 所需经验 = base * L^1.45
    levelExpPow: 1.45,
    maxLevel: 60,
    maxStar: 5,
    critCap: 0.85,
    dodgeCap: 0.45,
    energyMax: 100,
    energyOnAct: 20,           // 自己行动 +20 怒气
    energyOnHit: 10,           // 受到伤害 +10 怒气
    breakEvery: 10,            // 每 10 级一次突破
    roundLimit: 30             // 战斗最大回合（防死循环）
  };

  /* ---------------------------------------------------------------------
   * 2. 品质 / 星阶
   * ------------------------------------------------------------------- */
  D.RARITY = {
    R: { id: 'R', name: '凡品', color: '#8a8f98', starCap: 3 },
    SR: { id: 'SR', name: '灵品', color: '#3b7dd8', starCap: 4 },
    SSR: { id: 'SSR', name: '神品', color: '#b8860b', starCap: 5 },
    UR: { id: 'UR', name: '太古', color: '#a0399e', starCap: 5 }
  };

  /* ---------------------------------------------------------------------
   * 3. 成长阶段（进化）
   * ------------------------------------------------------------------- */
  D.STAGES = [
    { id: 0, name: '幼崽', minLevel: 1, maxLevel: 19, mul: 1.00, color: '#9aa7b0', cost: 0, hex: '#c9d4da' },
    { id: 1, name: '成长', minLevel: 20, maxLevel: 39, mul: 1.12, color: '#4c9a6a', cost: 0, hex: '#a8d5b5' },
    { id: 2, name: '成年', minLevel: 40, maxLevel: 54, mul: 1.26, color: '#3b7dd8', cost: 0, hex: '#9dbcf0' },
    { id: 3, name: '觉醒', minLevel: 55, maxLevel: 60, mul: 1.45, color: '#b8860b', cost: 0, hex: '#f0d493' }
  ];

  /* ---------------------------------------------------------------------
   * 4. 技能池
   *   type: normal | active | ultimate | passive
   *   cost: 怒气消耗   cd: 冷却回合
   *   effects: 见 engine.js 的 applyEffect
   * ------------------------------------------------------------------- */
  D.SKILLS = {
    /* ===== 白虎 · 裂风之牙 · 单体爆发 / 流血 ===== */
    wt_normal: {
      id: 'wt_normal', name: '撕咬', type: 'normal', cost: 0, cd: 0, icon: '🦷',
      desc: '对单体造成 100% 攻击的物理伤害，自身获得 20 点怒气。',
      effects: [{ kind: 'damage', target: 'enemy_single', ratio: 1.0, school: '物理' }]
    },
    wt_s1: {
      id: 'wt_s1', name: '裂风爪', type: 'active', cost: 30, cd: 2, icon: '🐾',
      desc: '对单体造成 165% 攻击伤害，并附加【流血】，持续 3 回合（每回合损失施法者 35% 攻击的生命）。',
      effects: [
        { kind: 'damage', target: 'enemy_single', ratio: 1.65, school: '物理' },
        { kind: 'debuff', target: 'enemy_single', buff: 'bleed', turns: 3, value: 0.35, atkScale: true }
      ]
    },
    wt_s2: {
      id: 'wt_s2', name: '虎啸山林', type: 'active', cost: 50, cd: 3, icon: '📣',
      desc: '对敌方全体造成 95% 攻击伤害，并使全体敌人攻击力降低 18%，持续 2 回合。',
      effects: [
        { kind: 'damage', target: 'enemy_all', ratio: 0.95, school: '物理' },
        { kind: 'debuff', target: 'enemy_all', buff: 'atk_down', turns: 2, value: 0.18 }
      ]
    },
    wt_ult: {
      id: 'wt_ult', name: '百兽震惶', type: 'ultimate', cost: 100, cd: 0, icon: '👑',
      desc: '对敌方全体造成 220% 攻击伤害；对生命低于 50% 的目标伤害提升 40%，并刷新【流血】。',
      effects: [
        { kind: 'damage', target: 'enemy_all', ratio: 2.20, school: '物理', executeBonus: { below: 0.5, bonus: 0.4 } },
        { kind: 'debuff', target: 'enemy_all', buff: 'bleed', turns: 3, value: 0.45, atkScale: true }
      ]
    },
    wt_p: {
      id: 'wt_p', name: '猎杀本能', type: 'passive', cost: 0, cd: 0, icon: '🎯',
      desc: '被动：暴击率 +20%，暴击伤害 +25%；击杀目标后立刻获得 30 点怒气。',
      passive: { crit: 0.20, critDmg: 0.25, rageOnKill: 30 }
    },

    /* ===== 黄牛 · 撼地重犁 · 坦克 / 反伤 ===== */
    ox_normal: {
      id: 'ox_normal', name: '铁蹄', type: 'normal', cost: 0, cd: 0, icon: '🦶',
      desc: '对单体造成 100% 攻击伤害，自身获得 20 点怒气。',
      effects: [{ kind: 'damage', target: 'enemy_single', ratio: 1.0, school: '物理' }]
    },
    ox_s1: {
      id: 'ox_s1', name: '蛮牛冲撞', type: 'active', cost: 30, cd: 2, icon: '💥',
      desc: '对单体造成 150% 攻击伤害，80% 概率使目标【眩晕】1 回合，并强制其仇恨转向自己。',
      effects: [
        { kind: 'damage', target: 'enemy_single', ratio: 1.5, school: '物理' },
        { kind: 'debuff', target: 'enemy_single', buff: 'stun', turns: 1, chance: 0.8 },
        { kind: 'buff', target: 'self', buff: 'taunt', turns: 2 }
      ]
    },
    ox_s2: {
      id: 'ox_s2', name: '厚土护体', type: 'active', cost: 50, cd: 3, icon: '🛡️',
      desc: '为自身附加相当于 260% 攻击 + 12% 最大生命的护盾；护盾存在期间反弹 25% 受到的伤害。',
      effects: [
        { kind: 'shield', target: 'self', ratio: 2.6, hpRatio: 0.12 },
        { kind: 'buff', target: 'self', buff: 'reflect', turns: 3, value: 0.25 },
        { kind: 'buff', target: 'self', buff: 'def_up', turns: 3, value: 0.25 }
      ]
    },
    ox_ult: {
      id: 'ox_ult', name: '天崩地裂', type: 'ultimate', cost: 100, cd: 0, icon: '⛰️',
      desc: '对敌方全体造成 170% 攻击伤害，并使全体敌人防御降低 30%，持续 3 回合；自身回复 15% 最大生命。',
      effects: [
        { kind: 'damage', target: 'enemy_all', ratio: 1.70, school: '物理' },
        { kind: 'debuff', target: 'enemy_all', buff: 'def_down', turns: 3, value: 0.30 },
        { kind: 'heal', target: 'self', ratio: 0, hpRatio: 0.15 }
      ]
    },
    ox_p: {
      id: 'ox_p', name: '磐石之躯', type: 'passive', cost: 0, cd: 0, icon: '🪨',
      desc: '被动：受到的所有伤害降低 18%；每次受到攻击有 35% 概率反击 60% 攻击伤害。',
      passive: { damageReduce: 0.18, counter: { chance: 0.35, ratio: 0.6 } }
    },

    /* ===== 鸡 · 司晨金羽 · 治疗 / 增益 ===== */
    ck_normal: {
      id: 'ck_normal', name: '利喙', type: 'normal', cost: 0, cd: 0, icon: '🐤',
      desc: '对单体造成 100% 攻击伤害，自身获得 20 点怒气。',
      effects: [{ kind: 'damage', target: 'enemy_single', ratio: 1.0, school: '法术' }]
    },
    ck_s1: {
      id: 'ck_s1', name: '啄目', type: 'active', cost: 30, cd: 2, icon: '👁️',
      desc: '对单体造成 135% 攻击伤害，使目标命中降低 25%、闪避降低 15%，持续 2 回合。',
      effects: [
        { kind: 'damage', target: 'enemy_single', ratio: 1.35, school: '法术' },
        { kind: 'debuff', target: 'enemy_single', buff: 'hit_down', turns: 2, value: 0.25 }
      ]
    },
    ck_s2: {
      id: 'ck_s2', name: '晨曦鼓舞', type: 'active', cost: 50, cd: 3, icon: '🌅',
      desc: '治疗全体友方（相当于施法者 110% 攻击 + 8% 目标最大生命），并提升全体攻击 15%，持续 3 回合。',
      effects: [
        { kind: 'heal', target: 'ally_all', ratio: 1.10, hpRatio: 0.08 },
        { kind: 'buff', target: 'ally_all', buff: 'atk_up', turns: 3, value: 0.15 }
      ]
    },
    ck_ult: {
      id: 'ck_ult', name: '金鸡报晓', type: 'ultimate', cost: 100, cd: 0, icon: '🌟',
      desc: '驱散全体友方的减益，治疗全体（180% 攻击 + 15% 最大生命），并复活 1 名已阵亡队友（50% 生命）。',
      effects: [
        { kind: 'cleanse', target: 'ally_all' },
        { kind: 'heal', target: 'ally_all', ratio: 1.80, hpRatio: 0.15 },
        { kind: 'revive', target: 'ally_dead', count: 1, hpRatio: 0.5 }
      ]
    },
    ck_p: {
      id: 'ck_p', name: '金羽庇佑', type: 'passive', cost: 0, cd: 0, icon: '🪶',
      desc: '被动：我方全体暴击伤害 +12%、治疗效果 +15%；每回合结束时为生命最低的友方回复 6% 最大生命。',
      passive: { teamCritDmg: 0.12, healBonus: 0.15, endTurnHeal: 0.06 }
    }
  };

  /* ---------------------------------------------------------------------
   * 5. 动物角色（宠物图鉴）
   * ------------------------------------------------------------------- */
  D.SPECIES = [
    {
      id: 'white_tiger', name: '白虎', title: '裂风之牙', emoji: '🐯',
      role: '输出', element: '金', rarity: 'SSR', elementColor: '#b8860b',
      obtain: ['活动·白虎降临（限时）', '灵兽召唤池 2.0%', '家族战赛季奖励'],
      intro: '西方七宿之灵，主杀伐。以极致的单体爆发与流血特化著称，是家族战破阵的第一把尖刀。',
      base: { hp: 620, atk: 98, def: 42, spd: 112, crit: 0.18, critDmg: 0.60, dodge: 0.08, hit: 1.0 },
      grow: { hp: 1.00, atk: 1.25, def: 0.85, spd: 0.9 },   // 成长倾向权重
      skills: ['wt_normal', 'wt_s1', 'wt_s2', 'wt_ult', 'wt_p'],
      palette: { main: '#e8e4dc', accent: '#b8860b', dark: '#2f3a44', glow: '#f6d78a' },
      strengths: ['单体爆发最高', '流血持续输出', '残血斩杀'],
      weakness: '生存能力偏弱，惧怕控制链与反伤阵容。'
    },
    {
      id: 'yellow_ox', name: '黄牛', title: '撼地重犁', emoji: '🐂',
      role: '坦克', element: '土', rarity: 'SR', elementColor: '#8b6a3f',
      obtain: ['新手赠送（三选一）', '灵兽召唤池 8.0%', '家族商店·贡献兑换'],
      intro: '神农之犁魂所化，厚土载物。全游戏最高生命与防御成长，嘲讽、护盾、反伤三位一体。',
      base: { hp: 980, atk: 66, def: 78, spd: 80, crit: 0.06, critDmg: 0.40, dodge: 0.04, hit: 1.0 },
      grow: { hp: 1.30, atk: 0.90, def: 1.30, spd: 0.85 },
      skills: ['ox_normal', 'ox_s1', 'ox_s2', 'ox_ult', 'ox_p'],
      palette: { main: '#d9a441', accent: '#7a5230', dark: '#3a2c1c', glow: '#f5d089' },
      strengths: ['全队最高坦度', '稳定控制', '护盾反伤'],
      weakness: '输出偏低，单挑强势但推图速度慢。'
    },
    {
      id: 'dawn_chicken', name: '鸡', title: '司晨金羽', emoji: '🐓',
      role: '辅助', element: '木', rarity: 'R', elementColor: '#4c9a6a',
      obtain: ['新手赠送（三选一）', '灵兽召唤池 15.0%', '签到第 3 天赠送'],
      intro: '司晨神禽，一声啼鸣破尽长夜。全队治疗、增益与驱散核心，被动还能在阵亡后逆转战局。',
      base: { hp: 700, atk: 72, def: 50, spd: 100, crit: 0.10, critDmg: 0.50, dodge: 0.06, hit: 1.0 },
      grow: { hp: 0.95, atk: 1.05, def: 0.95, spd: 1.15 },
      skills: ['ck_normal', 'ck_s1', 'ck_s2', 'ck_ult', 'ck_p'],
      palette: { main: '#f0e6d2', accent: '#d94f2b', dark: '#4a2c1a', glow: '#ffd9a0' },
      strengths: ['唯一群体复活', '全队增益', '消耗战之王'],
      weakness: '自身脆皮，需黄牛保护；无爆发手段。'
    }
  ];

  /* ---------------------------------------------------------------------
   * 6. 道具 / 货币
   * ------------------------------------------------------------------- */
  D.ITEMS = {
    gold:        { id: 'gold', name: '金币', emoji: '🪙', currency: true, desc: '通用货币，用于升级、突破、创建家族。' },
    gem:         { id: 'gem', name: '灵玉', emoji: '💎', currency: true, desc: '高级货币，用于召唤与加速。' },
    contrib:     { id: 'contrib', name: '家族贡献', emoji: '🏵️', currency: true, desc: '家族专属货币，捐金币 / 参加家族战获得。' },
    exp_pill:    { id: 'exp_pill', name: '灵兽经验丹', emoji: '🔵', desc: '使用后宠物获得 800 点经验。' },
    break_stone: { id: 'break_stone', name: '破境石', emoji: '💠', desc: '宠物每 10 级突破所需材料。' },
    soul_shard:  { id: 'soul_shard', name: '兽魂碎片', emoji: '🔷', desc: '升星材料，30 片可升 1 星。' },
    skill_book:  { id: 'skill_book', name: '技能秘典', emoji: '📕', desc: '提升指定技能 1 级。' },
    tender_grass:{ id: 'tender_grass', name: '嫩灵草', emoji: '🌿', desc: '提升宠物亲密度 +10。' },
    revive_feather:{ id: 'revive_feather', name: '还魂羽', emoji: '🪶', desc: '战斗中复活一只宠物（消耗品）。' }
  };

  D.SHOP = [
    { itemId: 'exp_pill',     cost: { gold: 500 },    limit: 20, desc: '日常经验来源' },
    { itemId: 'break_stone',  cost: { gold: 2000 },   limit: 10, desc: '突破必备' },
    { itemId: 'soul_shard',   cost: { gem: 60 },      limit: 10, desc: '升星必备' },
    { itemId: 'tender_grass', cost: { gold: 800 },    limit: 15, desc: '提升亲密度' },
    { itemId: 'skill_book',   cost: { gem: 200 },     limit: 3,  desc: '技能升级' },
    { itemId: 'revive_feather',cost:{ contrib: 300 }, limit: 5,  desc: '家族限定' }
  ];

  /* ---------------------------------------------------------------------
   * 7. 召唤池
   * ------------------------------------------------------------------- */
  D.GACHA = {
    singleCost: { gem: 120 },
    tenCost: { gem: 1080 },
    pool: [
      { speciesId: 'white_tiger',   rate: 0.02 },
      { speciesId: 'yellow_ox',     rate: 0.08 },
      { speciesId: 'dawn_chicken',  rate: 0.15 },
      { speciesId: 'yellow_ox',     rate: 0.20 },   // 重复即转兽魂碎片
      { speciesId: 'dawn_chicken',  rate: 0.55 }
    ],
    pity: 60,            // 60 抽保底白虎
    dupShard: 20         // 重复宠物转 20 兽魂碎片
  };

  /* ---------------------------------------------------------------------
   * 8. PVE 关卡
   * ------------------------------------------------------------------- */
  var CHAPTERS = [];
  var chapterNames = ['青丘试炼', '黑水沼泽', '赤炎荒漠', '雷泽深渊', '昆仑雪境', '归墟之海'];
  for (var c = 0; c < chapterNames.length; c++) {
    var stages = [];
    for (var s = 1; s <= 5; s++) {
      stages.push({
        idx: (c * 5) + s,
        name: chapterNames[c] + '·' + (s * 2) + '关',
        level: 4 + (c * 5 + s) * 3,
        enemyCount: s >= 4 ? 3 : (s >= 2 ? 2 : 1),
        reward: { gold: 200 + (c * 5 + s) * 90, exp: 120 + (c * 5 + s) * 70, item: s === 5 ? 'soul_shard' : (s % 2 === 0 ? 'exp_pill' : null) },
        boss: s === 5
      });
    }
    CHAPTERS.push({ id: c, name: chapterNames[c], stages: stages });
  }
  D.CHAPTERS = CHAPTERS;

  /* ---------------------------------------------------------------------
   * 9. 家族系统
   * ------------------------------------------------------------------- */
  D.FAMILY = {
    createCost: { gold: 5000 },
    nameMin: 2, nameMax: 8,
    baseMemberCap: 20,
    capPerLevel: 2,
    maxLevel: 10,
    levelExpBase: 1200,
    levelExpPow: 1.5,
    maxAllies: 2,                     // 最多 2 个盟友
    positions: [
      { id: 'leader',   name: '族长',   order: 0, canKick: true,  canWar: true,  canAlly: true,  canNotice: true },
      { id: 'vice',     name: '副族长', order: 1, canKick: true,  canWar: true,  canAlly: false, canNotice: true },
      { id: 'elder',    name: '长老',   order: 2, canKick: false, canWar: true,  canAlly: false, canNotice: false },
      { id: 'elite',    name: '精英',   order: 3, canKick: false, canWar: true,  canAlly: false, canNotice: false },
      { id: 'member',   name: '成员',   order: 4, canKick: false, canWar: false, canAlly: false, canNotice: false }
    ],
    /* 家族科技：每级累加效果 */
    techs: [
      { id: 'power',  name: '蛮荒之力', emoji: '⚔️', maxLevel: 10, effect: '宠物攻击 +1.2%/级',  perLevel: { atk: 0.012 } },
      { id: 'tough',  name: '厚土之护', emoji: '🛡️', maxLevel: 10, effect: '宠物生命 +1.2%/级',  perLevel: { hp: 0.012 } },
      { id: 'swift',  name: '疾风之息', emoji: '💨', maxLevel: 10, effect: '宠物速度 +0.8%/级',  perLevel: { spd: 0.008 } },
      { id: 'fortune',name: '聚宝之阵', emoji: '💰', maxLevel: 10, effect: '战斗金币 +2.5%/级',  perLevel: { gold: 0.025 } }
    ],
    techCost: function (lv) { return { contrib: 400 + lv * 220, gold: 2000 + lv * 900 }; },
    /* 家族等级带来的宠物属性加成（全族共享） */
    levelBuff: function (lv) { return 1 + (lv - 1) * 0.015; },   // 每级 +1.5%
    /* 家族日常任务 */
    quests: [
      { id: 'fq_donate',  name: '家族捐献', desc: '向家族金库捐献 1000 金币', need: 1, reward: { contrib: 40, gold: 300 } },
      { id: 'fq_train',   name: '共同修行', desc: '完成 3 次宠物升级', need: 3, reward: { contrib: 60, item: 'exp_pill' } },
      { id: 'fq_battle',  name: '竞技试炼', desc: '赢得 2 场战斗', need: 2, reward: { contrib: 80, gold: 800 } },
      { id: 'fq_war',     name: '家族荣耀', desc: '参加 1 次家族战', need: 1, reward: { contrib: 150, item: 'soul_shard' } }
    ],
    /* 家族战 */
    war: {
      cost: 100,                 // 发起消耗行动令
      winScore: 3, loseScore: 0, drawScore: 1,
      rewardPerScore: { contrib: 120, gold: 1500 },
      seasonDays: 7,
      ranks: [
        { min: 0,   name: '散修',   emoji: '🥚' },
        { min: 20,  name: '铜鳞盟', emoji: '🥉' },
        { min: 60,  name: '银鳞盟', emoji: '🥈' },
        { min: 120, name: '金鳞盟', emoji: '🥇' },
        { min: 220, name: '天罡盟', emoji: '👑' }
      ]
    },
    /* 联盟协作任务（世界 BOSS） */
    allianceBoss: {
      name: '九头相柳',
      maxHp: 100000,
      playerDamageBonus: 1,       // 玩家伤害直接计入
      tasks: [
        { id: 'ab_dmg', name: '集火相柳', desc: '联盟累计造成伤害达到 30% 血量', threshold: 0.30, reward: { contrib: 300, gem: 80 } },
        { id: 'ab_kill', name: '讨伐魔首', desc: '联盟击杀九头相柳', threshold: 1.00, reward: { contrib: 800, item: 'soul_shard', gem: 200 } }
      ]
    }
  };

  /* ---------------------------------------------------------------------
   * 10. 排行榜配置
   * ------------------------------------------------------------------- */
  D.RANK_TYPES = [
    { id: 'power',  name: '战力榜',   emoji: '⚔️', desc: '按玩家最高战力队伍排序' },
    { id: 'family', name: '家族榜',   emoji: '🏯', desc: '按家族等级与家族战力排序' },
    { id: 'contrib',name: '贡献榜',   emoji: '🏵️', desc: '按本周家族贡献排序' },
    { id: 'war',    name: '家族战胜场榜', emoji: '🎖️', desc: '按本赛季家族战胜场排序' }
  ];

  /* ---------------------------------------------------------------------
   * 11. 工具函数
   * ------------------------------------------------------------------- */
  D.getSpecies = function (id) {
    for (var i = 0; i < D.SPECIES.length; i++) if (D.SPECIES[i].id === id) return D.SPECIES[i];
    return null;
  };
  D.getSkill = function (id) { return D.SKILLS[id] || null; };
  D.getStage = function (level) {
    for (var i = D.STAGES.length - 1; i >= 0; i--) if (level >= D.STAGES[i].minLevel) return D.STAGES[i];
    return D.STAGES[0];
  };
  D.expToNext = function (level) {
    return Math.floor(D.FORMULA.levelExpBase * Math.pow(level, D.FORMULA.levelExpPow));
  };
  D.familyExpToNext = function (level) {
    return Math.floor(D.FAMILY.levelExpBase * Math.pow(level, D.FAMILY.levelExpPow));
  };
  D.rankOfWarScore = function (score) {
    var r = D.FAMILY.war.ranks[0];
    for (var i = 0; i < D.FAMILY.war.ranks.length; i++) if (score >= D.FAMILY.war.ranks[i].min) r = D.FAMILY.war.ranks[i];
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
