import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NEW_VERSION_EVENT, applyUpdate, registerServiceWorker } from "@/lib/pwa/register";

/**
 * O registo do service worker, com um `navigator.serviceWorker` de mentira.
 *
 * Isto não prova que o browser instala o worker — prova o que está deste lado:
 * que o registo é pedido mesmo quando a página já acabou de carregar (o erro
 * que esta função teve à primeira), que uma versão nova é anunciada em vez de
 * entrar sozinha, e que a primeira instalação não anuncia nada.
 */

type Ouvinte = () => void;

class WorkerFalso {
  state = "installing";
  mensagens: unknown[] = [];
  private ouvintes: Ouvinte[] = [];

  addEventListener(_tipo: string, fn: Ouvinte) {
    this.ouvintes.push(fn);
  }
  postMessage(mensagem: unknown) {
    this.mensagens.push(mensagem);
  }
  instalar() {
    this.state = "installed";
    for (const fn of this.ouvintes) fn();
  }
}

class RegistoFalso {
  waiting: WorkerFalso | null = null;
  installing: WorkerFalso | null = null;
  private ouvintes: Ouvinte[] = [];

  addEventListener(_tipo: string, fn: Ouvinte) {
    this.ouvintes.push(fn);
  }
  /** O browser encontrou uma versão nova e começou a instalá-la. */
  encontrarVersaoNova() {
    this.installing = new WorkerFalso();
    for (const fn of this.ouvintes) fn();
    return this.installing;
  }
}

let registo: RegistoFalso;
let registar: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("PROD", true);
  registo = new RegistoFalso();
  registar = vi.fn(async () => registo);

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: registar,
      controller: {},
      addEventListener: () => {},
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  // @ts-expect-error — limpar o que se pôs em cima do navigator
  delete navigator.serviceWorker;
});

/** O `jsdom` já disparou o `load` muito antes de o teste correr. */
const paginaJaCarregada = () => document.readyState === "complete";

describe("registo do service worker", () => {
  test("regista mesmo com a página já carregada", async () => {
    expect(paginaJaCarregada()).toBe(true);

    registerServiceWorker();
    await vi.waitFor(() => expect(registar).toHaveBeenCalledWith("/sw.js"));
  });

  test("regista também em desenvolvimento — é lá que a app é experimentada", async () => {
    vi.stubEnv("PROD", false);

    registerServiceWorker();
    await vi.waitFor(() => expect(registar).toHaveBeenCalledWith("/sw.js"));
  });

  test("VITE_DISABLE_SW=true desliga o registo", async () => {
    // O travão para quem estiver a depurar cache e queira o browser sem
    // intermediários pelo meio.
    vi.stubEnv("VITE_DISABLE_SW", "true");

    registerServiceWorker();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(registar).not.toHaveBeenCalled();
  });

  test("uma versão nova é anunciada, não imposta", async () => {
    const avisos = vi.fn();
    window.addEventListener(NEW_VERSION_EVENT, avisos);

    registerServiceWorker();
    await vi.waitFor(() => expect(registar).toHaveBeenCalled());

    const nova = registo.encontrarVersaoNova();
    expect(avisos).not.toHaveBeenCalled(); // ainda a instalar

    nova.instalar();
    expect(avisos).toHaveBeenCalledTimes(1);
    // Só troca quando alguém aceitar — nada foi enviado ao worker até aqui.
    expect(nova.mensagens).toEqual([]);

    applyUpdate();
    expect(nova.mensagens).toEqual([{ type: "SKIP_WAITING" }]);

    window.removeEventListener(NEW_VERSION_EVENT, avisos);
  });

  test("a primeira instalação não avisa de versão nenhuma", async () => {
    // Sem `controller` não há versão anterior: é a primeira visita, e um
    // aviso de "há uma versão nova" aqui só assustava sem motivo.
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: registar, controller: null, addEventListener: () => {} },
    });

    const avisos = vi.fn();
    window.addEventListener(NEW_VERSION_EVENT, avisos);

    registerServiceWorker();
    await vi.waitFor(() => expect(registar).toHaveBeenCalled());
    registo.encontrarVersaoNova().instalar();

    expect(avisos).not.toHaveBeenCalled();
    window.removeEventListener(NEW_VERSION_EVENT, avisos);
  });
});
