-- 003: social real + progressão persistida no servidor.
-- Idempotente: pode correr sobre uma base criada por schema.sql.

-- ---------------------------------------------------------------- --
-- Livro-razão de XP. users.xp passa a ser um valor DERIVADO daqui.
-- O UNIQUE torna a atribuição idempotente: repetir o mesmo pedido
-- nunca dá pontos a dobrar.
-- ---------------------------------------------------------------- --
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

-- O XP que já existia passa a ter uma entrada no livro-razão, senão a soma
-- zerava toda a gente na primeira recomputação.
INSERT INTO xp_events (user_id, source, source_ref, amount)
SELECT id, 'legacy', 'baseline', xp FROM users WHERE xp > 0
ON CONFLICT (user_id, source, source_ref) DO NOTHING;

-- ---------------------------------------------------------------- --
-- Gostos: quem gostou de quê. A contagem passa a ser derivada.
-- ---------------------------------------------------------------- --
CREATE TABLE IF NOT EXISTS recipe_likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS recipe_likes_recipe_idx ON recipe_likes (recipe_id);

-- likes_count era um contador sem dono, incrementável sem limite.
ALTER TABLE recipes DROP COLUMN IF EXISTS likes_count;

-- ---------------------------------------------------------------- --
-- Grafo social
-- ---------------------------------------------------------------- --
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

-- ---------------------------------------------------------------- --
-- Percurso de aprendizagem: sai do localStorage, entra na base de dados
-- ---------------------------------------------------------------- --
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  xp_earned    INTEGER NOT NULL DEFAULT 0,
  hearts_left  SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

-- Um dia civil de atividade por utilizador. É daqui que sai o streak.
CREATE TABLE IF NOT EXISTS daily_activity (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      DATE NOT NULL,
  xp       INTEGER NOT NULL DEFAULT 0,
  goal_met BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS daily_activity_user_day_idx ON daily_activity (user_id, day DESC);

-- ---------------------------------------------------------------- --
-- Imagens e preferências
-- ---------------------------------------------------------------- --
ALTER TABLE recipes    ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE users      ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'Europe/Lisbon';
ALTER TABLE users      ADD COLUMN IF NOT EXISTS daily_xp_goal INTEGER NOT NULL DEFAULT 50;

-- ---------------------------------------------------------------- --
-- Pesquisa: ILIKE '%x%' não usa índice. Trigram resolve e ainda tolera
-- erros de escrita.
-- ---------------------------------------------------------------- --
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS recipes_title_trgm_idx
  ON recipes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS recipes_description_trgm_idx
  ON recipes USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_username_trgm_idx
  ON users USING gin (username gin_trgm_ops);

-- Paginação por cursor estável (created_at, id)
CREATE INDEX IF NOT EXISTS recipes_feed_idx ON recipes (created_at DESC, id DESC);
