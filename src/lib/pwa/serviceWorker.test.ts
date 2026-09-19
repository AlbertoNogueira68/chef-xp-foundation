import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O service worker é código que só corre quando a rede falha — precisamente
 * quando ninguém está a olhar para o inspetor. Estes testes carregam o
 * ficheiro de verdade (`public/sw.js`) num ambiente de mentira e provam o que
 * ele faz em cada caso.
 *
 * Nada aqui é especial para os testes: o `sw.js` não tem ganchos nem sinais
 * escondidos. O que se observa é o que o browser observaria — o que foi à
 * rede, o que ficou na cache, e o que é devolvido a quem pediu.
 */

const CODIGO = readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");
const ORIGEM = "https://chefxp.test";

const chave = (pedido: RequestInfo) => (typeof pedido === "string" ? pedido : pedido.url);

class CacheFalsa {
  itens = new Map<string, Response>();

  async match(pedido: RequestInfo) {
    return this.itens.get(chave(pedido));
  }
  async put(pedido: RequestInfo, resposta: Response) {
    this.itens.set(chave(pedido), resposta);
  }
  async addAll(urls: string[]) {
    for (const url of urls) this.itens.set(url, new Response(`conteúdo de ${url}`));
  }
  async keys() {
    return [...this.itens.keys()].map((url) => new Request(new URL(url, ORIGEM)));
  }
  async delete(pedido: RequestInfo) {
    return this.itens.delete(chave(pedido));
  }
}

class CacheStorageFalsa {
  caches = new Map<string, CacheFalsa>();

