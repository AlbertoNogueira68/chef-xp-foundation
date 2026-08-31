-- 004: competências do currículo na base de dados.
--
-- O conteúdo continua a viver em `shared/curriculum.json` — é lá que se
-- escreve e é lá que o grafo é validado. Estas tabelas existem porque o
-- progresso por competência (skill_practice, skill_state) precisa de uma
-- chave estrangeira, e uma FK não aponta para um ficheiro.
--
-- A fonte de verdade é o JSON; estas tabelas são um espelho reconstruído
-- por `server/scripts/sync-curriculum.js`. Idempotente.

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
