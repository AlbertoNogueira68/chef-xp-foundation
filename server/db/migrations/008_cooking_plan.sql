-- 008: o compromisso passa a ser lido, não só previsto.
--
-- As tabelas nasceram na 005 e nunca tiveram código. Ao ligá-las, duas
-- colunas revelaram-se erradas:
--
-- `cooking_plans.tz` era uma segunda fonte de verdade para o fuso, ao lado de
-- `users.time_zone`. Duas respostas possíveis à pergunta "que dia é hoje para
-- esta pessoa" é uma a mais: bastava divergirem para uma sessão ser marcada
-- como falhada no dia em que foi cumprida. O fuso do utilizador é o do
-- utilizador, e é o mesmo que decide o streak.
--
-- `reminder_at` pressupunha um canal de notificação que o projeto não tem —
-- não há push nem email. Uma coluna que promete um lembrete que nunca toca
-- descreve uma intenção, não o sistema. Volta quando houver por onde enviar.

ALTER TABLE cooking_plans DROP COLUMN IF EXISTS tz;
ALTER TABLE cooking_plans DROP COLUMN IF EXISTS reminder_at;

-- Os dias vão em ISO — 1 = segunda … 7 = domingo. Sem a convenção escrita na
-- própria restrição, o 0 tanto podia ser domingo (JS) como segunda (humano),
-- e o erro só aparecia à quarta-feira de alguém.
ALTER TABLE cooking_plans DROP CONSTRAINT IF EXISTS cooking_plans_weekdays_iso;
ALTER TABLE cooking_plans ADD CONSTRAINT cooking_plans_weekdays_iso
  CHECK (
    array_length(weekdays, 1) IS NULL
    OR (weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[] AND array_length(weekdays, 1) <= 7)
  );

-- Entre uma e sete vezes por semana. Zero não é um compromisso, é não ter
-- plano — e para isso apaga-se a linha.
ALTER TABLE cooking_plans DROP CONSTRAINT IF EXISTS cooking_plans_target_range;
ALTER TABLE cooking_plans ADD CONSTRAINT cooking_plans_target_range
  CHECK (target_week BETWEEN 1 AND 7);

-- A semana é lida inteira de cada vez, por utilizador. O UNIQUE já existente
-- em (user_id, planned_on) serve de índice.