  async open(nome: string) {
    if (!this.caches.has(nome)) this.caches.set(nome, new CacheFalsa());
    return this.caches.get(nome)!;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(nome: string) {
    return this.caches.delete(nome);
  }
  async match(pedido: RequestInfo) {
    for (const cache of this.caches.values()) {
      const encontrada = await cache.match(pedido);
      if (encontrada) return encontrada;
    }
    return undefined;
  }
}

type Rede = (pedido: Request) => Promise<Response>;

/** Carrega o `sw.js` com um mundo à volta que podemos observar. */
function montarWorker(rede: Rede) {
  const ouvintes = new Map<string, (evento: unknown) => void>();
  const caches = new CacheStorageFalsa();
  const idas: string[] = [];

  const fetchObservado: Rede = (pedido) => {
    idas.push(typeof pedido === "string" ? pedido : pedido.url);
    return rede(pedido);
  };

  const self = {
    addEventListener: (tipo: string, fn: (evento: unknown) => void) => ouvintes.set(tipo, fn),
    location: { origin: ORIGEM },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
  };

  new Function("self", "caches", "fetch", CODIGO)(self, caches, fetchObservado);

  async function instalar() {
    const promessas: Promise<unknown>[] = [];
    ouvintes.get("install")?.({ waitUntil: (p: Promise<unknown>) => promessas.push(p) });
    await Promise.all(promessas);
  }

  /** Dispara um `fetch` e devolve o que o worker respondeu, se respondeu. */
  async function pedir(url: string, { mode, ...init }: RequestInit & { mode?: string } = {}) {
    const request = new Request(new URL(url, ORIGEM), init);
    // O construtor do `Request` recusa `mode: "navigate"` — é um modo que só o
    // browser atribui, a pedidos que ele próprio cria. Põe-se por cima: para o
    // worker é apenas uma etiqueta que ele lê.
    if (mode) Object.defineProperty(request, "mode", { value: mode });

    // Um objeto e não uma variável solta: atribuída dentro do `respondWith`,
    // o TypeScript perdia o tipo e dava-a por sempre nula.
    const captura: { resposta: Promise<Response> | null } = { resposta: null };
    ouvintes.get("fetch")?.({
      request,
      respondWith: (p: Promise<Response>) => {
        captura.resposta = p;
      },
    });

    return {
      respondeu: captura.resposta !== null,
      resposta: captura.resposta ? await captura.resposta : null,
    };
  }

  return { instalar, pedir, caches, idas };
}

const semRede: Rede = () => Promise.reject(new TypeError("Failed to fetch"));
const comRede =
  (corpo: string, init: ResponseInit = {}): Rede =>
  () =>
    Promise.resolve(new Response(corpo, { status: 200, ...init }));

describe("service worker: navegação", () => {
  test("sem rede, abre a app que ficou guardada na instalação", async () => {
    const worker = montarWorker(semRede);
    await worker.instalar();

    const { resposta } = await worker.pedir("/feed", { mode: "navigate" });
    expect(await resposta!.text()).toContain("conteúdo de /");
  });

  test("sem rede e sem nada guardado, mostra o ecrã de offline", async () => {
    const worker = montarWorker(semRede);
    // Sem instalar: é a primeira visita, e nem o shell existe.
    const cache = await worker.caches.open("chefxp-shell-v3");
    await cache.put("/offline.html", new Response("ecrã de offline"));

    const { resposta } = await worker.pedir("/recipe/1", { mode: "navigate" });
    expect(await resposta!.text()).toBe("ecrã de offline");
  });
});

describe("service worker: API", () => {
  test("com rede, responde da rede e guarda uma cópia", async () => {
    const worker = montarWorker(comRede('{"receitas":[]}'));

    const { resposta } = await worker.pedir("/api/recipes");
    expect(await resposta!.text()).toBe('{"receitas":[]}');

    const cache = await worker.caches.open("chefxp-api-v3");
    expect(await cache.match(`${ORIGEM}/api/recipes`)).toBeDefined();
  });

  test("sem rede, devolve a cópia e diz que é uma cópia", async () => {
    const worker = montarWorker(semRede);
    const cache = await worker.caches.open("chefxp-api-v3");
    await cache.put(`${ORIGEM}/api/recipes`, new Response('{"receitas":["arroz"]}'));

    const { resposta } = await worker.pedir("/api/recipes");
    expect(await resposta!.text()).toBe('{"receitas":["arroz"]}');
    // Sem este cabeçalho, a app mostrava dados de ontem como se fossem de agora.
    expect(resposta!.headers.get("X-ChefXP-Cache")).toBe("offline");
  });

  test("sem rede e sem cópia, responde 503 e não inventa dados", async () => {
    const worker = montarWorker(semRede);

    const { resposta } = await worker.pedir("/api/recipes");
    expect(resposta!.status).toBe(503);
    expect(await resposta!.json()).toEqual({ error: "Sem ligação e sem cópia guardada." });
  });

  test("um erro do servidor não fica guardado", async () => {
    const worker = montarWorker(comRede('{"error":"Unauthorized"}', { status: 401 }));

    await worker.pedir("/api/auth/me");

    const cache = await worker.caches.open("chefxp-api-v3");
    expect(await cache.match(`${ORIGEM}/api/auth/me`)).toBeUndefined();
  });

  test("escrever não passa pelo worker — falha como tem de falhar", async () => {
    const worker = montarWorker(semRede);

    const { respondeu } = await worker.pedir("/api/recipes", { method: "POST", body: "{}" });
    // Nada de filas silenciosas: o pedido segue o seu caminho e falha.
    expect(respondeu).toBe(false);
  });
});

describe("service worker: ficheiros", () => {
  test("os módulos do Vite vão à rede primeiro e só depois à cache", async () => {
    // Em desenvolvimento o JavaScript da app vem de `/src/`, sem hash no nome.
    // Guardá-lo como imutável dava módulos velhos a cada alteração; não o
    // guardar de todo dava uma app instalada que offline não arrancava.
    const worker = montarWorker(comRede("módulo"));

    await worker.pedir("/src/main.tsx");
    await worker.pedir("/src/main.tsx");
    expect(worker.idas).toHaveLength(2); // com rede, é sempre a rede

    const semLigacao = montarWorker(semRede);
    const cache = await semLigacao.caches.open("chefxp-outros-v3");
    await cache.put(`${ORIGEM}/src/main.tsx`, new Response("módulo guardado"));

    const { resposta } = await semLigacao.pedir("/src/main.tsx");
    expect(await resposta!.text()).toBe("módulo guardado");
  });

  test("um ficheiro com hash no nome só vai à rede uma vez", async () => {
    const worker = montarWorker(comRede("código"));

    await worker.pedir("/assets/index-a1b2c3.js");
    await worker.pedir("/assets/index-a1b2c3.js");

    expect(worker.idas).toHaveLength(1);
  });

  test("as fotografias guardadas têm um limite", async () => {
    const worker = montarWorker(comRede("imagem"));

    for (let i = 0; i < 65; i++) await worker.pedir(`/uploads/foto-${i}.jpg`);

    const cache = await worker.caches.open("chefxp-imagens-v3");
    expect(cache.itens.size).toBe(60);
    // Saem as mais antigas, não as últimas que a pessoa viu.
    expect(await cache.match(`${ORIGEM}/uploads/foto-0.jpg`)).toBeUndefined();
    expect(await cache.match(`${ORIGEM}/uploads/foto-64.jpg`)).toBeDefined();
  });
});
