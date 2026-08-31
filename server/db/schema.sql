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
  password_hash TEXT NOT NULL,
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
