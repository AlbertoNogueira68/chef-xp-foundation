-- 013: o papel de administrador.
--
-- A 012 deixou dois papéis: quem usa a aplicação e quem trata das denúncias.
-- Faltava quem decide quem trata das denúncias, e quem olha para a aplicação
-- inteira em vez de uma peça de conteúdo de cada vez.
--
-- Três papéis e não um campo de permissões por ação: a esta escala, uma
-- matriz de permissões seria mais código para configurar do que para cumprir.
-- A hierarquia é simples e está escrita em `domain/moderation.js` — o admin
-- pode tudo o que o moderador pode, e mais.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'moderator', 'admin'));

-- Quem deu poderes a quem, e quando.
--
-- Uma promoção é a ação mais consequente que a aplicação tem: quem promove
-- alguém está a dar-lhe a capacidade de apagar o que os outros escreveram.
-- Sem registo, a resposta a "quem é que tornou esta pessoa moderadora?" seria
-- "não se sabe" — e a coluna `role` sozinha só diz o estado de agora.
--
-- `actor_id` a nulo é uma mudança feita pela linha de comandos, onde não há
-- sessão nenhuma a apontar para uma pessoa.
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

-- Quem tem papel é uma minoria da tabela: um índice parcial é suficiente e
-- não paga nada nas linhas de toda a gente.
CREATE INDEX IF NOT EXISTS users_staff_idx ON users (role) WHERE role <> 'user';
