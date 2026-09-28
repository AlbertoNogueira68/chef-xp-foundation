-- 028: guardar cada resposta de quiz, e abrir o XP à revisão
--
-- Até aqui, a aprendizagem só deixava rasto quando acabava bem:
-- `lesson_progress` tem uma linha por lição **concluída** e mais nada. Isso
-- deixava duas perguntas sem resposta possível.
--
-- A primeira é de avaliação: quantas pessoas começam uma lição e não a
-- acabam? Sem um sinal de início, o numerador existe e o denominador não, e
-- não há query que invente o que ninguém gravou. As missões já se
-- conseguiam medir (`mission_runs` tem o arranque e o abandono); as lições
-- não.
--
-- A segunda é de produto: o percurso tem um fim. Quem acaba as lições de um
-- trilho não tem para onde voltar, e a revisão espaçada — repetir mais cedo
-- aquilo em que se errou, e mais tarde aquilo que já se sabe — precisa de
-- saber *em que perguntas* se errou. `lesson_progress` guarda os corações
-- que sobraram, que diz quantos erros houve mas não quais.
--
-- Uma linha por resposta resolve as duas de uma vez. É a tabela que mais
-- cresce da base (uma lição são ~5 respostas), e por isso não guarda o texto
-- da pergunta nem da resposta dada: só a identidade da pergunta e se estava
-- certa. O currículo vive no servidor e é de lá que se lê o resto.

CREATE TABLE IF NOT EXISTS question_attempts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id    TEXT NOT NULL,
  lesson_id   TEXT NOT NULL,
  question_id TEXT NOT NULL,
  correct     BOOLEAN NOT NULL,
  -- De onde veio a resposta: a lição a primeira vez, ou uma sessão de
  -- revisão. Sem isto, a revisão contaminava o funil — uma lição revista
  -- seis meses depois aparecia como uma lição começada de novo.
  origin      TEXT NOT NULL DEFAULT 'lesson' CHECK (origin IN ('lesson', 'review')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O funil e a exportação de conta leem por utilizador e por data.
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_created
  ON question_attempts (user_id, created_at DESC);

-- A fila de revisão pergunta, por pergunta, como foi a última vez. Sem este
-- índice era uma leitura de tudo o que a pessoa já respondeu na vida.
CREATE INDEX IF NOT EXISTS idx_question_attempts_question
  ON question_attempts (user_id, trail_id, lesson_id, question_id, created_at DESC);

-- O funil por lição: quantos começaram, agrupado por lição.
CREATE INDEX IF NOT EXISTS idx_question_attempts_lesson
  ON question_attempts (trail_id, lesson_id, created_at DESC);

-- Uma sessão de revisão paga XP, e o livro-razão só aceita as origens que
-- conhece. `review` junta-se à lista pela mesma razão que `challenge_podium`
-- se juntou na 026.
ALTER TABLE xp_events DROP CONSTRAINT IF EXISTS xp_events_source_check;
ALTER TABLE xp_events ADD CONSTRAINT xp_events_source_check
  CHECK (source IN ('legacy', 'lesson', 'recipe', 'challenge', 'challenge_podium', 'streak', 'review'));
