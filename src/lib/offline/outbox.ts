/**
 * A caixa de saída: o que ficou por enviar enquanto não havia rede.
 *
 * Isto é uma mudança de posição em relação ao que estava escrito aqui antes —
 * e a razão anterior não era má: o XP é um livro-razão com ordem, e reenviar
 * meia lição fora de ordem daria um estado que ninguém pediu. O que torna a
 * fila segura é a fila respeitar essa ordem e o servidor já ser idempotente
 * onde interessa (`sourceRef` na lição, `ON CONFLICT DO NOTHING` no
 * progresso): reenviar a mesma lição não paga XP duas vezes.
 *
 * Três regras que fazem o resto do trabalho:
 *
 *   1. **Ordem estrita.** Envia-se do mais antigo para o mais novo, um de cada
 *      vez, e ao primeiro erro de rede pára-se. Nunca se salta um item para
 *      tentar o seguinte.
 *   2. **Um teto por item e outro para a fila.** Uma fotografia de missão tem
 *      megabytes; cem delas encheriam o disco de quem só queria cozinhar.
 *   3. **O que o servidor recusa, sai.** Um 4xx não melhora com insistência —
 *      é removido e a app diz o que aconteceu, em vez de tentar para sempre.
 *
 * Guarda-se em IndexedDB e não em `localStorage`: as fotografias dos
 * checkpoints das missões vão para aqui, e `localStorage` tem cinco megabytes
 * no total e guarda texto. A primeira versão disto era `localStorage` e
 * recusava as fotos por isso mesmo.
 *
 * Sem IndexedDB (um ambiente de teste, um browser em modo restrito) a fila
 * passa a viver em memória: perde-se ao fechar o separador, mas a app funciona
 * na mesma em vez de rebentar.
 */

const BASE = "chef-xp";
const ARMAZEM = "outbox";
const VERSAO = 1;

/** Oito megabytes por item: uma fotografia redimensionada cabe folgada. */
const TAMANHO_MAXIMO = 8_000_000;
/** E um limite de itens, para uma fila esquecida não crescer sem fim. */
const ITENS_MAXIMOS = 50;

/** Emitido sempre que a fila muda. A UI mostra quantos faltam. */
export const OUTBOX_EVENT = "chef-xp:outbox";

export type OutboxItem = {
  id: string;
  criadoEm: number;
  /** O que se diz à pessoa: "Lição: Massa fresca". */
  descricao: string;
  path: string;
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Para a app saber o que recarregar quando este item for enviado. */
  tipo: "licao" | "desafio" | "foto";
  ref?: string;
};

/* ------------------------------------------------------------------ */
/* Onde isto fica guardado                                            */
/* ------------------------------------------------------------------ */

const emMemoria = new Map<string, OutboxItem>();
let base: Promise<IDBDatabase | null> | null = null;

function abrirBase(): Promise<IDBDatabase | null> {
  if (base) return base;

  base = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);

    const pedido = indexedDB.open(BASE, VERSAO);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(ARMAZEM)) {
        pedido.result.createObjectStore(ARMAZEM, { keyPath: "id" });
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    // Modo privado em alguns browsers, ou permissão negada: em memória vai.
    pedido.onerror = () => resolve(null);
  });

  return base;
}

function pedir<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function lerTudo(): Promise<OutboxItem[]> {
  const db = await abrirBase();
  const itens = db
    ? await pedir(db.transaction(ARMAZEM, "readonly").objectStore(ARMAZEM).getAll())
    : [...emMemoria.values()];

  // A ordem é a que interessa a tudo o resto — e o IndexedDB devolve por
  // chave, não por data.
  return (itens as OutboxItem[]).sort((a, b) => a.criadoEm - b.criadoEm);
}

async function escrever(item: OutboxItem) {
  const db = await abrirBase();
  if (db) await pedir(db.transaction(ARMAZEM, "readwrite").objectStore(ARMAZEM).put(item));
  else emMemoria.set(item.id, item);
}

async function apagar(id: string) {
  const db = await abrirBase();
  if (db) await pedir(db.transaction(ARMAZEM, "readwrite").objectStore(ARMAZEM).delete(id));
  else emMemoria.delete(id);
}

/* ------------------------------------------------------------------ */
/* A contagem, que a UI lê sem esperar                                */
/* ------------------------------------------------------------------ */

let contagem = 0;

async function anunciar() {
  contagem = (await lerTudo()).length;
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT, { detail: { total: contagem } }));
}

/** O último valor conhecido — o React precisa de o ler sem esperar. */
export function outboxCount(): number {
  return contagem;
}

/** Relê a fila e atualiza a contagem. Corre uma vez no arranque da app. */
export async function refreshOutboxCount() {
  await anunciar();
}

export function outboxItems(): Promise<OutboxItem[]> {
  return lerTudo();
}

/**
 * Põe um pedido na fila. Devolve o item, ou `null` se não coube.
 *
 * Um mesmo `ref` substitui o anterior em vez de se acumular: responder à
 * mesma lição duas vezes offline deixa a última tentativa, não duas, e
 * repetir a fotografia de um passo substitui a que lá estava.
 */
export async function enqueue(
  item: Omit<OutboxItem, "id" | "criadoEm">,
): Promise<OutboxItem | null> {
  const tamanho = item.body ? JSON.stringify(item.body).length : 0;
  if (tamanho > TAMANHO_MAXIMO) return null;

  const fila = await lerTudo();
  if (fila.length >= ITENS_MAXIMOS) return null;

  const novo: OutboxItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: Date.now(),
  };

  if (novo.ref) {
    const anterior = fila.find(
      (existente) => existente.tipo === novo.tipo && existente.ref === novo.ref,
    );
    if (anterior) await apagar(anterior.id);
  }

  await escrever(novo);
  await anunciar();
  return novo;
}

export async function removeFromOutbox(id: string) {
  await apagar(id);
  await anunciar();
}

export async function clearOutbox() {
  for (const item of await lerTudo()) await apagar(item.id);
  await anunciar();
}

/** Avisa quando a fila muda — incluindo noutro separador do mesmo browser. */
export function subscribeOutbox(callback: () => void) {
  const mudou = () => callback();
  window.addEventListener(OUTBOX_EVENT, mudou);
  return () => window.removeEventListener(OUTBOX_EVENT, mudou);
}
