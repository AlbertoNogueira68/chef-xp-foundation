-- 014: contas da Google com o email confirmado.
--
-- O login com a Google só aceita contas cujo email a Google diz ter
-- verificado (`email_verified` no id_token). Mas o callback não o registava:
-- as contas criadas por ali ficavam "por confirmar", com o aviso no perfil a
-- pedir uma confirmação que já tinha acontecido, e as métricas a contá-las
-- como não confirmadas. O código passa a marcá-lo; isto acerta as que já
-- existem.
--
-- Só quando o email da conta é o mesmo da identidade Google. Quem tenha
-- mudado de endereço depois de ligar a Google não vê o endereço novo dado
-- por confirmado com a prova do antigo.

UPDATE users u
   SET email_verified_at = COALESCE(a.created_at, now())
  FROM auth_identities a
 WHERE a.user_id = u.id
   AND a.provider = 'google'
   AND lower(a.email) = lower(u.email)
   AND u.email_verified_at IS NULL;
