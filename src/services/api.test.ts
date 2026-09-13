import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, SESSION_EXPIRED_EVENT } from "@/services/api";

/**
 * O cliente HTTP é onde o CSRF e a sessão expirada vivem do lado do browser.
 * Um erro aqui não aparece num ecrã: aparece em todos.
 */
describe("cliente da API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    document.cookie = "csrf=token-de-teste";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const resposta = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  test("um GET não leva cabeçalho de CSRF", async () => {
    fetchMock.mockResolvedValue(resposta({ ok: true }));

    await apiFetch("/recipes");

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBeNull();
    expect(init.credentials).toBe("include");
  });

  test("uma escrita leva o token que está no cookie", async () => {
    fetchMock.mockResolvedValue(resposta({ ok: true }));

    await apiFetch("/recipes", { method: "POST", body: JSON.stringify({}) });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("token-de-teste");
  });

  test("sem cookie de CSRF, vai buscá-lo antes de escrever", async () => {
    document.cookie = "csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    fetchMock
      .mockResolvedValueOnce(resposta({ csrfToken: "acabado-de-emitir" }))
      .mockResolvedValueOnce(resposta({ ok: true }));

    await apiFetch("/recipes", { method: "POST", body: JSON.stringify({}) });

    expect(fetchMock.mock.calls[0][0]).toContain("/auth/csrf");
    const [, init] = fetchMock.mock.calls[1];
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("acabado-de-emitir");
  });

  test("um 401 avisa a aplicação de que a sessão caiu", async () => {
    fetchMock.mockResolvedValue(resposta({ error: "não autenticado" }, 401));
    const ouvinte = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, ouvinte);

    await expect(apiFetch("/users/me")).rejects.toThrow();
    expect(ouvinte).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, ouvinte);
  });

  test("o /auth/me pode perguntar sem provocar o aviso", async () => {
    fetchMock.mockResolvedValue(resposta({ error: "não autenticado" }, 401));
    const ouvinte = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, ouvinte);

    await expect(apiFetch("/auth/me", { silentOn401: true })).rejects.toThrow();
    expect(ouvinte).not.toHaveBeenCalled();

    window.removeEventListener(SESSION_EXPIRED_EVENT, ouvinte);
  });

  test("um 403 não é sessão expirada — é uma recusa", async () => {
    fetchMock.mockResolvedValue(resposta({ error: "Password incorreta" }, 403));
    const ouvinte = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, ouvinte);

    await expect(apiFetch("/users/me", { method: "DELETE" })).rejects.toThrow(
      /password incorreta/i,
    );
    // Foi este o defeito real: com 401, errar a password expulsava a pessoa.
    expect(ouvinte).not.toHaveBeenCalled();

    window.removeEventListener(SESSION_EXPIRED_EVENT, ouvinte);
  });

  test("a mensagem de erro do servidor chega a quem chamou", async () => {
    fetchMock.mockResolvedValue(resposta({ error: "Já participaste neste desafio" }, 409));

    await expect(apiFetch("/challenges/1/entries", { method: "POST" })).rejects.toThrow(
      "Já participaste neste desafio",
    );
  });
});
