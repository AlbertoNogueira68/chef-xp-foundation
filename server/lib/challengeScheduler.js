import { settleDueChallenges } from "../services/challengeSettlement.js";

/** De quanto em quanto tempo se passa pelos desafios terminados. */
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * A tarefa que fecha os desafios cujo prazo passou.
 *
 * Um `setInterval` dentro do processo, e não um cron do sistema nem uma fila:
 * o trabalho é uma consulta a um índice parcial de linhas que quase nunca
 * existem, e pagar uma peça de infraestrutura nova por isso seria pagar a
 * operação de a manter de pé para sempre. Se um dia houver mais do que uma
 * instância, o que impede o pagamento a dobrar não é esta função — é o
 * `FOR UPDATE` com `settled_at IS NULL` em `settleChallenge`, que já lá está.
 *
 * O `unref()` importa: sem ele, um intervalo pendurado mantinha o processo
 * vivo e o `SIGTERM` do Docker nunca chegava ao fim.
 *
 * @returns {() => void} para parar a tarefa no encerramento.
 */
export function startChallengeScheduler(
  pool,
  { intervalMs = Number(process.env.CHALLENGE_SETTLE_INTERVAL_MS) || DEFAULT_INTERVAL_MS } = {},
) {
  let running = false;

  async function pass() {
    // Uma passagem lenta não se sobrepõe à seguinte: fechar cinquenta
    // desafios de uma vez demora mais do que o intervalo, e duas passagens em
    // paralelo seriam duas transações a disputar as mesmas linhas.
    if (running) return;
    running = true;

    try {
      const resultado = await settleDueChallenges(pool);
      if (resultado.settled.length > 0) {
        console.log(`[challenges] ${resultado.settled.length} desafio(s) fechado(s)`);
      }
      for (const falha of resultado.failed) {
        console.error(`[challenges] falha ao fechar ${falha.id}:`, falha.error);
      }
    } catch (error) {
      // O agendador nunca derruba o servidor: a próxima passagem tenta outra vez.
      console.error("[challenges] falha na passagem do agendador:", error);
    } finally {
      running = false;
    }
  }

  // Uma passagem no arranque: o servidor pode ter estado desligado durante o
  // fim de um desafio, e ninguém tem de esperar pelo primeiro intervalo.
  void pass();

  const timer = setInterval(() => void pass(), intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
