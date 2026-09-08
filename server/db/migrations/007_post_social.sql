-- 007: gostos e comentários nos cozinhados.
--
-- Os posts nasceram na 005 mas não tinham lado social nenhum: o feed lia de
-- `recipes` e ignorava-os. Para um cozinhado entrar no feed a par de uma
-- receita, precisa de poder receber gosto e comentário.
--
-- Tabelas próprias e não uma coluna nova em `recipe_likes`/`comments`: os
-- posts têm id BIGINT e as receitas UUID. Uma coluna polimórfica obrigava a
-- largar a chave estrangeira — que é exactamente o que garante que um gosto
-- não sobrevive ao post de que gosta.

CREATE TABLE IF NOT EXISTS post_likes (
  user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes (post_id);

CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT   NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments (post_id, created_at DESC);

-- O feed junta posts e receitas ordenados por data. Sem este índice o lado
-- dos posts ficava a fazer sort em memória a cada página.
CREATE INDEX IF NOT EXISTS posts_feed_idx ON posts (created_at DESC, id DESC);
