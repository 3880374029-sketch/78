/* =========================================================================
 * qmhub.cc.cd · 灵兽家族 · 回合制战斗引擎 (Battle Engine)
 * ---------------------------------------------------------------------
 * 纯函数式模拟：输入双方阵容，输出完整战斗回放时间轴(timeline)。
 * 前端按 timeline 播放动画；后端也可直接复用同一份逻辑做服务端校验
 * （把本文件原样 require 进 Node 即可，无 DOM 依赖）。
 *
 * 战斗规则：
 *   1. 每回合按速度降序行动
 *   2. 怒气：自身行动 +20，受到伤害 +10，上限 100
 *   3. 技能分 普通/主动(消耗怒气+冷却)/终极(100怒气)/被动
 *   4. 伤害 = 攻击×系数×(1-防御减伤)×暴击×浮动×(1-减伤)
 *   5. 30 回合上限，超出按剩余生命百分比判定
 * ========================================================================= */
(function (root) {
  'use strict';
  var Q = (root.QMHUB = root.QMHUB || {});
  var D = Q.DATA, F = D.FORMULA, S = Q.Store;

  var BUFF_DEF = {
    atk_up:    { name: '攻击提升', icon: '🔺', good: true,  stat: 'atk' },
    atk_down:  { name: '攻击降低', icon: '🔻', good: false, stat: 'atk' },
    def_up:    { name: '防御提升', icon: '🛡️', good: true,  stat: 'def' },
    def_down:  { name: '防御降低', icon: '💔', good: false, stat: 'def' },
    spd_up:    { name: '速度提升', icon: '💨', good: true,  stat: 'spd' },
    hit_down:  { name: '命中降低', icon: '🌫️', good: false, stat: 'hit' },
    bleed:     { name: '流血',     icon: '🩸', good: false, dot: true },
    stun:      { name: '眩晕',     icon: '💫', good: false, control: true },
    shield:    { name: '护盾',     icon: '🔰', good: true,  shield: true },
    reflect:   { name: '反伤',     icon: '🪞', good: true },
    taunt:     { name: '嘲讽',     icon: '🎯', good: true }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function round(n) { return Math.round(n); }

  /* ------------------------------------------------------------------ 单位构建 */
  function buildUnit(pet, side, idx, family, bonds) {
    var st = S.computeStats(pet, { family: family, bonds: bonds || {} });
    if (pet.bossMul) {                       // 试炼塔首领层强化
      st.hp = Math.round(st.hp * pet.bossMul);
      st.atk = Math.round(st.atk * pet.bossMul);
      st.def = Math.round(st.def * pet.bossMul);
    }
    var sp = D.getSpecies(pet.speciesId);
    var skills = sp.skills.map(function (sid, i) {
      return { def: D.getSkill(sid), level: pet.skillLevels[i] || 1, index: i };
    });
    var u = {
      uid: pet.uid + '_' + side + idx,
      petUid: pet.uid,
      name: pet.nickname,
      speciesId: pet.speciesId,
      emoji: sp.emoji,
      palette: sp.palette,
      side: side,
      slot: idx,
      level: pet.level,
      star: pet.star,
      boss: !!pet.boss,
      maxHp: st.hp,
      hp: st.hp,
      base: st,
      skills: skills,
      energy: 30,
      cds: {},
      buffs: [],
      shield: 0,
      alive: true,
      revived: false,
      passive: collectPassive(skills)
    };
    return u;
  }

  function collectPassive(skills) {
    var p = { crit: 0, critDmg: 0, damageReduce: 0, healBonus: 0, rageOnKill: 0, counter: null, endTurnHeal: 0, teamCritDmg: 0 };
    skills.forEach(function (s) {
      if (!s.def || !s.def.passive) return;
      var scale = 1 + 0.05 * (s.level - 1);
      var sp = s.def.passive;
      if (sp.crit) p.crit += sp.crit * scale;
      if (sp.critDmg) p.critDmg += sp.critDmg * scale;
      if (sp.damageReduce) p.damageReduce += sp.damageReduce * scale;
      if (sp.healBonus) p.healBonus += sp.healBonus * scale;
      if (sp.rageOnKill) p.rageOnKill += sp.rageOnKill;
      if (sp.counter) p.counter = { chance: sp.counter.chance, ratio: sp.counter.ratio };
      if (sp.endTurnHeal) p.endTurnHeal += sp.endTurnHeal * scale;
      if (sp.teamCritDmg) p.teamCritDmg += sp.teamCritDmg * scale;
    });
    return p;
  }

  function effStat(u, key) {
    var base = u.base[key] || 0;
    if (key === 'hp') return u.maxHp;
    var up = 0, down = 0;
    u.buffs.forEach(function (b) {
      var def = BUFF_DEF[b.id];
      if (!def || def.stat !== key) return;
      if (def.good) up += b.value; else down += b.value;
    });
    return Math.max(0, base * (1 + up - down));
  }

  /* ------------------------------------------------------------------ 伤害计算 */
  function calcDamage(attacker, target, ratio, opts, ctx) {
    opts = opts || {};
    var atk = effStat(attacker, 'atk');
    var raw = atk * ratio;

    // 斩杀增伤
    if (opts.executeBonus && target.hp / target.maxHp < opts.executeBonus.below) {
      raw *= (1 + opts.executeBonus.bonus);
    }
    var defConst = F.defConst + F.defPerLevel * attacker.level;
    var def = effStat(target, 'def');
    var dmg = raw * (defConst / (defConst + def));

    // 命中 / 闪避
    var hitRate = clamp(effStat(attacker, 'hit') * (1 - buffValue(target, 'hit_down')), 0.55, 1.5);
    var dodge = target.base.dodge;
    if (Math.random() > clamp(hitRate - dodge, 0.35, 1)) {
      return { miss: true, dmg: 0 };
    }
    // 暴击
    var crit = false;
    var teamCritDmg = ctx ? ctx.teamCritDmg : 0;
    if (Math.random() < clamp(attacker.base.crit + attacker.passive.crit, 0, F.critCap)) {
      crit = true;
      dmg *= 1 + attacker.base.critDmg + attacker.passive.critDmg + teamCritDmg;
    }
    // 浮动
    dmg *= 1 + rand(-F.damageVariance, F.damageVariance);
    // 目标减伤
    dmg *= (1 - clamp(target.base.damageReduce + target.passive.damageReduce, 0, 0.75));
    dmg = Math.max(1, round(dmg));
    return { miss: false, dmg: dmg, crit: crit };
  }

  function buffValue(u, id) {
    var v = 0;
    u.buffs.forEach(function (b) { if (b.id === id) v += b.value; });
    return v;
  }

  /* ------------------------------------------------------------------ 伤害落地 */
  function applyDamage(target, amount, ctx, source) {
    var actual = amount;
    if (target.shield > 0) {
      var absorbed = Math.min(target.shield, actual);
      target.shield -= absorbed;
      actual -= absorbed;
      if (target.shield <= 0) { target.shield = 0; removeBuff(target, 'shield'); }
    }
    target.hp = Math.max(0, target.hp - actual);
    target.energy = Math.min(F.energyMax, target.energy + F.energyOnHit);
    ctx.timeline.push({ type: 'damage', target: target.uid, amount: actual, hp: target.hp, at: ctx.tick++ });
    if (target.hp <= 0) { target.alive = false; ctx.timeline.push({ type: 'death', unit: target.uid, name: target.name, at: ctx.tick++ }); }
    return actual;
  }

  function healUnit(target, amount, ctx) {
    if (!target.alive) return 0;
    var before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + round(amount));
    var healed = target.hp - before;
    ctx.timeline.push({ type: 'heal', target: target.uid, amount: healed, hp: target.hp, at: ctx.tick++ });
    return healed;
  }

  function addBuff(u, buff, ctx) {
    if (!u.alive) return;
    // 同名 buff 刷新回合数，不叠加数值（除 bleed 可叠加层数）
    if (buff.id === 'bleed') {
      u.buffs.push({ id: 'bleed', turns: buff.turns, value: buff.value, sourceAtk: buff.sourceAtk });
      ctx.timeline.push({ type: 'buff', target: u.uid, buff: 'bleed', at: ctx.tick++ });
      return;
    }
    var exist = null;
    u.buffs.forEach(function (b) { if (b.id === buff.id) exist = b; });
    if (exist) { exist.turns = Math.max(exist.turns, buff.turns); exist.value = Math.max(exist.value || 0, buff.value || 0); }
    else u.buffs.push(buff);
    ctx.timeline.push({ type: 'buff', target: u.uid, buff: buff.id, at: ctx.tick++ });
  }
  function removeBuff(u, id) { u.buffs = u.buffs.filter(function (b) { return b.id !== id; }); }

  /* ------------------------------------------------------------------ 技能释放 */
  function skillLevelMul(s) { return 1 + 0.06 * (s.level - 1); }

  function aliveOf(list) { return list.filter(function (u) { return u.alive; }); }

  function selectTargets(effect, caster, allies, enemies) {
    var enemyAlive = aliveOf(enemies);
    var allyAlive = aliveOf(allies);
    // 嘲讽：敌方有 taunt 单位时单体技能强制打嘲讽者
    var taunter = enemyAlive.find(function (u) { return buffValue(u, 'taunt') > 0 || u.buffs.some(function (b) { return b.id === 'taunt'; }); });
    switch (effect.target) {
      case 'enemy_single':
        if (taunter) return [taunter];
        if (!enemyAlive.length) return [];
        return [lowestHp(enemyAlive, caster)];
      case 'enemy_all': return enemyAlive;
      case 'enemy_random': return enemyAlive.length ? [enemyAlive[Math.floor(Math.random() * enemyAlive.length)]] : [];
      case 'ally_all': return allyAlive;
      case 'ally_single': return allyAlive.length ? [lowestHp(allyAlive)] : [];
      case 'ally_dead': return allies.filter(function (u) { return !u.alive; });
      case 'self': return caster.alive ? [caster] : [];
      default: return [caster];
    }
  }
  function lowestHp(list, exclude) {
    var best = null;
    list.forEach(function (u) {
      if (exclude && u.uid === exclude.uid) return;
      if (!best) { best = u; return; }
      if (u.hp / u.maxHp < best.hp / best.maxHp) best = u;
    });
    return best || list[0];
  }

  function castSkill(u, skill, ctx) {
    var allies = u.side === 'ally' ? ctx.allies : ctx.enemies;
    var enemies = u.side === 'ally' ? ctx.enemies : ctx.allies;
    var events = [];

    ctx.timeline.push({ type: 'cast', unit: u.uid, name: u.name, skill: skill.def.name, skillId: skill.def.id, icon: skill.def.icon, kind: skill.def.type, at: ctx.tick++ });
    events.push({ kind: 'tele', text: u.name + ' 施展【' + skill.def.name + '】' });

    (skill.def.effects || []).forEach(function (eff) {
      var targets = selectTargets(eff, u, allies, enemies);
      if (!targets || !targets.length) return;

      if (eff.kind === 'damage') {
        targets.forEach(function (t) {
          var r = calcDamage(u, t, eff.ratio * skillLevelMul(skill), eff, ctx);
          if (r.miss) { ctx.timeline.push({ type: 'miss', target: t.uid, at: ctx.tick++ }); return; }
          var dealt = applyDamage(t, r.dmg, ctx, u);
          events.push({ kind: 'dmg', target: t.uid, dmg: dealt, crit: r.crit });
          // 反伤
          if (buffValue(t, 'reflect') > 0) {
            var back = round(dealt * buffValue(t, 'reflect'));
            if (back > 0) applyDamage(u, back, ctx, t);
          }
          // 反击被动
          if (t.passive.counter && t.alive && Math.random() < t.passive.counter.chance) {
            var cr = calcDamage(t, u, t.passive.counter.ratio, {}, ctx);
            if (!cr.miss) applyDamage(u, cr.dmg, ctx, t);
          }
          if (!u.alive) return;
        });
      } else if (eff.kind === 'heal') {
        var bonus = 1 + u.passive.healBonus + u.base.healBonus;
        targets.forEach(function (t) {
          if (!t.alive) return;
          var amt = (eff.ratio ? effStat(u, 'atk') * eff.ratio * skillLevelMul(skill) : 0) + (eff.hpRatio ? t.maxHp * eff.hpRatio : 0);
          healUnit(t, amt * bonus, ctx);
        });
      } else if (eff.kind === 'shield') {
        targets.forEach(function (t) {
          var amt = round(effStat(u, 'atk') * (eff.ratio || 0) * skillLevelMul(skill) + (eff.hpRatio ? t.maxHp * eff.hpRatio : 0));
          t.shield += amt;
          addBuff(t, { id: 'shield', turns: 3, value: amt });
        });
      } else if (eff.kind === 'buff') {
        targets.forEach(function (t) {
          if (eff.chance !== undefined && Math.random() > eff.chance) return;
          addBuff(t, { id: eff.buff, turns: eff.turns || 2, value: eff.value || 0 });
        });
      } else if (eff.kind === 'debuff') {
        targets.forEach(function (t) {
          if (eff.chance !== undefined && Math.random() > eff.chance) return;
          addBuff(t, {
            id: eff.buff, turns: eff.turns || 2, value: eff.value || 0,
            sourceAtk: eff.atkScale ? effStat(u, 'atk') * (eff.value || 0) : 0
          });
        });
      } else if (eff.kind === 'cleanse') {
        targets.forEach(function (t) {
          t.buffs = t.buffs.filter(function (b) { return BUFF_DEF[b.id] && BUFF_DEF[b.id].good; });
          ctx.timeline.push({ type: 'cleanse', target: t.uid, at: ctx.tick++ });
        });
      } else if (eff.kind === 'revive') {
        targets.slice(0, eff.count || 1).forEach(function (t) {
          if (t.alive) return;
          t.alive = true;
          t.hp = round(t.maxHp * (eff.hpRatio || 0.5));
          t.revived = true;
          t.energy = 0;
          t.buffs = [];
          ctx.timeline.push({ type: 'revive', unit: t.uid, name: t.name, hp: t.hp, at: ctx.tick++ });
          events.push({ kind: 'revive', text: t.name + ' 被复活！' });
        });
      }

      // 击杀奖励怒气
      if (u.passive.rageOnKill) {
        enemies.forEach(function (e) {
          if (!e.alive && !e.__ragePayed) { e.__ragePayed = true; u.energy = Math.min(F.energyMax, u.energy + u.passive.rageOnKill); }
        });
      }
    });

    // 怒气结算
    if (skill.def.type === 'ultimate') u.energy = 0;
    else u.energy = Math.min(F.energyMax, u.energy + F.energyOnAct);
    if (skill.def.cd > 0) u.cds[skill.def.id] = skill.def.cd;

    return events;
  }

  /* ------------------------------------------------------------------ AI 决策 */
  function chooseSkill(u) {
    var usable = u.skills.filter(function (s) {
      if (!s.def || !s.def.effects) return false;
      if ((u.cds[s.def.id] || 0) > 0) return false;
      if (s.def.cost > u.energy) return false;
      return true;
    });
    var ult = usable.find(function (s) { return s.def.type === 'ultimate'; });
    var actives = usable.filter(function (s) { return s.def.type === 'active'; });

    // 治疗角色：若无伤则不浪费治疗
    actives.sort(function (a, b) { return b.def.cost - a.def.cost; });
    if (ult) return ult;
    if (actives.length) {
      var a = actives[0];
      // 治疗类技能仅在队友受伤>25% 时使用
      var isHeal = (a.def.effects || []).some(function (e) { return e.kind === 'heal' || e.kind === 'revive'; });
      if (isHeal) {
        var allies = u.side === 'ally' ? u.__allies : u.__enemies;
        var wounded = allies.some(function (x) { return x.alive && x.hp / x.maxHp < 0.75; });
        var dead = allies.some(function (x) { return !x.alive; });
        if (!wounded && !dead) { actives.shift(); }
      }
    }
    if (actives.length) return actives[0];
    return u.skills.find(function (s) { return s.def && s.def.type === 'normal'; });
  }

  /* ------------------------------------------------------------------ 主流程 */
  function run(opts) {
    var allies = opts.allies.map(function (p, i) { return buildUnit(p, 'ally', i, opts.family, opts.bonds || {}); });
    var enemies = opts.enemies.map(function (p, i) { return buildUnit(p, 'enemy', i, opts.enemyFamily || null, {}); });

    // 队伍级被动（如鸡的全体暴击伤害）
    var teamCritDmg = allies.reduce(function (a, u) { return a + u.passive.teamCritDmg; }, 0);

    var ctx = { allies: allies, enemies: enemies, timeline: [], tick: 0, round: 0, teamCritDmg: teamCritDmg };
    allies.forEach(function (u) { u.__allies = allies; u.__enemies = enemies; });
    enemies.forEach(function (u) { u.__allies = enemies; u.__enemies = allies; });

    ctx.timeline.push({ type: 'start', at: ctx.tick++ });

    var maxRounds = F.roundLimit;
    for (var r = 1; r <= maxRounds; r++) {
      ctx.round = r;
      ctx.timeline.push({ type: 'round', round: r, at: ctx.tick++, state: snapshot(ctx) });

      var order = aliveOf(allies).concat(aliveOf(enemies)).sort(function (a, b) {
        var sa = effStat(a, 'spd') * (1 + rand(-0.05, 0.05));
        var sb = effStat(b, 'spd') * (1 + rand(-0.05, 0.05));
        return sb - sa;
      });

      for (var i = 0; i < order.length; i++) {
        var u = order[i];
        if (!u.alive) continue;
        // 控制检查
        if (buffValue(u, 'stun') > 0 || u.buffs.some(function (b) { return b.id === 'stun'; })) {
          ctx.timeline.push({ type: 'stunned', unit: u.uid, name: u.name, at: ctx.tick++ });
          continue;
        }
        var skill = chooseSkill(u);
        if (!skill) continue;
        castSkill(u, skill, ctx);
        if (isOver(ctx)) break;
      }

      // 回合结束结算
      tickEndOfRound(ctx);
      if (isOver(ctx)) break;
    }

    var result = judge(ctx);
    ctx.timeline.push({ type: 'end', win: result.win, draw: result.draw, at: ctx.tick++, state: snapshot(ctx) });

    return {
      win: result.win,
      draw: result.draw,
      rounds: ctx.round,
      timeline: ctx.timeline,
      allies: allies.map(publicUnit),
      enemies: enemies.map(publicUnit),
      totalDamage: { ally: sumDamage(ctx, 'ally'), enemy: sumDamage(ctx, 'enemy') },
      mvp: mvpOf(ctx)
    };
  }

  function tickEndOfRound(ctx) {
    var all = ctx.allies.concat(ctx.enemies);
    all.forEach(function (u) {
      if (!u.alive) return;
      // DOT
      u.buffs.forEach(function (b) {
        if (b.id === 'bleed') {
          var dmg = Math.max(1, round((b.sourceAtk || effStat(u, 'atk') * 0.3) * 0.35));
          applyDamage(u, dmg, ctx, null);
        }
      });
      // 被动回血
      if (u.passive.endTurnHeal > 0 && u.alive) {
        var allies = u.__allies;
        var low = lowestHp(aliveOf(allies));
        if (low) healUnit(low, low.maxHp * u.passive.endTurnHeal, ctx);
      }
      // buff 计时
      u.buffs = u.buffs.filter(function (b) {
        if (b.id === 'shield') return u.shield > 0;
        b.turns--;
        return b.turns > 0;
      });
      // cd 计时
      Object.keys(u.cds).forEach(function (k) { u.cds[k] = Math.max(0, u.cds[k] - 1); });
      // 怒气自然回复（每回合 +8，避免无技能可用）
      u.energy = Math.min(F.energyMax, u.energy + 8);
    });
  }

  function isOver(ctx) {
    return aliveOf(ctx.allies).length === 0 || aliveOf(ctx.enemies).length === 0;
  }
  function judge(ctx) {
    var a = aliveOf(ctx.allies).length, e = aliveOf(ctx.enemies).length;
    if (a > 0 && e === 0) return { win: true, draw: false };
    if (a === 0 && e > 0) return { win: false, draw: false };
    if (a === 0 && e === 0) return { win: false, draw: true };
    // 回合耗尽
    var ap = ctx.allies.reduce(function (s, u) { return s + u.hp / u.maxHp; }, 0);
    var ep = ctx.enemies.reduce(function (s, u) { return s + u.hp / u.maxHp; }, 0);
    if (Math.abs(ap - ep) < 0.05) return { win: false, draw: true };
    return { win: ap > ep, draw: false };
  }
  function publicUnit(u) {
    return { uid: u.uid, name: u.name, speciesId: u.speciesId, emoji: u.emoji, palette: u.palette, side: u.side, level: u.level, star: u.star, maxHp: u.maxHp, hp: u.hp, alive: u.alive, shield: u.shield, boss: u.boss, energy: u.energy };
  }
  function snapshot(ctx) {
    return {
      allies: ctx.allies.map(function (u) { return { uid: u.uid, hp: u.hp, maxHp: u.maxHp, shield: u.shield, energy: u.energy, alive: u.alive, buffs: u.buffs.map(briefBuff) }; }),
      enemies: ctx.enemies.map(function (u) { return { uid: u.uid, hp: u.hp, maxHp: u.maxHp, shield: u.shield, energy: u.energy, alive: u.alive, buffs: u.buffs.map(briefBuff) }; })
    };
  }
  function briefBuff(b) { return { id: b.id, turns: b.turns, icon: (BUFF_DEF[b.id] || {}).icon || '❔', name: (BUFF_DEF[b.id] || {}).name || b.id }; }
  function sumDamage(ctx, side) {
    var total = 0;
    ctx.timeline.forEach(function (t) {
      if (t.type !== 'damage') return;
      var u = findIn(ctx, t.target);
      if (u && u.side !== side) total += t.amount;
    });
    return total;
  }
  function findIn(ctx, uid) {
    var all = ctx.allies.concat(ctx.enemies);
    for (var i = 0; i < all.length; i++) if (all[i].uid === uid) return all[i];
    return null;
  }
  function mvpOf(ctx) {
    var best = null, bestScore = -1;
    ctx.allies.forEach(function (u) {
      var score = (u.maxHp - u.hp) * 0 + 0;
      score = (1 - u.hp / u.maxHp) * 0 + u.maxHp * 0.05;
      // 简化：以输出贡献近似
      bestScore = bestScore;
    });
    // 用承受伤害 + 存活 粗略评估
    var dmgTaken = {};
    ctx.timeline.forEach(function (t) { if (t.type === 'damage') dmgTaken[t.target] = (dmgTaken[t.target] || 0) + t.amount; });
    ctx.allies.forEach(function (u) {
      var s = (u.alive ? 1000 : 0) + (dmgTaken[u.uid] || 0) * 0.1 + u.maxHp * 0.02;
      if (s > bestScore) { bestScore = s; best = u; }
    });
    return best ? { name: best.name, emoji: best.emoji, uid: best.uid } : null;
  }

  /* ------------------------------------------------------------------ 导出 */
  Q.Battle = {
    run: run,
    buildUnit: buildUnit,
    BUFF_DEF: BUFF_DEF,
    /* 供 UI 播放用的文字化 */
    describe: function (evt, unitMap) {
      function nm(uid) { var u = unitMap[uid]; return u ? u.name : '??'; }
      switch (evt.type) {
        case 'start': return '⚔️ 战斗开始！';
        case 'round': return '—— 第 ' + evt.round + ' 回合 ——';
        case 'cast': return '▶ ' + evt.name + ' 使用 ' + evt.icon + '【' + evt.skill + '】';
        case 'damage': return '💥 ' + nm(evt.target) + ' 受到 ' + evt.amount + ' 点伤害（剩余 ' + evt.hp + '）';
        case 'heal': return '💚 ' + nm(evt.target) + ' 回复 ' + evt.amount + ' 点生命';
        case 'miss': return '🌫️ ' + nm(evt.target) + ' 闪避了攻击';
        case 'buff': return '✦ ' + nm(evt.target) + ' 获得【' + ((BUFF_DEF[evt.buff] || {}).name || evt.buff) + '】';
        case 'cleanse': return '✨ ' + nm(evt.target) + ' 被驱散减益';
        case 'revive': return '🕊️ ' + evt.name + ' 复活，回复 ' + evt.hp + ' 生命';
        case 'death': return '☠️ ' + evt.name + ' 阵亡';
        case 'stunned': return '💫 ' + evt.name + ' 被眩晕，无法行动';
        case 'end': return evt.draw ? '⚖️ 战斗以平局收场' : (evt.win ? '🏆 战斗胜利！' : '💀 战斗失败');
        default: return '';
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
