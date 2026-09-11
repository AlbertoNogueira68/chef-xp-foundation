import { query } from "../db/index.js";
import {
  MAX_ATTEMPTS,
  checkCode,
  cooldownRemaining,
  expiryFor,
  generateCode,
  hashCode,
} from "../domain/accountCodes.js";
import { sendMail } from "./mailer.js";

/**
 * Códigos por email, do lado da base de dados.
 *
 * As regras — quantos dígitos, quanto tempo, quantas tentativas — estão em
 * `domain/accountCodes.js` e têm testes próprios. Aqui só se guarda, procura e
 * envia.
 */

const TEXTS = {
  verify: {
    subject: "Confirma a tua conta ChefXP",
    body: (code) =>
      `O teu código de confirmação é ${code}.\n\n` +
      "Expira daqui a 15 minutos. Se não foste tu a criar esta conta, ignora este email.",
  },
  reset: {
    subject: "Recuperar a password do ChefXP",
    body: (code) =>
      `O teu código para definir uma password nova é ${code}.\n\n` +
      "Expira daqui a 15 minutos. Se não foste tu a pedir, ignora este email — " +
      "a tua password actual continua a valer.",
  },
};

/** O último código pedido, seja ele válido ou não. Serve para o intervalo. */
async function lastCode(userId, purpose) {
  const { rows } = await query(
    `SELECT id, code_hash, attempts, expires_at, consumed_at, created_at
       FROM email_codes
      WHERE user_id = $1 AND purpose = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, purpose],
  );
  return rows[0] ?? null;
}

/**
 * Emite um código e envia-o.
 *
 * Os códigos anteriores por usar são invalidados: dois códigos válidos ao
 * mesmo tempo duplicavam as hipóteses de quem adivinha, e a pessoa que pediu
 * um novo está a olhar para o novo.
 */
export async function issueCode(user, purpose, { now = new Date() } = {}) {
  const previous = await lastCode(user.id, purpose);
  const wait = cooldownRemaining(previous?.created_at, now);
  if (wait > 0) return { sent: false, retryAfter: wait };

  await query(
    `UPDATE email_codes SET consumed_at = now()
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [user.id, purpose],
  );

  const code = generateCode();
  await query(
    `INSERT INTO email_codes (user_id, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, purpose, hashCode(code), expiryFor(purpose, now)],
  );

  const text = TEXTS[purpose];
  await sendMail({
    to: user.email,
    subject: text.subject,
    text: text.body(code),
  });

  return { sent: true, retryAfter: 0 };
}

/**
 * Verifica um código e gasta-o.
 *
 * Cada tentativa falhada é contada mesmo quando o código está certo mas
 * expirado: é o contador que impede que se percorram as cem mil hipóteses.
 */
export async function consumeCode(userId, purpose, code, { now = new Date() } = {}) {
  const row = await lastCode(userId, purpose);

  const record = row
    ? {
        codeHash: row.code_hash,
        attempts: row.attempts,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
      }
    : null;

  const result = checkCode(record, code, now);

  if (!result.ok) {
    // Só se conta a tentativa enquanto o código ainda está vivo. Somar em cima
    // de um código já morto não protege nada e só enche a tabela.
    if (row && !row.consumed_at && result.reason === "mismatch") {
      await query(
        `UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1`,
        [row.id],
      );
    }
    return result;
  }

  await query(`UPDATE email_codes SET consumed_at = now() WHERE id = $1`, [row.id]);
  return { ok: true };
}

export { MAX_ATTEMPTS };
