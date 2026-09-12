-- =============================================================================
-- qmhub.cc.cd · 灵兽家族 · 生产数据库设计
-- -----------------------------------------------------------------------------
-- 目标库：PostgreSQL 14+ / MySQL 8+（差异处已用注释标注）
-- 说明：
--   · 静态配置表（species / skills / items）随版本发布，运营可只改数据不改代码
--   · 动态表按「玩家域 / 灵兽域 / 家族域 / 赛季域 / 日志域」分层
--   · 关键随机（抽卡、繁育、战斗）必须服务端复算，前端结果仅用于播放动画
-- =============================================================================

-- =============================================================================
-- 一、静态配置表
-- =============================================================================

CREATE TABLE species (
  id              VARCHAR(32)   PRIMARY KEY,            -- white_tiger / yellow_ox / dawn_chicken
  name            VARCHAR(32)   NOT NULL,
  title           VARCHAR(64)   NOT NULL,
  role            VARCHAR(16)   NOT NULL,               -- 输出 / 坦克 / 辅助
  element         VARCHAR(8)    NOT NULL,               -- 金 / 土 / 木
  rarity          VARCHAR(8)    NOT NULL,               -- R / SR / SSR / UR
  base_hp         INT           NOT NULL,
  base_atk        INT           NOT NULL,
  base_def        INT           NOT NULL,
  base_spd        INT           NOT NULL,
  base_crit       NUMERIC(5,4)  NOT NULL DEFAULT 0,
  base_crit_dmg   NUMERIC(5,4)  NOT NULL DEFAULT 0,
  base_dodge      NUMERIC(5,4)  NOT NULL DEFAULT 0,
  grow_hp         NUMERIC(5,3)  NOT NULL DEFAULT 1,
  grow_atk        NUMERIC(5,3)  NOT NULL DEFAULT 1,
  grow_def        NUMERIC(5,3)  NOT NULL DEFAULT 1,
  grow_spd        NUMERIC(5,3)  NOT NULL DEFAULT 1,
  skill_ids       JSONB         NOT NULL,               -- ["wt_normal","wt_s1",...]
  palette         JSONB         NOT NULL,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skills (
  id              VARCHAR(32)   PRIMARY KEY,
  name            VARCHAR(32)   NOT NULL,
  kind            VARCHAR(16)   NOT NULL,               -- normal/active/ultimate/passive
  icon            VARCHAR(8),
  energy_cost     INT           NOT NULL DEFAULT 0,
  cooldown        INT           NOT NULL DEFAULT 0,
  description     TEXT,
  effects         JSONB         NOT NULL,               -- 效果数组，与 engine.js 一致
  passive         JSONB                                 -- 被动加成（仅 kind=passive）
);

CREATE TABLE items (
  id              VARCHAR(32)   PRIMARY KEY,
  name            VARCHAR(32)   NOT NULL,
  emoji           VARCHAR(8),
  is_currency     BOOLEAN       NOT NULL DEFAULT FALSE,
  description     TEXT
);

-- 羁绊配置（可热更新，无需发版）
CREATE TABLE bonds (
  id              VARCHAR(32)   PRIMARY KEY,
  name            VARCHAR(32)   NOT NULL,
  emoji           VARCHAR(8),
  grade           VARCHAR(8)    NOT NULL,
  members         JSONB,                                 -- ["white_tiger","yellow_ox"]
  same_species    BOOLEAN       NOT NULL DEFAULT FALSE,
  same_count      INT           NOT NULL DEFAULT 2,
  require_distinct BOOLEAN      NOT NULL DEFAULT FALSE,
  require_count   INT,
  effects         JSONB         NOT NULL,
  description     TEXT
);

-- 试炼塔层配置（可选：默认由公式生成，此处可覆盖特定层）
CREATE TABLE tower_floors (
  floor           INT           PRIMARY KEY,
  enemy_count     INT           NOT NULL,
  enemy_level     INT           NOT NULL,
  stat_multiplier NUMERIC(5,3)  NOT NULL DEFAULT 1,
  reward          JSONB         NOT NULL,
  note            VARCHAR(64)
);

-- =============================================================================
-- 二、玩家域
-- =============================================================================

CREATE TABLE users (
  id              BIGSERIAL     PRIMARY KEY,
  username        VARCHAR(32)   NOT NULL UNIQUE,
  display_name    VARCHAR(32)   NOT NULL,
  avatar          VARCHAR(128),
  password_hash   VARCHAR(128)  NOT NULL,
  email           VARCHAR(128),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  last_login_at   TIMESTAMP
);
CREATE INDEX idx_users_name ON users (username);

CREATE TABLE player_profiles (
  user_id         BIGINT        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level           INT           NOT NULL DEFAULT 1,
  exp             BIGINT        NOT NULL DEFAULT 0,
  title           VARCHAR(32)   DEFAULT '初入青丘',
  pity_counter    INT           NOT NULL DEFAULT 0,      -- 抽卡保底计数
  total_gacha     INT           NOT NULL DEFAULT 0,
  battles_won     INT           NOT NULL DEFAULT 0,
  battles_lost    INT           NOT NULL DEFAULT 0,
  families_war_won INT          NOT NULL DEFAULT 0,
  raid_damage     BIGINT        NOT NULL DEFAULT 0,
  tower_best      INT           NOT NULL DEFAULT 0,
  signin_days     INT           NOT NULL DEFAULT 0,
  signin_date     DATE,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventories (
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id         VARCHAR(32)   NOT NULL REFERENCES items(id),
  amount          BIGINT        NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE shop_purchases (
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_date       DATE          NOT NULL,
  item_id         VARCHAR(32)   NOT NULL,
  count           INT           NOT NULL DEFAULT 0,
  UNIQUE (user_id, shop_date, item_id)
);

-- =============================================================================
-- 三、灵兽域
-- =============================================================================

CREATE TABLE pets (
  id              BIGSERIAL     PRIMARY KEY,
  uid             CHAR(24)      NOT NULL UNIQUE,         -- 业务主键，前端持有
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species_id      VARCHAR(32)   NOT NULL REFERENCES species(id),
  nickname        VARCHAR(16)   NOT NULL,
  level           INT           NOT NULL DEFAULT 1,
  exp             BIGINT        NOT NULL DEFAULT 0,
  star            SMALLINT      NOT NULL DEFAULT 1,
  intimacy        INT           NOT NULL DEFAULT 0,
  break_count     INT           NOT NULL DEFAULT 0,
  skill_levels    JSONB         NOT NULL DEFAULT '{"0":1,"1":1,"2":1,"3":1,"4":1}',
  talent          JSONB         NOT NULL DEFAULT '{"hp":0,"atk":0,"def":0,"spd":0}',
  heritage        JSONB,                                 -- 繁育血脉来源
  in_team         BOOLEAN       NOT NULL DEFAULT FALSE,
  team_slot       SMALLINT,                              -- 0/1/2
  locked          BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pets_user    ON pets (user_id);
CREATE INDEX idx_pets_species ON pets (user_id, species_id);
CREATE INDEX idx_pets_power   ON pets (user_id, level DESC, star DESC);
CREATE UNIQUE INDEX uq_pets_slot ON pets (user_id, team_slot) WHERE in_team = TRUE;  -- MySQL: 用生成列模拟

CREATE TABLE pet_bonds_log (                              -- 羁绊激活审计（可选）
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bond_id         VARCHAR(32)   NOT NULL,
  active          BOOLEAN       NOT NULL,
  checked_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- 灵兽繁育记录
CREATE TABLE breed_logs (
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_a        BIGINT        NOT NULL REFERENCES pets(id),
  parent_b        BIGINT        NOT NULL REFERENCES pets(id),
  child_id        BIGINT        NOT NULL REFERENCES pets(id),
  child_species   VARCHAR(32)   NOT NULL,
  child_star      SMALLINT      NOT NULL,
  talent_total    INT           NOT NULL DEFAULT 0,
  cost_gem        INT           NOT NULL DEFAULT 0,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_breed_user ON breed_logs (user_id, created_at DESC);

-- =============================================================================
-- 四、家族域
-- =============================================================================

CREATE TABLE families (
  id              BIGSERIAL     PRIMARY KEY,
  name            VARCHAR(16)   NOT NULL UNIQUE,
  badge           VARCHAR(8)    NOT NULL DEFAULT '🏯',
  notice          TEXT,
  level           INT           NOT NULL DEFAULT 1,
  exp             BIGINT        NOT NULL DEFAULT 0,
  funds           BIGINT        NOT NULL DEFAULT 0,
  total_contribution BIGINT     NOT NULL DEFAULT 0,
  war_score       INT           NOT NULL DEFAULT 0,
  season_wins     INT           NOT NULL DEFAULT 0,
  season_losses   INT           NOT NULL DEFAULT 0,
  leader_id       BIGINT        REFERENCES users(id),
  member_cap      INT           NOT NULL DEFAULT 20,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_families_rank ON families (level DESC, war_score DESC);

CREATE TABLE family_members (
  family_id       BIGINT        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position        VARCHAR(12)   NOT NULL DEFAULT 'member', -- leader/vice/elder/elite/member
  contribution    BIGINT        NOT NULL DEFAULT 0,
  weekly_contribution BIGINT    NOT NULL DEFAULT 0,
  power           INT           NOT NULL DEFAULT 0,
  joined_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  last_active_at  TIMESTAMP,
  PRIMARY KEY (family_id, user_id)
);
CREATE UNIQUE INDEX uq_family_member_uniq ON family_members (user_id);  -- 一人一家族
CREATE INDEX idx_fm_contrib ON family_members (family_id, weekly_contribution DESC);

CREATE TABLE family_techs (
  family_id       BIGINT        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  tech_id         VARCHAR(16)   NOT NULL,     -- power / tough / swift / fortune
  level           INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, tech_id)
);

-- 结盟（双向各存一行，便于按家族查询）
CREATE TABLE family_allies (
  family_id       BIGINT        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  ally_family_id  BIGINT        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  status          VARCHAR(12)   NOT NULL DEFAULT 'active',  -- pending / active / dissolved
  requested_by    BIGINT        REFERENCES users(id),
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (family_id, ally_family_id),
  CHECK (family_id <> ally_family_id)
);
CREATE INDEX idx_ally_status ON family_allies (family_id, status);

-- 家族战记录
CREATE TABLE family_wars (
  id              BIGSERIAL     PRIMARY KEY,
  season          INT           NOT NULL,
  attacker_id     BIGINT        NOT NULL REFERENCES families(id),
  defender_id     BIGINT        NOT NULL REFERENCES families(id),
  winner_id       BIGINT        REFERENCES families(id),
  score_attacker  SMALLINT      NOT NULL DEFAULT 0,
  score_defender  SMALLINT      NOT NULL DEFAULT 0,
  rounds          SMALLINT      NOT NULL DEFAULT 0,
  battle_log      JSONB,                                -- 完整 timeline，用于回放与申诉
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_wars_family ON family_wars (attacker_id, created_at DESC);
CREATE INDEX idx_wars_defender ON family_wars (defender_id, created_at DESC);

-- =============================================================================
-- 五、赛季域（试炼塔 / 联盟 BOSS / 排行榜）
-- =============================================================================

CREATE TABLE tower_records (
  user_id         BIGINT        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_floor   INT           NOT NULL DEFAULT 1,      -- 已解锁到的层
  best_floor      INT           NOT NULL DEFAULT 1,
  used_today      INT           NOT NULL DEFAULT 0,      -- 今日已用次数
  extra_today     INT           NOT NULL DEFAULT 0,      -- 今日购买的额外次数
  reset_date      DATE          NOT NULL,
  history         JSONB         NOT NULL DEFAULT '[]',   -- 最近 30 条 {floor,win,at}
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tower_best ON tower_records (best_floor DESC);

CREATE TABLE boss_seasons (
  season          INT           PRIMARY KEY,
  boss_name       VARCHAR(32)   NOT NULL DEFAULT '九头相柳',
  max_hp          BIGINT        NOT NULL,
  current_hp      BIGINT        NOT NULL,
  started_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  ended_at        TIMESTAMP
);

CREATE TABLE boss_damage (
  season          INT           NOT NULL REFERENCES boss_seasons(season),
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id       BIGINT        REFERENCES families(id),
  damage          BIGINT        NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season, user_id)
);
CREATE INDEX idx_boss_family ON boss_damage (season, family_id);

CREATE TABLE boss_claims (                                -- 联盟协作任务领奖记录
  season          INT           NOT NULL,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id         VARCHAR(32)   NOT NULL,
  claimed_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season, user_id, task_id)
);

-- =============================================================================
-- 六、任务与日志域
-- =============================================================================

CREATE TABLE daily_quests (
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_date      DATE          NOT NULL,
  task_id         VARCHAR(32)   NOT NULL,     -- login/levelup/battle/donate/tower
  progress        INT           NOT NULL DEFAULT 0,
  claimed         BOOLEAN       NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, quest_date, task_id)
);

CREATE TABLE daily_milestones (
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_date      DATE          NOT NULL,
  milestone_index SMALLINT      NOT NULL,
  claimed         BOOLEAN       NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, quest_date, milestone_index)
);

CREATE TABLE family_quests (
  family_id       BIGINT        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  quest_date      DATE          NOT NULL,
  quest_id        VARCHAR(32)   NOT NULL,
  progress        INT           NOT NULL DEFAULT 0,
  claimed         BOOLEAN       NOT NULL DEFAULT FALSE,
  PRIMARY KEY (family_id, quest_date, quest_id)
);

CREATE TABLE battle_logs (
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode            VARCHAR(16)   NOT NULL,          -- pve / arena / family_war / tower / boss
  ref_id          VARCHAR(64),                     -- 关卡 / 对手 / 层数
  win             BOOLEAN       NOT NULL,
  rounds          SMALLINT,
  damage_dealt    BIGINT,
  damage_taken    BIGINT,
  reward          JSONB,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_battle_user ON battle_logs (user_id, created_at DESC);

CREATE TABLE gacha_logs (
  id              BIGSERIAL     PRIMARY KEY,
  user_id         BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id        CHAR(24)      NOT NULL,
  roll_index      SMALLINT      NOT NULL,
  species_id      VARCHAR(32)   NOT NULL,
  is_pity         BOOLEAN       NOT NULL DEFAULT FALSE,
  converted_shard INT           NOT NULL DEFAULT 0,
  server_seed     VARCHAR(64)   NOT NULL,          -- 用于概率公示与合规审计
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gacha_user ON gacha_logs (user_id, created_at DESC);

-- =============================================================================
-- 七、排行榜视图（物化视图，定时刷新）
-- =============================================================================

CREATE MATERIALIZED VIEW mv_rank_power AS
SELECT u.id AS user_id, u.display_name, f.name AS family_name,
       COALESCE(SUM(p.level * 300 + p.star * 500), 0) AS score
FROM users u
LEFT JOIN pets p ON p.user_id = u.id
LEFT JOIN family_members fm ON fm.user_id = u.id
LEFT JOIN families f ON f.id = fm.family_id
GROUP BY u.id, u.display_name, f.name
ORDER BY score DESC;

CREATE MATERIALIZED VIEW mv_rank_family AS
SELECT f.id AS family_id, f.name, f.badge, f.level, f.war_score,
       COUNT(fm.user_id) AS member_count,
       (SELECT COUNT(*) FROM family_allies a WHERE a.family_id = f.id AND a.status = 'active') AS ally_count
FROM families f
LEFT JOIN family_members fm ON fm.family_id = f.id
GROUP BY f.id
ORDER BY (f.level * 1000 + f.war_score * 10) DESC;

CREATE MATERIALIZED VIEW mv_rank_tower AS
SELECT tr.user_id, u.display_name, tr.best_floor
FROM tower_records tr JOIN users u ON u.id = tr.user_id
ORDER BY tr.best_floor DESC;

-- 刷新：REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rank_power;  （建议每 5 分钟一次）

-- =============================================================================
-- 八、关键事务示例（防作弊：服务端复算）
-- =============================================================================

-- 8.1 抽卡（带保底，行级锁防并发）
-- BEGIN;
--   SELECT pity_counter, total_gacha FROM player_profiles WHERE user_id = $1 FOR UPDATE;
--   -- 服务端生成随机物种（非前端传入），写 gacha_logs，扣灵玉，更新 pity_counter
-- COMMIT;

-- 8.2 试炼塔挑战（原子扣次数 + 幂等）
-- UPDATE tower_records
--    SET used_today = used_today + 1
--  WHERE user_id = $1 AND reset_date = CURRENT_DATE
--    AND used_today < 3 + extra_today
-- RETURNING current_floor, best_floor;
-- 影响行数为 0 → 次数不足，直接拒绝

-- 8.3 家族战（先算后写，写在单事务内）
-- BEGIN;
--   INSERT INTO family_wars (...) VALUES (...);
--   UPDATE families SET war_score = war_score + $score, season_wins = season_wins + 1 WHERE id = $1;
--   UPDATE families SET season_losses = season_losses + 1 WHERE id = $2;
-- COMMIT;
