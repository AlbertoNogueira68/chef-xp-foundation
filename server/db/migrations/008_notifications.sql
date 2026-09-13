-- 008: notificações.
--
-- O sino do cabeçalho existia desde o início e nunca fez nada. Isto é o que
-- lhe falta por baixo.
--
-- Uma notificação é sempre "alguém fez algo comigo": quem recebe (`user_id`),
-- quem fez (`actor_id`), o quê (`kind`) e sobre o quê (`recipe_id`,
-- `comment_id`). O texto não é guardado — é construído a partir destes campos
-- no momento de ler, para um utilizador que mude de nome não deixar
-- notificações a mentir.

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('like', 'comment', 'follow')),
  recipe_id  UUID REFERENCES recipes(id)  ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ninguém é notificado de si próprio. A regra é do esquema porque esquecer
  -- um `if` numa rota nova é fácil de mais.
  CONSTRAINT notifications_nao_e_de_mim CHECK (user_id <> actor_id)
);

-- O que a caixa faz sempre: as minhas, das mais recentes para as mais antigas.
CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, created_at DESC);

-- Contar por ler tem de ser barato: é um pedido por cada carregamento da app.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;

-- Gostar, desgostar e voltar a gostar é uma notificação, não três. O mesmo
-- para seguir. Comentários ficam de fora deste índice: cada comentário é um
-- acontecimento novo, e tem `comment_id` próprio.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_uma_por_gosto
  ON notifications (user_id, actor_id, kind, recipe_id)
  WHERE kind = 'like';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_uma_por_seguidor
  ON notifications (user_id, actor_id, kind)
  WHERE kind = 'follow';
