-- 009: distinguir o dia prometido do dia espontâneo.
--
-- Sem isto a adesão ao compromisso não é medível. Uma sessão cumprida à quinta
-- e uma sessão cumprida à quarta por acaso ficavam iguais na tabela, e a taxa
-- de "promessas cumpridas" acabava a incluir cozinhados que ninguém prometeu —
-- uma adesão que sobe por se cozinhar fora do plano é uma métrica que se
-- engana a si própria.
--
-- Não é derivável a posteriori: o plano pode ter mudado desde então, e é
-- exatamente por isso que a linha tem de guardar o que era verdade no dia em
-- que nasceu. É a mesma regra da 008 — a linha gravada manda sobre a
-- derivação.

ALTER TABLE cooking_sessions
  ADD COLUMN IF NOT EXISTS promised BOOLEAN NOT NULL DEFAULT false;

-- As linhas que já existem com estado 'planned' ou 'missed' só podiam ter
-- nascido da geração do plano; logo, foram prometidas.
UPDATE cooking_sessions SET promised = true WHERE status IN ('planned', 'missed');

COMMENT ON COLUMN cooking_sessions.promised IS
  'Se este dia foi prometido pelo plano. Fixado quando a linha nasce, nunca recalculado.';
