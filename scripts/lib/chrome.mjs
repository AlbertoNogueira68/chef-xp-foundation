/**
 * O mínimo para conduzir um Chrome a sério a partir do Node.
 *
 * Existe porque duas verificações precisam do mesmo: abrir a app num browser
 * verdadeiro, cortar-lhe a rede e ver o que acontece. Puppeteer e Playwright
 * fazem isto e muito mais, com 300 MB de `node_modules` atrás; o protocolo de
 * DevTools é uma ligação WebSocket e mensagens JSON, e o Node 22 já traz o
 * WebSocket.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CAMINHOS_DO_CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

export const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Onde está o Chrome, ou `null` se esta máquina não tiver nenhum. */
export function encontrarChrome() {
  return CAMINHOS_DO_CHROME.find((caminho) => existsSync(caminho)) ?? null;
}

class Cdp {
  #ws;
  #id = 0;
  #pendentes = new Map();
  #eventos = new Map();

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener("message", ({ data }) => {
      const mensagem = JSON.parse(data);
      if (process.env.DEBUG_CDP) console.error("<<", String(data).slice(0, 160));

      if (mensagem.id) {
        const { resolve, reject } = this.#pendentes.get(mensagem.id) ?? {};
        this.#pendentes.delete(mensagem.id);
        mensagem.error ? reject?.(new Error(mensagem.error.message)) : resolve?.(mensagem.result);
      } else {
        this.#eventos.get(mensagem.method)?.forEach((fn) => fn(mensagem.params));
      }
    });
  }

  static async ligar(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error(`sem ligação a ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  enviar(method, params = {}, sessionId) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pendentes.set(id, { resolve, reject });
      if (process.env.DEBUG_CDP) console.error(">>", id, method);
      this.#ws.send(JSON.stringify({ id, method, params, sessionId }));
      // Sem isto, um pedido que o Chrome nunca responde — e há-os, sobretudo
      // com `awaitPromise` sobre uma promessa que nunca resolve — deixa o
      // script pendurado para sempre em vez de falhar.
      setTimeout(() => {
        if (!this.#pendentes.has(id)) return;
        this.#pendentes.delete(id);
        reject(new Error(`o Chrome não respondeu a ${method}`));
      }, 15_000);
    });
  }

  ao(evento, fn) {
    if (!this.#eventos.has(evento)) this.#eventos.set(evento, []);
    this.#eventos.get(evento).push(fn);
  }

  fechar() {
    this.#ws.close();
  }
}

/**
 * Abre um Chrome sem interface, com um separador pronto a usar.
 *
 * Devolve um punhado de funções em vez do protocolo cru: `js` corre código na
 * página, `abrir` navega e espera pelo fim do carregamento, `rede` liga e
 * desliga a ligação, e `ate` insiste até uma condição se verificar.
 */
export async function abrirChrome() {
  const executavel = encontrarChrome();
  if (!executavel) throw new Error("não há Chrome nesta máquina");

  const perfil = await mkdtemp(path.join(tmpdir(), "chefxp-chrome-"));
  const chrome = spawn(executavel, [
    "--headless=new",
    // Porta 0 = o sistema escolhe uma livre, e o Chrome diz qual no stderr.
    // Com uma porta fixa, uma execução anterior mal fechada fazia a seguinte
    // falar com o browser errado.
    "--remote-debugging-port=0",
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);

  const endereco = await new Promise((resolve, reject) => {
    let saida = "";
    const prazo = setTimeout(() => reject(new Error("o Chrome não anunciou a porta")), 20_000);
    chrome.stderr.on("data", (dados) => {
      saida += dados;
      const encontrado = saida.match(/ws:\/\/[^\s]+/);
      if (!encontrado) return;
      clearTimeout(prazo);
      resolve(encontrado[0]);
    });
  });

  const cdp = await Cdp.ligar(endereco);
  const { targetId } = await cdp.enviar("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.enviar("Target.attachToTarget", { targetId, flatten: true });

  await cdp.enviar("Page.enable", {}, sessionId);
  await cdp.enviar("Runtime.enable", {}, sessionId);
  await cdp.enviar("Network.enable", {}, sessionId);

  async function js(expressao) {
    const { result, exceptionDetails } = await cdp.enviar(
      "Runtime.evaluate",
      { expression: `(async () => { ${expressao} })()`, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? "erro na página");
    }
    return result.value;
  }

  /**
   * O `Page.navigate` responde quando a navegação *começa*. Avaliar
   * JavaScript entre esse momento e o fim do carregamento cai num contexto
   * que está a ser destruído — e o Chrome nunca responde a esse pedido. Nem
   * erro, nem nada: silêncio. Daí esperar sempre pelo `load`.
   */
  async function abrir(url) {
    const carregou = new Promise((resolve, reject) => {
      const prazo = setTimeout(() => reject(new Error("a página não carregou")), 20_000);
      cdp.ao("Page.loadEventFired", () => {
        clearTimeout(prazo);
        resolve();
      });
    });
    await cdp.enviar("Page.navigate", { url }, sessionId);
    await carregou;
  }

  const recarregar = () => cdp.enviar("Page.reload", {}, sessionId);

  const rede = (ligada) =>
    cdp.enviar(
      "Network.emulateNetworkConditions",
      { offline: !ligada, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
      sessionId,
    );

  async function ate(descricao, tentativa, { tentativas = 40, intervalo = 500 } = {}) {
    for (let i = 0; i < tentativas; i++) {
      try {
        const valor = await tentativa();
        if (valor) return valor;
      } catch {
        /* ainda não */
      }
      await esperar(intervalo);
    }
    throw new Error(`desisti à espera: ${descricao}`);
  }

  async function fechar() {
    cdp.fechar();
    chrome.kill();
    await esperar(300);
    // O Chrome ainda está a fechar ficheiros do perfil; sem as tentativas, a
    // limpeza rebenta com ENOTEMPTY.
    await rm(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(
      () => {},
    );
  }

  /**
   * Fixa a língua da app e recarrega.
   *
   * A app escolhe a língua pelo browser quando ninguém escolheu nenhuma, e a
   * locale de um runner de CI não é uma coisa em que valha a pena confiar:
   * sem isto, estas verificações passam ou falham conforme a máquina onde
   * correm. Com isto, procuram sempre o texto de uma língua conhecida.
   */
  async function fixarLingua(lingua = "en") {
    await js(`localStorage.setItem("chefxp.lang", ${JSON.stringify(lingua)}); return true;`);
    await recarregar();
  }

  return { cdp, sessionId, js, abrir, recarregar, rede, ate, fechar, fixarLingua };
}

/** Levanta o servidor a servir a build, e devolve como o parar. */
export function servirBuild({ porta, url }) {
  const servidor = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      SERVE_DIST: "true",
      PORT: String(porta),
      NODE_ENV: "development",
      // A app é servida por este mesmo Express, portanto a origem permitida
      // tem de ser esta. Sem isto, o `.env` de quem corre o script aponta para
      // a 5173 do Vite e o CORS recusa os pedidos da própria página.
      FRONTEND_URL: url,
      CORS_ORIGIN: url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  servidor.stderr.on("data", (dados) => process.stderr.write(`[servidor] ${dados}`));
  return () => servidor.kill();
}
