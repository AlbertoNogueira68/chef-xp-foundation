import { type ApiError, apiFetch } from "@/services/api";
import { outboxItems, removeFromOutbox, type OutboxItem } from "./outbox";

/**
 * Esvaziar a caixa de saída quando a rede volta.
 *
 * Um de cada vez e pela ordem de entrada. Ao primeiro erro de rede pára, e o
 * que falta fica para a próxima tentativa — saltar um item para tentar o
 * seguinte era trocar a ordem por que as coisas aconteceram, que é
 * precisamente o que não se pode fazer com um livro-razão de XP.
 */

export const SYNC_EVENT = "chef-xp:sync";

export type ResultadoDeEnvio = {
  item: OutboxItem;
  estado: "enviado" | "recusado";
  /** O que o servidor devolveu (enviado) ou porque recusou. */
  resposta?: unknown;
  erro?: string;
};

export type ResumoDaSincronizacao = {
  enviados: ResultadoDeEnvio[];
  recusados: ResultadoDeEnvio[];
  /** O que ficou por tentar, por a rede ter falhado outra vez. */
  porEnviar: number;
};

/**
 * Uma sincronização de cada vez.
 *
 * Sem isto, o evento `online` e o arranque da app podiam disparar duas
 * passagens ao mesmo tempo e o mesmo item ia duas vezes — inofensivo por o
 * servidor ser idempotente, mas o XP aparecia a dobrar no ecrã antes de o
 * servidor desmentir.
 */
let aDecorrer: Promise<ResumoDaSincronizacao> | null = null;

export function flushOutbox(): Promise<ResumoDaSincronizacao> {
  if (aDecorrer) return aDecorrer;
  aDecorrer = executar().finally(() => {
    aDecorrer = null;
  });
  return aDecorrer;
}

async function executar(): Promise<ResumoDaSincronizacao> {
  const enviados: ResultadoDeEnvio[] = [];
  const recusados: ResultadoDeEnvio[] = [];
  const fila = await outboxItems();

  for (const [indice, item] of fila.entries()) {
    try {
      const resposta = await apiFetch(item.path, {
        method: item.method,
        body: item.body === undefined ? undefined : JSON.stringify(item.body),
      });
      await removeFromOutbox(item.id);
      enviados.push({ item, estado: "enviado", resposta });
    } catch (erro) {
      const falha = erro as ApiError;

      // `status: 0` é falha de rede: a rede caiu outra vez a meio. Pára aqui,
      // com este item e os seguintes intactos.
      if (!falha.status) {
        return terminar({ enviados, recusados, porEnviar: fila.length - indice });
      }

      // O servidor respondeu e recusou. Tentar outra vez daria o mesmo — sai
      // da fila, e a app explica-se a quem estava à espera.
      await removeFromOutbox(item.id);
      recusados.push({ item, estado: "recusado", erro: falha.message });
    }
  }

  return terminar({ enviados, recusados, porEnviar: 0 });
}

function terminar(resumo: ResumoDaSincronizacao) {
  if (resumo.enviados.length > 0 || resumo.recusados.length > 0) {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: resumo }));
  }
  return resumo;
}
