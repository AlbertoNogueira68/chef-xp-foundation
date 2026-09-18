-- 011: contas em espera — o email é confirmado antes de a conta existir.
--
-- Criar conta passou a ser em dois tempos: escreve-se o email, confirma-se o
-- link que chega, e só do outro lado é que se escolhe o nome e a password.
-- Esta tabela guarda o meio do caminho.
--
-- Uma tabela à parte, e não uma linha em `users` sem password: uma conta a
-- meio em `users` ocupava o nome de utilizador e o email de quem nunca
-- confirmou nada — bastava escrever o endereço de outra pessoa para lhe
-- trancar o registo —, e todas as consultas do resto da app passavam a ter de
-- se lembrar de a excluir.
--
-- Como em `auth_tokens`, guarda-se o SHA-256 do token e nunca o token: o que
-- vai no email não existe em lado nenhum do servidor depois de ser enviado.

CREATE TABLE IF NOT EXISTS pending_signups (
  token_hash TEXT PRIMARY KEY,

  -- Único: pedir o link outra vez substitui o anterior em vez de deixar mais
  -- uma chave válida a circular na caixa de correio.
  email      TEXT NOT NULL UNIQUE,

  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_signups_expiry_idx
  ON pending_signups (expires_at);
