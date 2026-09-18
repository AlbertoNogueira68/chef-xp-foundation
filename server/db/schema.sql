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

-- ------------------------------------------------------------------ --
-- Participações nos desafios (ver migrations/007_challenge_entries.sql)
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS challenge_entries (
  id           BIGSERIAL PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  recipe_id    UUID NOT NULL REFERENCES recipes(id)    ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uma participação por pessoa; a mesma receita não entra duas vezes.
  UNIQUE (challenge_id, user_id),
  UNIQUE (challenge_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS challenge_entries_challenge_idx
  ON challenge_entries (challenge_id, created_at DESC);

CREATE INDEX IF NOT EXISTS challenge_entries_user_idx
  ON challenge_entries (user_id, created_at DESC);

-- ------------------------------------------------------------------ --
-- Notificações (ver migrations/008_notifications.sql)
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('like', 'comment', 'follow')),
  recipe_id  UUID REFERENCES recipes(id)  ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_nao_e_de_mim CHECK (user_id <> actor_id)
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;

-- Gostar e seguir dão uma notificação por pessoa, não uma por clique.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_uma_por_gosto
  ON notifications (user_id, actor_id, kind, recipe_id)
  WHERE kind = 'like';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_uma_por_seguidor
  ON notifications (user_id, actor_id, kind)
  WHERE kind = 'follow';

-- Tokens de email (ver migrations/009_auth_tokens.sql)
--
-- Recuperação de password e verificação de conta: a mesma mecânica, separada
-- por `kind`. Guarda-se o SHA-256 do token, nunca o token.

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('password_reset', 'email_verification')),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_idx
  ON auth_tokens (user_id, kind);

CREATE INDEX IF NOT EXISTS auth_tokens_expiry_idx
  ON auth_tokens (expires_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- As fotografias da Google passaram a ser descarregadas para /uploads em vez
-- de guardadas como endereço (ver migrations/010_google_photo_local.sql).
-- Numa base nova não há nada para corrigir; a migration trata das existentes.

-- Contas em espera (ver migrations/011_pending_signups.sql)
--
-- Criar conta é em dois tempos: escreve-se o email, confirma-se o link, e a
-- conta só nasce do outro lado. Enquanto isso, o que existe é isto — e mais
-- nada: nenhum nome de utilizador ou endereço fica tomado por quem não
-- confirmou.

CREATE TABLE IF NOT EXISTS pending_signups (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_signups_expiry_idx
  ON pending_signups (expires_at);

-- ------------------------------------------------------------------ --
-- Moderação (ver migrations/012_moderation.sql)
-- ------------------------------------------------------------------ --
--
-- Bloquear, denunciar, e alguém a quem a denúncia chega. O papel vive na base
-- e não no token: dentro do JWT ficava congelado até o cookie expirar.

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'moderator'));

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_nao_e_a_mim CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id);

-- `subject_id` sem chave estrangeira: o alvo é polimórfico e apagar o
-- conteúdo denunciado não deve apagar a denúncia.
CREATE TABLE IF NOT EXISTS reports (
  id           BIGSERIAL PRIMARY KEY,
  reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('recipe', 'comment', 'user')),
  subject_id   UUID NOT NULL,
  reason       TEXT NOT NULL
               CHECK (reason IN ('spam', 'ofensivo', 'perigoso', 'copia', 'outro')),
  details      TEXT CHECK (details IS NULL OR char_length(details) <= 500),
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT CHECK (resolution IS NULL OR resolution IN ('removido', 'arquivado')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS reports_open_idx
  ON reports (created_at DESC) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS reports_subject_idx ON reports (subject_type, subject_id);

-- Papel de administrador (ver migrations/013_admin_role.sql)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'moderator', 'admin'));

-- Quem deu poderes a quem. `actor_id` a nulo = mudança pela linha de comandos.
CREATE TABLE IF NOT EXISTS role_changes (
  id         BIGSERIAL PRIMARY KEY,
  target_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  from_role  TEXT NOT NULL,
  to_role    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_changes_target_idx
  ON role_changes (target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS users_staff_idx ON users (role) WHERE role <> 'user';
