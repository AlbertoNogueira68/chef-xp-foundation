-- 005: missões de cozinha.
--
-- NOTA sobre tipos: o plano escrevia `user_id BIGINT REFERENCES users(id)`,
-- mas users.id é UUID desde a migration 001. Ficam UUID — com BIGINT nenhuma
-- destas tabelas chegava a ser criada.

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
