import { log } from "./logger.js";

/** Uma vez por hora chega: são linhas que só ocupam espaço. */
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Apaga o que já expirou: pedidos de criação de conta nunca confirmados e
 * tokens de email/password fora de prazo. Nenhum destes serve para nada
 * depois de expirar — `checkToken` já os recusa — mas sem isto a tabela só
 * crescia, e cada linha guarda um endereço de email que ninguém confirmou.
 */
export async function purgeExpiredTokens(pool, { now = new Date() } = {}) {
  const signups = await pool.query(`DELETE FROM pending_signups WHERE expires_at < $1`, [now]);
  const tokens = await pool.query(`DELETE FROM auth_tokens WHERE expires_at < $1`, [now]);
  return { pendingSignups: signups.rowCount ?? 0, authTokens: tokens.rowCount ?? 0 };
}

/** Corre a limpeza no arranque e depois de hora a hora. Devolve o `stop`. */
export function startHousekeeping(pool, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  async function pass() {
    try {
      const removed = await purgeExpiredTokens(pool);
      if (removed.pendingSignups + removed.authTokens > 0) {
        log.info(removed, "tokens expirados removidos");
      }
    } catch (error) {
      // Limpar é opcional: falhar não pode derrubar nada.
      log.warn({ err: error }, "falha na limpeza de tokens expirados");
    }
  }

  void pass();
  const timer = setInterval(() => void pass(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
