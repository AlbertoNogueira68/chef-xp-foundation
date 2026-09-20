-- 016: Sistema de múltiplos trilhos
--
-- Expande o sistema para suportar múltiplos trilhos de aprendizagem.
-- O trilho "main-course" é o fundacional existente.
-- Novos trilhos (italiano, asiático, etc) são adicionados sem mexer no código.
--
-- Estrutura:
-- - `trails` — metadados de cada trilho (nome, descrição, cor, dificuldade)
-- - `user_trail_progress` — qual trilho o utilizador está a fazer
-- - Modificações em `lesson_progress`, `skill_practice`, `mission_runs` para incluir `trail_id`

-- Tabela de metadados de trilhos
CREATE TABLE IF NOT EXISTS trails (
  id TEXT PRIMARY KEY,
  -- 'main-course', 'italian-cooking', etc

  name TEXT NOT NULL,
  -- "Cozinha Italiana", "Main Course"

  description TEXT,
  -- Descrição breve do trilho

  icon TEXT,
  -- Ícone (emoji ou nome lucide-react)

  color TEXT NOT NULL DEFAULT 'slate',
  -- Cor Tailwind: 'emerald', 'red', 'orange', etc

  difficulty TEXT NOT NULL
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  -- Dificuldade do trilho

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  published_at TIMESTAMPTZ,
  -- NULL = draft, com timestamp = publicado

  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Admin que publicou

  order_index INT NOT NULL DEFAULT 0
  -- Ordem de apresentação na UI
);

CREATE INDEX IF NOT EXISTS idx_trails_published
  ON trails (published_at DESC) WHERE published_at IS NOT NULL;

-- Progresso do utilizador em cada trilho
CREATE TABLE IF NOT EXISTS user_trail_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Quando começou o trilho

  current_unit_id TEXT,
  -- Qual unidade está a fazer (referência ao JSON)

  PRIMARY KEY (user_id, trail_id)
);

CREATE INDEX IF NOT EXISTS idx_user_trail_progress_user
  ON user_trail_progress (user_id);

-- Adicionar trail_id às tabelas de progresso existentes
-- Isto é feito separadamente porque são alterações a tabelas já existentes

-- Para lesson_progress: adicionar coluna trail_id (default 'main-course' para compatibilidade)
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS trail_id TEXT NOT NULL DEFAULT 'main-course';

-- Criar índice para queries rápidas por trilho
CREATE INDEX IF NOT EXISTS idx_lesson_progress_trail
  ON lesson_progress (trail_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_trail
  ON lesson_progress (user_id, trail_id);

-- Para skill_practice: adicionar coluna trail_id
ALTER TABLE skill_practice
  ADD COLUMN IF NOT EXISTS trail_id TEXT NOT NULL DEFAULT 'main-course';

CREATE INDEX IF NOT EXISTS idx_skill_practice_trail
  ON skill_practice (trail_id);

CREATE INDEX IF NOT EXISTS idx_skill_practice_user_trail
  ON skill_practice (user_id, trail_id);

-- Para mission_runs: adicionar coluna trail_id
ALTER TABLE mission_runs
  ADD COLUMN IF NOT EXISTS trail_id TEXT NOT NULL DEFAULT 'main-course';

CREATE INDEX IF NOT EXISTS idx_mission_runs_trail
  ON mission_runs (trail_id);

CREATE INDEX IF NOT EXISTS idx_mission_runs_user_trail
  ON mission_runs (user_id, trail_id);

-- Para skills: adicionar coluna trail_id
-- Skills podem ser reutilizadas entre trilhos (ex: calor.niveis aparece em vários)
-- Portanto usamos (id, trail_id) como chave primária
ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS trail_id TEXT NOT NULL DEFAULT 'main-course';

-- Remover chave primária anterior se existir
-- Isto depende da estrutura atual, deixamos como comentário por cautela
-- ALTER TABLE skills DROP CONSTRAINT IF EXISTS skills_pkey;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_id_trail
--   ON skills (id, trail_id);

-- Seed: inserir trilho main-course se não existir
INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'main-course',
  'Main Course',
  'Master the fundamentals of cooking',
  '🏛️',
  'emerald',
  'beginner',
  now(),
  0
)
ON CONFLICT (id) DO NOTHING;
