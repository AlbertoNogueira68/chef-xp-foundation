-- 016: vários trilhos de aprendizagem
--
-- Até aqui havia um percurso só. Passa a haver trilhos: o fundacional
-- ("main-course", o que sempre existiu) e os especializados — cozinha
-- italiana, asiática, pastelaria.
--
-- Um trilho tem duas metades. O currículo (unidades, lições, missões) vem do
-- JSON em `shared/trails/`, ou de `curriculum_json` quando foi o
-- administrador que o escreveu pelo painel. Os metadados — nome, cor,
-- dificuldade, publicado ou não — vivem aqui, que é onde se lhes mexe sem
-- deploy.
--
-- As competências continuam globais de propósito: `calor.niveis` é a mesma
-- coisa em qualquer trilho, e é isso que deixa o trilho italiano apoiar-se
-- nos fundamentos em vez de os repetir. Por isso `skills` e `skill_practice`
-- não levam `trail_id` — quem o levasse dizia que a mesma competência
-- praticada na cozinha italiana era outra competência.

CREATE TABLE IF NOT EXISTS trails (
  id   TEXT PRIMARY KEY,          -- 'main-course', 'italian'
  name TEXT NOT NULL,

  description TEXT,
  icon        TEXT,               -- emoji
  color       TEXT NOT NULL DEFAULT 'slate',

  difficulty TEXT NOT NULL
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),

  -- O currículo escrito pelo painel de administração. NULL nos trilhos que
  -- vêm de ficheiro: esses são código versionado e é de lá que se carregam.
  curriculum_json JSONB,

  -- NULL = rascunho. Com data = publicado, e só então é visível a quem aprende.
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,

  order_index INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trails_published
  ON trails (order_index) WHERE published_at IS NOT NULL;

-- Em que trilhos cada pessoa anda. Uma linha por trilho começado: dá para
-- andar em mais do que um e voltar a qualquer deles sem perder o lugar.
CREATE TABLE IF NOT EXISTS user_trail_progress (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,

  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  current_unit_id TEXT,

  PRIMARY KEY (user_id, trail_id)
);

CREATE INDEX IF NOT EXISTS idx_user_trail_progress_user
  ON user_trail_progress (user_id);

-- O progresso existente é todo do trilho fundacional, e o DEFAULT trata disso
-- sem um UPDATE: as linhas que já lá estão ficam com 'main-course'.
--
-- A chave primária de `lesson_progress` continua (user_id, lesson_id), sem o
-- trilho. Os ids de lição são únicos entre trilhos — o carregador recusa
-- arrancar se dois trilhos repetirem um — por isso a lição já diz a que
-- trilho pertence, e metê-lo na chave só dava a ilusão de que a mesma lição
-- podia ser feita duas vezes em trilhos diferentes.
ALTER TABLE lesson_progress
  ADD COLUMN IF NOT EXISTS trail_id TEXT NOT NULL DEFAULT 'main-course';

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_trail
  ON lesson_progress (user_id, trail_id);

ALTER TABLE mission_runs
  ADD COLUMN IF NOT EXISTS trail_id TEXT NOT NULL DEFAULT 'main-course';

CREATE INDEX IF NOT EXISTS idx_mission_runs_user_trail
  ON mission_runs (user_id, trail_id);

-- O fundacional. Vem de ficheiro, por isso não leva `curriculum_json`, e
-- nasce publicado porque já estava a ser servido a toda a gente.
INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'main-course',
  'Main Course',
  'The fundamentals: knife, heat, seasoning and doneness.',
  '🍳',
  'emerald',
  'beginner',
  now(),
  0
)
ON CONFLICT (id) DO NOTHING;

-- Cozinha italiana. O currículo está em `shared/trails/italian.json`; esta
-- linha é só o que o painel precisa de saber para o mostrar.
INSERT INTO trails (id, name, description, icon, color, difficulty, published_at, order_index)
VALUES (
  'italian',
  'Italian Cooking',
  'Fresh pasta, the sauces that go on it, risotto and pizza.',
  '🇮🇹',
  'red',
  'intermediate',
  now(),
  1
)
ON CONFLICT (id) DO NOTHING;
