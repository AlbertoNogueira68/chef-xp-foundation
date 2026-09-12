-- 007: participações nos desafios.
--
-- Até aqui `challenges` era um mural: existia a tabela e a rota de leitura, mas
-- ninguém podia participar. Uma participação é uma receita própria submetida a
-- um desafio ativo.
--
-- As duas regras que importam são do esquema, não de um IF na rota:
--   · uma participação por utilizador e por desafio;
--   · a mesma receita não entra duas vezes no mesmo desafio.

CREATE TABLE IF NOT EXISTS challenge_entries (
  id           BIGSERIAL PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  recipe_id    UUID NOT NULL REFERENCES recipes(id)    ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id),
  UNIQUE (challenge_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS challenge_entries_challenge_idx
  ON challenge_entries (challenge_id, created_at DESC);

CREATE INDEX IF NOT EXISTS challenge_entries_user_idx
  ON challenge_entries (user_id, created_at DESC);
