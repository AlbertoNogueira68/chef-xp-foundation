/**
 * Prova a promessa que a app faz a quem cozinha sem rede: **responde-se à
 * lição offline, e as respostas são mesmo guardadas quando a rede volta.**
 *
 *   npm run check:offline-lesson
 *
 * O percurso, num Chrome sem interface e contra o servidor a sério:
 *
 *   1. entra com a conta de demonstração e abre a lição seguinte;
 *   2. **corta a rede** e responde às perguntas todas;
 *   3. confirma que cada resposta fica guardada e que nenhum coração é
 *      descontado (offline ninguém sabe se a resposta está certa);
 *   4. confirma que no fim a lição está na caixa de saída, no armazenamento
 *      do browser — e não perdida;
 *   5. **repõe a rede** e confirma que a fila se esvazia sozinha e que o XP
 *      do dia sobe, ou seja, que o servidor recebeu e pagou.
 *
 * Os testes em jsdom cobrem cada peça disto em isolamento. O que só aqui se
 * vê é o conjunto: o service worker, a fila, o React e o servidor a fazerem a
 * mesma coisa ao mesmo tempo.
 */

import { abrirChrome, encontrarChrome, esperar, servirBuild } from "./lib/chrome.mjs";

const PORTA = 4175;
const URL_EXTERNA = process.env.CHECK_URL?.replace(/\/$/, "") ?? null;
const URL_BASE = URL_EXTERNA ?? `http://localhost:${PORTA}`;
const CONTA = { email: "demo@chef-xp.local", password: "chef123" };

if (!encontrarChrome()) {
  console.log("[lição] sem Chrome nesta máquina — verificação saltada");
  process.exit(0);
}

const paraFechar = [];
let falhou = false;

