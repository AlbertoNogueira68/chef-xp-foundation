-- 012: moderação — bloquear, denunciar, e alguém a quem a denúncia chega.
--
-- A aplicação alojava fotografias e comentários de terceiros sem dar a
-- ninguém maneira de reagir a eles: não havia denúncia, não havia bloqueio, e
-- o dono de uma receita não podia sequer apagar um comentário na própria
-- receita. Estas três tabelas (e a coluna `role`) são o que sustenta isso.

-- O papel vive na base e não no token de sessão: um papel dentro do JWT
-- ficava congelado até o cookie expirar, e retirar permissões a alguém
-- passava a demorar uma semana.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'moderator'));

-- ---------------------------------------------------------------- --
-- Bloqueios
-- ---------------------------------------------------------------- --
--
-- Uma linha por direção, e a leitura é sempre feita nos dois sentidos: quem
-- eu bloqueei não me aparece, e a quem me bloqueou eu também não apareço.
-- Guardar só um sentido obrigaria cada consulta a lembrar-se de qual.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  -- Como em `notifications`: a regra é do esquema, não de um IF na rota.
  CONSTRAINT user_blocks_nao_e_a_mim CHECK (blocker_id <> blocked_id)
);

-- O sentido inverso é consultado tantas vezes como o direto (a chave primária
-- só cobre o direto).
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id);

-- ---------------------------------------------------------------- --
-- Denúncias
-- ---------------------------------------------------------------- --
--
-- `subject_id` não tem chave estrangeira porque o alvo é polimórfico — uma
-- receita, um comentário ou uma pessoa. A consequência é deliberada e é a
-- mesma do livro-razão do XP: apagar o conteúdo denunciado não apaga a
-- denúncia. O registo diz o que aconteceu, não o que continua a ser verdade,
-- e uma fila de moderação que se esvazia sozinha quando o autor apaga o que
-- publicou não serve para nada.
CREATE TABLE IF NOT EXISTS reports (
  id           BIGSERIAL PRIMARY KEY,
  reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('recipe', 'comment', 'user')),
  subject_id   UUID NOT NULL,

  -- Motivos fechados: uma caixa de texto livre sozinha dá uma fila que não se
  -- consegue ordenar por gravidade.
  reason       TEXT NOT NULL
               CHECK (reason IN ('spam', 'ofensivo', 'perigoso', 'copia', 'outro')),
  details      TEXT CHECK (details IS NULL OR char_length(details) <= 500),

  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'resolved', 'dismissed')),
  -- Quem tratou. `SET NULL` e não cascata: a decisão fica registada mesmo que
  -- a conta do moderador desapareça.
  resolved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT CHECK (resolution IS NULL OR resolution IN ('removido', 'arquivado')),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Denunciar duas vezes a mesma coisa não são duas denúncias. Sem isto, um
  -- clique repetido enchia a fila e inflacionava a contagem por alvo.
  UNIQUE (reporter_id, subject_type, subject_id)
);

-- A fila por omissão é "abertas, mais recentes primeiro".
CREATE INDEX IF NOT EXISTS reports_open_idx
  ON reports (created_at DESC) WHERE status = 'open';

-- Quantas denúncias tem este alvo — a pergunta que decide o que se vê primeiro.
CREATE INDEX IF NOT EXISTS reports_subject_idx ON reports (subject_type, subject_id);
