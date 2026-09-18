import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clearOutbox, enqueue, outboxItems } from "./outbox";
import { SYNC_EVENT, flushOutbox, type ResumoDaSincronizacao } from "./sync";

/**
 * A sincronização é onde a promessa "fica guardado e é enviado quando houver
 * rede" se cumpre ou se desfaz. O que estes testes protegem é sobretudo a
 * ordem: o XP é um livro-razão, e enviar a lição 3 antes da 2 porque a 2
 * falhou seria inventar uma história que não aconteceu.
 */

const respostaOk = (corpo: unknown = { ok: true }) =>
  new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const licao = (ref: string) => ({
  descricao: `Lição: ${ref}`,
  path: `/learning/lessons/${ref}/complete`,
  method: "POST" as const,
  body: { answers: [] },
  tipo: "licao" as const,
  ref,
});

/**
 * Uma resposta nova a cada chamada.
 *
 * `mockResolvedValue` devolveria sempre o *mesmo* objeto `Response`, e o corpo
 * de um Response só se lê uma vez: à segunda, o teste falhava a fingir uma
 * falha de rede que nunca aconteceu.
 */
function redeQueResponde(corpo?: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => respostaOk(corpo));
}

/** O caminho que o `apiFetch` percorre inclui um pedido de CSRF. */
function caminhos(rede: { mock: { calls: unknown[][] } }) {
  return rede.mock.calls
    .map((chamada) => String(chamada[0]))
    .filter((url) => !url.includes("/auth/csrf"));
}

beforeEach(async () => {
  await clearOutbox();
  document.cookie = "csrf=token-de-teste";
});

afterEach(() => clearOutbox());

describe("enviar o que ficou em espera", () => {
  test("envia pela ordem por que aconteceu", async () => {
    const rede = redeQueResponde();
    await enqueue(licao("massa"));
    await enqueue(licao("sopa"));

    const resumo = await flushOutbox();

    expect(caminhos(rede)).toEqual([
      "/api/learning/lessons/massa/complete",
      "/api/learning/lessons/sopa/complete",
    ]);
    expect(resumo.enviados).toHaveLength(2);
    expect(await outboxItems()).toEqual([]);
  });

  test("se a rede cair a meio, pára e não salta o que falhou", async () => {
    const rede = vi.spyOn(globalThis, "fetch");
    rede.mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).includes("/auth/csrf")) return respostaOk();
      if (String(url).includes("massa")) return respostaOk();
      throw new TypeError("Failed to fetch");
    });

    await enqueue(licao("massa"));
    await enqueue(licao("sopa"));
    await enqueue(licao("arroz"));

    const resumo = await flushOutbox();

    expect(resumo.enviados).toHaveLength(1);
    expect(resumo.porEnviar).toBe(2);
    // A sopa falhou, e o arroz — que veio depois — nem foi tentado.
    expect(caminhos(rede).some((url) => url.includes("arroz"))).toBe(false);
    expect((await outboxItems()).map((item) => item.ref)).toEqual(["sopa", "arroz"]);
  });

  test("o que o servidor recusa sai da fila, com explicação", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).includes("/auth/csrf")) return respostaOk();
      return new Response(JSON.stringify({ error: "Termina as lições anteriores primeiro" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    });

    await enqueue(licao("sobremesa"));
    const resumo = await flushOutbox();

    // Insistir num 403 dava a mesma resposta amanhã. Sai, e alguém é avisado.
    expect(resumo.recusados).toHaveLength(1);
    expect(resumo.recusados[0].erro).toMatch(/lições anteriores/i);
    expect(await outboxItems()).toEqual([]);
  });

  test("avisa quem estiver a ouvir, com o XP que o servidor pagou", async () => {
    redeQueResponde({ passed: true, xpEarned: 40, streakBonus: 10 });
    await enqueue(licao("massa"));

    const avisos: ResumoDaSincronizacao[] = [];
    const ouvir = (evento: Event) => avisos.push((evento as CustomEvent).detail);
    window.addEventListener(SYNC_EVENT, ouvir);

    await flushOutbox();
    window.removeEventListener(SYNC_EVENT, ouvir);

    expect(avisos).toHaveLength(1);
    const corpo = avisos[0].enviados[0].resposta as { xpEarned: number };
    expect(corpo.xpEarned).toBe(40);
  });

  test("duas sincronizações ao mesmo tempo contam como uma", async () => {
    const rede = redeQueResponde();
    await enqueue(licao("massa"));

    // O evento `online` e o arranque da app podem disparar as duas ao mesmo
    // tempo; sem o travão, a mesma lição ia duas vezes à rede.
    await Promise.all([flushOutbox(), flushOutbox()]);

    expect(caminhos(rede)).toEqual(["/api/learning/lessons/massa/complete"]);
  });
});
