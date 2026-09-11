-- 010: confirmar a conta e recuperar a password.
--
-- O registo já devolvia `needsEmailConfirmation: false` — um marcador deixado
-- à espera desta migration. Deixa de ser mentira.

-- Nulo = por confirmar. Uma data e não um booleano: saber *quando* foi
-- confirmada responde a perguntas que um sim/não não responde.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Quem entra pela Google já teve o email confirmado por ela — e o nosso
-- callback recusa `email_verified` falso, por isso estas contas estão
-- confirmadas por construção. Pedir-lhes um código seria pedir a confirmação
-- de uma confirmação.
UPDATE users u
   SET email_verified_at = i.created_at
  FROM auth_identities i
 WHERE i.user_id = u.id AND u.email_verified_at IS NULL;

-- Mudar a password tem de acabar com as outras sessões.
--
-- Os cookies desta app são JWT com sete dias de validade e nada no servidor
-- que os possa cancelar. Sem isto, recuperar a password por se desconfiar de
-- um acesso indevido não expulsava esse acesso durante uma semana — ou seja,
-- a recuperação não recuperava nada.
--
-- O número entra no token e é comparado a cada pedido autenticado. Custa uma
-- leitura por pedido; é o preço de um token que se pode revogar.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_epoch INTEGER NOT NULL DEFAULT 0;

-- Códigos de seis dígitos enviados por email.
--
-- Guarda-se o hash e nunca o código: quem leia esta tabela não pode entrar em
-- contas alheias nem confirmar emails que não são seus. É a mesma regra da
-- password, pela mesma razão — um código por usar vale tanto como ela.
CREATE TABLE IF NOT EXISTS email_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  code_hash   TEXT NOT NULL,
  -- Seis dígitos são cem mil hipóteses: sem limite de tentativas, adivinha-se.
  attempts    SMALLINT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A procura é sempre "o código válido mais recente desta pessoa para isto".
CREATE INDEX IF NOT EXISTS email_codes_lookup_idx
  ON email_codes (user_id, purpose, created_at DESC);

-- Limpar o que já não serve é barato e mantém a tabela pequena.
CREATE INDEX IF NOT EXISTS email_codes_expiry_idx ON email_codes (expires_at);
