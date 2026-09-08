-- ChefXP baseline schema (SQL-first, no ORM)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS applied_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,                       -- nulo em contas só de SSO
  photo_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  time_zone TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  daily_xp_goal INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  cook_time_min INTEGER NOT NULL DEFAULT 30,
  difficulty TEXT NOT NULL DEFAULT 'medio' CHECK (difficulty IN ('facil', 'medio', 'dificil')),
  xp_reward INTEGER NOT NULL DEFAULT 25,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipes_created_at_idx ON recipes (created_at DESC);
CREATE INDEX IF NOT EXISTS recipes_title_idx ON recipes (title);

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  image_url TEXT,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS challenges_ends_at_idx ON challenges (ends_at);

-- ---------------------------------------------------------------- --
-- Social + progressão (ver migrations/003_social_and_progress.sql)
-- ---------------------------------------------------------------- --

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS xp_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL CHECK (source IN ('legacy', 'lesson', 'recipe', 'challenge', 'streak')),
  source_ref TEXT NOT NULL DEFAULT '',
  amount     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_ref)
);

CREATE INDEX IF NOT EXISTS xp_events_user_idx ON xp_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recipe_likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS recipe_likes_recipe_idx ON recipe_likes (recipe_id);

CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_recipe_idx ON comments (recipe_id, created_at DESC);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  xp_earned    INTEGER NOT NULL DEFAULT 0,
  hearts_left  SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS daily_activity (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      DATE NOT NULL,
  xp       INTEGER NOT NULL DEFAULT 0,
  goal_met BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS daily_activity_user_day_idx ON daily_activity (user_id, day DESC);

CREATE INDEX IF NOT EXISTS recipes_title_trgm_idx ON recipes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS recipes_description_trgm_idx ON recipes USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_username_trgm_idx ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS recipes_feed_idx ON recipes (created_at DESC, id DESC);

-- ---------------------------------------------------------------- --
-- Competências do currículo (ver migrations/004_curriculum_and_skills.sql)
-- ---------------------------------------------------------------- --
CREATE TABLE IF NOT EXISTS skills (
  id          TEXT PRIMARY KEY,               -- 'faca.garra', 'calor.niveis'
  name        TEXT NOT NULL,
  category    TEXT NOT NULL
              CHECK (category IN ('faca','calor','tempero','ponto','seguranca','organizacao')),
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_prerequisites (
  skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  requires_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, requires_id),
  CHECK (skill_id <> requires_id)
);

-- `lesson_id` não tem FK: as lições vivem no JSON, não numa tabela.
-- A integridade dessa ponta é garantida pelo sync e pelos testes do grafo.
CREATE TABLE IF NOT EXISTS lesson_skills (
  lesson_id TEXT NOT NULL,
  skill_id  TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('teaches','requires')),
  PRIMARY KEY (lesson_id, skill_id, role)
);

CREATE INDEX IF NOT EXISTS idx_lesson_skills_skill ON lesson_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_skills_category     ON skills (category);

-- ------------------------------------------------------------------ --
-- Missões de cozinha (ver migrations/005_missions.sql)
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS mission_runs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   TEXT NOT NULL,                    -- do curriculum.json
  status       TEXT NOT NULL DEFAULT 'in_progress'
               CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  current_step INT  NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  result_image TEXT,
  shared       BOOLEAN NOT NULL DEFAULT false
);

-- Uma missão ativa de cada vez, por utilizador e por missão. O índice parcial
-- faz a regra ser da base de dados e não de um IF na rota.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_run
  ON mission_runs (user_id, mission_id) WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_mission_runs_user
  ON mission_runs (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS mission_checkpoints (
  id         BIGSERIAL PRIMARY KEY,
  run_id     BIGINT NOT NULL REFERENCES mission_runs(id) ON DELETE CASCADE,
  step_index INT    NOT NULL,
  image_url  TEXT   NOT NULL,
  feedback   TEXT,                               -- preenchido pelo tutor na S4
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_index)
);

-- Telemetria de onde as pessoas falham. É daqui que sai a resposta a
-- "em que passo é que se desiste".
CREATE TABLE IF NOT EXISTS mission_events (
  id         BIGSERIAL PRIMARY KEY,
  run_id     BIGINT NOT NULL REFERENCES mission_runs(id) ON DELETE CASCADE,
  step_index INT    NOT NULL,
  kind       TEXT   NOT NULL CHECK (kind IN ('rescue', 'timer', 'back', 'voice', 'abandon')),
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_events_run ON mission_events (run_id, created_at);

-- A distinção que sustenta o projeto: `lesson_progress` guarda o que se sabe,
-- `skill_practice` guarda o que se fez. Ninguém sobe de unidade só a
-- responder a perguntas.
CREATE TABLE IF NOT EXISTS skill_practice (
  user_id     UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id    TEXT   NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  times       INT    NOT NULL DEFAULT 0,
  last_run_id BIGINT REFERENCES mission_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_practice_skill ON skill_practice (skill_id);

-- O compromisso: que dias e quantas vezes por semana.
CREATE TABLE IF NOT EXISTS cooking_plans (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weekdays    SMALLINT[] NOT NULL DEFAULT '{}',  -- vazio = "n vezes, quando calhar"
  target_week INT NOT NULL DEFAULT 2,
  reminder_at TIME,
  tz          TEXT NOT NULL DEFAULT 'Europe/Lisbon',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cooking_sessions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planned_on DATE NOT NULL,
  mission_id TEXT,                               -- null até escolher o prato
  run_id     BIGINT REFERENCES mission_runs(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'planned'
             CHECK (status IN ('planned', 'done', 'missed', 'moved')),
  UNIQUE (user_id, planned_on)
);

-- O único caminho para o feed é cozinhar: um post exige uma run concluída.
CREATE TABLE IF NOT EXISTS posts (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id     BIGINT NOT NULL UNIQUE REFERENCES mission_runs(id) ON DELETE CASCADE,
  mission_id TEXT   NOT NULL,
  image_url  TEXT   NOT NULL,
  caption    TEXT,
  level_at   INT    NOT NULL,                    -- nível de quem publicou, à data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user    ON posts (user_id, created_at DESC);

-- Lado social dos cozinhados (ver migrations/007_post_social.sql). Tabelas
-- próprias e não uma coluna nova em `recipe_likes`/`comments`: os posts têm id
-- BIGINT e as receitas UUID, e uma coluna polimórfica obrigava a largar a
-- chave estrangeira.
CREATE TABLE IF NOT EXISTS post_likes (
  user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes (post_id);

CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT   NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_feed_idx ON posts (created_at DESC, id DESC);

-- ------------------------------------------------------------------ --
-- Identidades externas (ver migrations/006_oauth_identities.sql)
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS auth_identities (
  provider     TEXT NOT NULL CHECK (provider IN ('google')),
  -- O `sub` do fornecedor. Nunca o email: o email de uma conta Google pode
  -- mudar, o sub não. Ligar pelo email seria ligar por algo mutável.
  subject      TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities (user_id);

-- Um utilizador não pode ter duas identidades do mesmo fornecedor.
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_user_provider
  ON auth_identities (user_id, provider);
