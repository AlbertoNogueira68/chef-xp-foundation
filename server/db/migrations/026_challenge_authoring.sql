-- 026: desafios com autor, duração, limite de submissões e pódio.
--
-- Até aqui um desafio nascia com um INSERT à mão: a tabela existia, mas não
-- havia maneira de criar um pela aplicação, e o que ela guardava era o mínimo
-- (título, XP, fim). O que falta a um desafio é quem o criou e as regras com
-- que ele corre — e essas regras são de quem o cria, não do código.
--
-- Quatro coisas novas na tabela:
--   · `created_by`  — quem o pôs de pé, para o painel mostrar o autor;
--   · `starts_at`   — o princípio, para a duração em dias ser um facto e não
--                     uma conta feita a partir do fim;
--   · `max_entries_per_user` — quantas submissões cada pessoa pode publicar;
--   · o pódio em XP, definido por quem cria, com 300/200/100 por omissão.
--
-- E `settled_at`, que é o que impede o ranking de ser pago duas vezes.

ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS starts_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS max_entries_per_user INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_place_xp       INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS second_place_xp      INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS third_place_xp       INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS settled_at           TIMESTAMPTZ;

-- Os desafios que já existiam nasceram quando a linha nasceu, não no momento
-- em que esta migração correu: sem este backfill, um desafio de uma semana
-- criado em janeiro passava a dizer que durou um dia.
UPDATE challenges SET starts_at = created_at WHERE created_at < starts_at;

ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_entries_per_user_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_entries_per_user_check
  CHECK (max_entries_per_user BETWEEN 1 AND 10);

ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_podium_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_podium_check
  CHECK (first_place_xp >= 0 AND second_place_xp >= 0 AND third_place_xp >= 0);

-- Os desafios por liquidar são uma minoria da tabela e são-no por pouco
-- tempo: um índice parcial é o que o agendador precisa, e não paga nada nas
-- linhas dos desafios já fechados.
CREATE INDEX IF NOT EXISTS challenges_unsettled_idx
  ON challenges (ends_at) WHERE settled_at IS NULL;

-- Mais do que uma submissão por pessoa.
--
-- A 007 escreveu "uma participação por utilizador" no esquema, e estava certa
-- enquanto o número era um. Agora o número é de quem cria o desafio, e um
-- UNIQUE não sabe contar até `max_entries_per_user` — quem conta é a rota,
-- dentro da transação que já tranca o desafio. O UNIQUE por receita fica:
-- a mesma receita não entra duas vezes no mesmo desafio, e isso continua a
-- não depender de contar nada.
ALTER TABLE challenge_entries DROP CONSTRAINT IF EXISTS challenge_entries_challenge_id_user_id_key;

CREATE INDEX IF NOT EXISTS challenge_entries_challenge_user_idx
  ON challenge_entries (challenge_id, user_id);

-- O resultado, congelado no fim.
--
-- Uma tabela e não uma consulta feita na hora, porque os gostos continuam a
-- mudar depois do desafio fechar: sem isto, o pódio que a aplicação mostra em
-- janeiro deixava de ser o pódio que pagou o XP em dezembro. Aqui fica o que
-- era verdade no momento em que fechou.
--
-- `place` é o lugar com empates à maneira do desporto: dois primeiros ficam
-- ambos em 1.º e o lugar seguinte é o 3.º.
CREATE TABLE IF NOT EXISTS challenge_results (
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  place        INTEGER NOT NULL CHECK (place >= 1),
  likes        INTEGER NOT NULL DEFAULT 0,
  xp_awarded   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS challenge_results_challenge_idx
  ON challenge_results (challenge_id, place ASC);

-- O XP do pódio é outra fonte, e não mais um evento de 'challenge'.
--
-- O livro-razão tem UNIQUE (user_id, source, source_ref), e o `source_ref` do
-- pódio é o mesmo id do desafio que já pagou a participação. Sem uma fonte
-- própria, o prémio do 1.º lugar colidia com o XP de ter entrado — e o ON
-- CONFLICT DO NOTHING engolia-o em silêncio.
ALTER TABLE xp_events DROP CONSTRAINT IF EXISTS xp_events_source_check;
ALTER TABLE xp_events ADD CONSTRAINT xp_events_source_check
  CHECK (source IN ('legacy', 'lesson', 'recipe', 'challenge', 'challenge_podium', 'streak'));
