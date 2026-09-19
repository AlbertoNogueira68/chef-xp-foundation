import { afterEach, describe, expect, test, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { offlineMessage, serverMessage, apiFetch } from "@/services/api";
import { renderWithProviders } from "@/test/utils";

/** Finge o que o browser diz sobre a ligação, e avisa quem estiver a ouvir. */
function ligacao(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

afterEach(() => ligacao(true));

describe("aviso de falta de ligação", () => {
  test("com rede, não ocupa espaço nenhum no ecrã", () => {
    renderWithProviders(<ConnectionStatus />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("sem rede, aparece e diz o que ainda dá para fazer", () => {
    renderWithProviders(<ConnectionStatus />);
    ligacao(false);

    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent(/you're offline/i);
    // A promessa que a app faz agora: continuar é possível, e o que se fizer
    // fica guardado até haver rede.
    expect(aviso).toHaveTextContent(/saved here/i);
  });

  test("volta a desaparecer quando a rede volta", () => {
    renderWithProviders(<ConnectionStatus />);
    ligacao(false);
    ligacao(true);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("servidor em baixo, com rede a funcionar", () => {
  test('o erro diz o que se passa, em vez de "Failed to fetch"', async () => {
    // É o caso de quem pára o servidor para experimentar o modo offline: o
    // browser continua a dizer que está online, porque está.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/learning/lessons/1/answer", { method: "POST" })).rejects.toThrow(
      serverMessage(),
    );
  });

  test("a barra aparece a dizer que é o servidor, não a rede", async () => {
    renderWithProviders(<ConnectionStatus />);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await act(async () => {
      await apiFetch("/recipes").catch(() => {});
    });

    expect(screen.getByRole("status")).toHaveTextContent(/server isn't responding/i);
  });

  test("um pedido que volta a responder faz a barra desaparecer", async () => {
    renderWithProviders(<ConnectionStatus />);
    const rede = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await act(async () => {
      await apiFetch("/recipes").catch(() => {});
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    rede.mockResolvedValue(
      new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await act(async () => {
      await apiFetch("/recipes");
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("uma resposta vazia do service worker conta como falha de rede", async () => {
    // 503 com este cabeçalho = não havia rede nem cópia guardada. Para quem
    // chamou é uma falha de rede, não um erro que o servidor tenha decidido.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"error":"Sem ligação e sem cópia guardada."}', {
        status: 503,
        headers: { "X-ChefXP-Cache": "vazia" },
      }),
    );

    await expect(apiFetch("/recipes")).rejects.toThrow(serverMessage());
  });
});

describe("gravar sem rede", () => {
  test("falha com uma frase que se percebe, sem chegar a sair da app", async () => {
    ligacao(false);
    const rede = vi.spyOn(globalThis, "fetch");

    await expect(apiFetch("/recipes", { method: "POST", body: "{}" })).rejects.toThrow(
      offlineMessage(),
    );
    expect(rede).not.toHaveBeenCalled();
  });

  test("ler continua a ser tentado — é o service worker que responde da cache", async () => {
    ligacao(false);
    const rede = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiFetch("/recipes")).resolves.toEqual({ ok: true });
    expect(rede).toHaveBeenCalled();
  });
});
