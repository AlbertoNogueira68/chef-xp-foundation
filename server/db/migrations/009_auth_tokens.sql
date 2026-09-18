-- 009: tokens de email — recuperação de password e verificação de conta.
--
-- Os dois fluxos são a mesma mecânica: geramos um segredo, mandamo-lo por
-- email, e quem o trouxer de volta prova que lê aquela caixa de correio. Uma
-- tabela só, distinguida por `kind`, porque duas tabelas iguais divergiriam
-- à primeira correção feita só numa delas.
--
-- Guarda-se o SHA-256 do token, nunca o token. Quem leia esta tabela — uma
-- cópia de segurança, um SELECT mal-intencionado — fica com hashes que não
-- servem para nada: o que vai no email não existe em lado nenhum do servidor
-- depois de ser enviado.

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('password_reset', 'email_verification')),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- O endereço para onde foi enviado. Na verificação é o que passa a estar
  -- confirmado; se a pessoa mudar de email entretanto, o token antigo deixa
  -- de servir — é por isso que fica gravado aqui em vez de ser lido de
  -- `users` no momento de usar.
  email      TEXT NOT NULL,

  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O que se faz sempre: apagar os tokens anteriores da pessoa ao emitir um
-- novo, e limpar os expirados.
CREATE INDEX IF NOT EXISTS auth_tokens_user_idx
  ON auth_tokens (user_id, kind);

CREATE INDEX IF NOT EXISTS auth_tokens_expiry_idx
  ON auth_tokens (expires_at);

-- Quando é que este email foi confirmado. Nulo = nunca.
--
-- As contas que já existem ficam com nulo e não são expulsas por isso: a
-- verificação informa, não tranca. Trancar contas a meio da vida do produto
-- era mudar as regras a quem já cá estava.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
