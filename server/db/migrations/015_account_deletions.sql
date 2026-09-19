-- 015: quem apagou que conta, e quando.
--
-- Um admin passa a poder apagar contas pelo painel. Apagar leva tudo em
-- cascata — receitas, comentários, progresso — e não há volta atrás. O mínimo
-- é ficar escrito que aconteceu e por mão de quem, como a 013 faz com as
-- mudanças de papel.
--
-- O que fica da conta apagada é o nome e o id, e mais nada: guardar o email,
-- ou o que a pessoa escreveu, era manter precisamente o que o apagar devia
-- levar. `deleted_user_id` não é chave estrangeira — a linha a que apontava
-- deixou de existir, que é o objetivo.

CREATE TABLE IF NOT EXISTS account_deletions (
  id               BIGSERIAL PRIMARY KEY,
  deleted_user_id  UUID NOT NULL,
  deleted_username TEXT NOT NULL,
  deleted_role     TEXT NOT NULL,
  actor_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletions_created_idx ON account_deletions (created_at DESC);
