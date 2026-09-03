-- 006: início de sessão com fornecedores externos (Google).
--
-- Duas mudanças, e a primeira é a que obriga à migration: `password_hash`
-- era NOT NULL. Uma conta criada por SSO não tem password nenhuma, e
-- guardar um hash inventado seria pior do que guardar nulo — daria a
-- entender que existe uma password quando não existe.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Uma tabela em vez de uma coluna `google_sub`: o dia em que entrar outro
-- fornecedor não precisa de mexer em `users`, e o UNIQUE por (provider,
-- subject) impede que duas contas reclamem a mesma identidade externa.
CREATE TABLE IF NOT EXISTS auth_identities (
  provider     TEXT NOT NULL CHECK (provider IN ('google')),
  -- O `sub` do fornecedor. Nunca o email: o email de uma conta Google pode
  -- mudar, o sub não. Ligar pelo email seria ligar por algo mutável.
  subject      TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities (user_id);

-- Um utilizador não pode ter duas identidades do mesmo fornecedor.
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_user_provider
  ON auth_identities (user_id, provider);