try {
  if (URL_EXTERNA) console.log(`[lição] a usar o servidor que já estava em ${URL_BASE}`);
  else paraFechar.push(servirBuild({ porta: PORTA, url: URL_BASE }));

  const browser = await abrirChrome();
  paraFechar.push(() => browser.fechar());
  const { js, abrir, rede, ate, fixarLingua } = browser;

  await ate("o servidor responder", async () => (await fetch(`${URL_BASE}/api/health`)).ok);

  /**
   * O leitor de lições é uma camada por cima do percurso. Sem limitar a busca
   * a ela, um clique caía num cartão do trilho que está por baixo.
   */
  const noLeitor = (corpo) => `
    const leitor = document.querySelector("div.fixed.inset-0");
    if (!leitor) return null;
    const botoes = () => [...leitor.querySelectorAll("button")].filter((b) => !b.disabled);
    const rotulo = (b) => b.innerText.replace(/\\s+/g, " ").trim();
    ${corpo}`;

  const textoDoLeitor = () =>
    js(`const leitor = document.querySelector("div.fixed.inset-0") ?? document.body;
        return leitor.innerText.replace(/\\s+/g, " ");`);

  const clicar = (texto) =>
    js(
      noLeitor(
        "const alvo = botoes().find((b) => rotulo(b).toLowerCase().includes(" +
          JSON.stringify(texto.toLowerCase()) +
          ")); if (!alvo) return false; alvo.click(); return true;",
      ),
    );

  /**
   * A fila vive em IndexedDB — é lá que uma fotografia de missão cabe, o que
   * o `localStorage` da primeira versão não permitia.
   */
  const fila = () =>
    js(`
      const db = await new Promise((resolve, reject) => {
        const pedido = indexedDB.open("chef-xp", 1);
        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => reject(pedido.error);
      });
      if (!db.objectStoreNames.contains("outbox")) return [];
      const itens = await new Promise((resolve, reject) => {
        const pedido = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => reject(pedido.error);
      });
      return itens.map((item) => ({
        descricao: item.descricao,
        path: item.path,
        respostas: item.body?.answers?.length ?? null,
        tamanho: JSON.stringify(item.body ?? {}).length,
      }));`);
  const xpDeHoje = async () => {
    const texto = await js(`return document.body.innerText;`);
    return Number(texto.match(/(\d+)\/\d+\s*XP TODAY/i)?.[1] ?? -1);
  };

  /**
   * Um clique de cada vez, e depois volta a olhar para o ecrã.
   *
   * Clicar nos passos todos de uma vez não funciona numa pergunta de ordenar:
   * cada clique redesenha a lista e as referências anteriores ficam obsoletas.
   */
  const umPasso = () =>
    js(
      noLeitor(`
      // Ancorada ao início: sem isso, um passo de ordenar como "Pôr a faca e os
      // ingredientes ao alcance" passava por botão de navegação e nunca era
      // escolhido — e o "Confirmar ordem" ficava desligado para sempre.
      const navegacao = /^(previous|next|continue|start|test|start over|back|ingredients$|photo missing)/i;
      if (/Answer saved|Correct answer:|Saved on this device/.test(leitor.innerText)) {
        return "respondida";
      }

      // Estimativa: um campo numérico. O valor é indiferente — o que se prova
      // aqui é que a resposta fica guardada, não que está certa.
      const numero = leitor.querySelector("input[type=number]");
      if (numero && !numero.disabled && !numero.value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(numero, "2");
        numero.dispatchEvent(new Event("input", { bubbles: true }));
        return "escreveu";
      }

      const confirmar = botoes().find((b) => /^confirmar/i.test(rotulo(b)));
      if (confirmar) { confirmar.click(); return "confirmou"; }

      // O botão de fechar não tem texto: sem o excluir, o robô fechava a lição.
      const opcao = botoes().find((b) => rotulo(b) && !navegacao.test(rotulo(b)));
      if (!opcao) return "nada";
      opcao.click();
      return "respondeu";`),
    );

  async function responder() {
    for (let i = 0; i < 14; i++) {
      const passo = await umPasso();
      if (passo === "respondida" || passo === "nada") return passo;
      await esperar(250);
    }
    return "desisti";
  }

  /* 1. Entrar e abrir a lição seguinte. */
  await abrir(`${URL_BASE}/auth`);
  await fixarLingua("en");
  await ate("o ecrã de entrada", () =>
    js(`return Boolean(document.querySelector("#login-email"));`),
  );
  const login = await js(`
    const r = await fetch("/api/auth/login", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: ${JSON.stringify(JSON.stringify(CONTA))},
    });
    return r.status;`);
  if (login !== 200) throw new Error(`o login de demonstração devolveu ${login}`);

  await abrir(`${URL_BASE}/challenges`);
  // Esperar pelo botão e não pela ausência de "Loading": o texto de espera
  // mudou de língua uma vez, e a espera passou a não esperar por nada.
  await ate("o percurso carregar", () =>
    js(
      `return [...document.querySelectorAll("button")].some((b) => b.innerText.includes("Start"));`,
    ),
  );
  const xpAntes = await xpDeHoje();

  if (
    !(await js(`
    const alvo = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Start"));
    if (!alvo) return false;
    alvo.click();
    return true;`))
  ) {
    throw new Error("não havia nenhuma lição por fazer para a conta de demonstração");
  }

  await ate("a lição abrir", async () => (await textoDoLeitor())?.includes("Start prep"));
  await clicar("Start prep");
  for (let i = 0; i < 10 && (await clicar("Next")); i++) await esperar(300);
  await clicar("Test what you know");
  await ate("o quiz", async () => /Question \d+ of \d+/.test((await textoDoLeitor()) ?? ""));
  console.log("[lição] no quiz, com rede");

  /* 2. Cortar a rede e responder à lição inteira. */
  await rede(false);
  console.log("[lição] rede cortada");

  let respostas = 0;
  for (let volta = 0; volta < 12; volta++) {
    await responder();
    await esperar(500);

    const ecra = (await textoDoLeitor()) ?? "";
    if (ecra.includes("Saved on this device")) break;
    if (!/Answer saved/.test(ecra)) {
      throw new Error(`sem rede, a pergunta não ficou guardada: ${ecra.slice(0, 120)}`);
    }
    respostas++;

    // Offline não se sabe se a resposta está certa; descontar um coração por
    // uma resposta que ninguém corrigiu seria castigar por adivinhação.
    if (!/♥ ♥ ♥/.test(ecra)) throw new Error("perderam-se corações sem correção nenhuma");

    await clicar("Continue");
    await esperar(500);
    if (((await textoDoLeitor()) ?? "").includes("Saved on this device")) break;
  }
  console.log(`[lição] ${respostas} respostas dadas e guardadas sem rede`);

  /* 3. A lição terminou e está em espera, não perdida. */
  const fim = (await textoDoLeitor()) ?? "";
  if (!fim.includes("Saved on this device")) {
    throw new Error(`a lição não acabou no estado de espera: ${fim.slice(0, 160)}`);
  }

  const emEspera = await fila();
  if (emEspera.length !== 1)
    throw new Error(`esperava 1 item na fila, encontrei ${emEspera.length}`);
  if (!emEspera[0].path.endsWith("/complete")) throw new Error("o item na fila não é a lição");
  console.log(
    `[lição] na caixa de saída (IndexedDB): ${emEspera[0].descricao}` +
      ` — ${emEspera[0].respostas} respostas, ${emEspera[0].tamanho} bytes`,
  );

  /* 4. Repor a rede: a fila esvazia-se sozinha e o servidor paga. */
  await rede(true);
  console.log("[lição] rede reposta");

  await ate("a fila esvaziar", async () => (await fila()).length === 0, { tentativas: 30 });

  // O aviso é a única altura em que quem respondeu offline fica a saber o
  // resultado: sem rede não houve correção nenhuma. Dizer só "enviado" seria
  // deixá-la sem a informação que mais lhe interessa.
  const aviso = await ate(
    "a app dizer se a lição passou",
    async () => {
      const ecra = await js(`return document.body.innerText;`);
      return ecra.match(/"[^"]+": (you passed[^\n]*|you didn't pass[^\n]*)/)?.[0] ?? null;
    },
    { tentativas: 20 },
  );
  console.log(`[lição] a app disse: ${aviso}`);

  await clicar("Continue");

  // O robô responde sem saber as respostas — offline não há correção que o
  // guie — por isso a lição tanto pode passar como chumbar. Os dois provam o
  // que aqui importa: o veredicto só existe porque o servidor recebeu a fila
  // e corrigiu. O XP só se exige quando há XP a pagar.
  if (aviso.includes("didn't pass")) {
    console.log("[lição] enviada e corrigida pelo servidor (chumbou, portanto sem XP)");
  } else {
    await ate("o XP do dia subir", async () => (await xpDeHoje()) > xpAntes, { tentativas: 30 });
    console.log(`[lição] enviada: XP de hoje passou de ${xpAntes} para ${await xpDeHoje()}`);
  }
  console.log("[lição] ok");
} catch (erro) {
  console.error(`[lição] falhou: ${erro.message}`);
  falhou = true;
} finally {
  for (const fechar of paraFechar.reverse()) {
    try {
      await fechar();
    } catch (erro) {
      console.warn(`[lição] limpeza: ${erro.message}`);
    }
  }
}

process.exit(falhou ? 1 : 0);
