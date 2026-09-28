/**
 * Prova que a app abre sem rede — num Chrome a sério, não num simulacro.
 *
 *   npm run check:offline
 *
 * Levanta o servidor a servir a build, abre o Chrome sem interface, espera
 * que o service worker fique ativo, **corta a rede** e recarrega a página. Se
 * o que aparecer for o dinossauro em vez da aplicação, sai com erro. E, já
 * sem rede, tenta gravar alguma coisa: a app tem de se explicar em vez de
 * mostrar o "Failed to fetch" do browser.
 *
 * Porquê isto e não mais um teste em jsdom: o `sw.js` já tem os seus testes, e
 * nenhum deles apanharia o que aconteceu aqui — o worker estava certo e não
 * chegava a ser registado, porque o registo só existia na build de produção e
 * o `.env` do servidor punha `import.meta.env.PROD` a `false`. Só um browser
 * verdadeiro, a carregar a build verdadeira, apanha essa classe de erro.
 *
 * `CHECK_URL` aponta o script a um servidor que já esteja de pé (o contentor
 * de desenvolvimento, por exemplo) em vez de levantar o seu.
 */

import { abrirChrome, encontrarChrome, servirBuild } from "./lib/chrome.mjs";

const PORTA = 4174;
const URL_EXTERNA = process.env.CHECK_URL?.replace(/\/$/, "") ?? null;
const URL_BASE = URL_EXTERNA ?? `http://localhost:${PORTA}`;

if (!encontrarChrome()) {
  // Sem Chrome não há nada a provar aqui, e falhar por isso seria castigar
  // quem clona o projeto numa máquina sem ele. Define CHROME_PATH se o
  // tiveres noutro sítio.
  console.log("[offline] sem Chrome nesta máquina — verificação saltada");
  process.exit(0);
}

const paraFechar = [];
let falhou = false;

try {
  if (URL_EXTERNA) {
    console.log(`[offline] a usar o servidor que já estava em ${URL_BASE}`);
  } else {
    paraFechar.push(servirBuild({ porta: PORTA, url: URL_BASE }));
  }

  const browser = await abrirChrome();
  paraFechar.push(() => browser.fechar());
  const { js, abrir, recarregar, rede, ate, fixarLingua } = browser;

  await ate("o servidor responder", async () => (await fetch(`${URL_BASE}/api/health`)).ok);
  console.log(`[offline] servidor de pé em ${URL_BASE}`);

  /* 1. Primeira visita, com rede. */
  await abrir(`${URL_BASE}/feed`);
  await fixarLingua("en");
  await ate("a app desenhar-se", () =>
    js(`return document.querySelector("#root")?.children.length > 0;`),
  );

  // `ready` resolve mal o worker existe — pode ainda estar em "activating", e
  // nessa altura a instalação (que é quando o shell é guardado) ainda não
  // terminou. Esperar por "activated" é esperar pelo que interessa.
  await ate("o service worker ativar", async () => {
    const estado = await js(
      `const r = await navigator.serviceWorker.ready; return r.active?.state ?? null;`,
    );
    return estado === "activated";
  });
  console.log("[offline] service worker ativo");

  /**
   * O que tem mesmo de ser verdade antes de cortar a rede.
   *
   * Aqui esperava-se por `navigator.serviceWorker.controller` e contava-se
   * `caches.keys().length`. As duas coisas estavam erradas, e a primeira
   * fazia esta verificação falhar sozinha de vez em quando.
   *
   * O `controller` só fica preenchido quando o `clients.claim()` do worker
   * apanha esta página — que foi aberta antes de existir worker nenhum. Isso
   * é uma corrida, e não é sequer o que interessa: o que a app precisa para
   * abrir sem rede é de a **navegação seguinte** ser servida pelo worker, e
   * uma navegação em scope é servida pelo worker ativo esteja a página atual
   * controlada ou não. Estava-se a esperar por um efeito secundário em vez da
   * condição.
   *
   * E a contagem de caches variava entre 3 e 4 conforme o momento, porque as
   * caches de assets e de API nascem à primeira utilização. Contar coisas que
   * ainda estão a ser criadas é medir o relógio, não o estado.
   *
   * O que se espera agora é conteúdo: a cache do shell tem de ter resposta
   * para "/" (é ela que o `navegacao()` do worker devolve sem rede) e para
   * "/offline.html". Nenhuma das duas aparece a meio — o `install` do worker
   * grava-as com um `addAll`, que é tudo ou nada, e só depois disso é que o
   * worker chega a "activated". Ou seja: isto é verdade no instante em que a
   * espera anterior terminou, e a falha passa a significar alguma coisa.
   */
  const noShell = await ate("o shell guardado na cache", async () => {
    const guardados = await js(`
      const nome = (await caches.keys()).find((n) => n.startsWith("chefxp-shell-"));
      if (!nome) return null;
      const cache = await caches.open(nome);
      const essenciais = ["/", "/offline.html"];
      const encontrados = [];
      for (const url of essenciais) {
        if (await cache.match(url)) encontrados.push(url);
      }
      return encontrados.length === essenciais.length ? (await cache.keys()).length : null;`);
    return guardados;
  });
  console.log(`[offline] shell na cache: ${noShell} entradas, com "/" e "/offline.html"`);

  /* 2. Cortar a rede e recarregar. */
  await rede(false);
  console.log("[offline] rede cortada");
  await recarregar();

  /**
   * Agora sim, o worker tem de estar ao comando — e agora é determinista.
   *
   * Depois de uma navegação com um worker ativo, a página **é** controlada;
   * se não for, foi a rede que a serviu e não o worker, e o que se seguisse
   * não provava nada sobre funcionar sem rede. Antes, esta pergunta era feita
   * no único momento em que a resposta ainda podia ser "ainda não".
   */
  const controlada = await js(`return Boolean(navigator.serviceWorker.controller);`);
  if (!controlada) {
    throw new Error("a página recarregou sem o worker ao comando — não foi ele que a serviu");
  }

  // Não basta o `#root` ter filhos: o primeiro que lá aparece é o indicador
  // de "A carregar…", e dar isso por bom era aceitar uma app eternamente a
  // carregar como prova de que funciona offline.
  await ate("a app desenhar-se sem rede", async () => {
    const texto = await js(`return document.body.innerText;`);
    return !texto.includes("Loading") && texto.trim().length > 20;
  });

  // Sem rede, a sessão não se confirma e a app leva ao ecrã de entrada. Este
  // é o momento em que ela está mesmo desenhada: antes disto, o `#root` já
  // tem filhos mas o router ainda está a decidir para onde vai.
  await ate("o ecrã de entrada", () =>
    js(`return Boolean(document.querySelector("#login-email"));`),
  );

  const titulo = await js(`return document.title;`);
  const texto = await js(`return document.body.innerText.slice(0, 200).replace(/\\s+/g, " ");`);

  if (!titulo.includes("ChefXP")) throw new Error(`abriu, mas com o título "${titulo}"`);
  if (/ERR_INTERNET_DISCONNECTED|No internet|Sem ligação à Internet/i.test(texto)) {
    throw new Error("apareceu o ecrã de erro do browser");
  }
  console.log(`[offline] sem rede, a app abriu: "${titulo}" — ${texto.slice(0, 80)}…`);

  /* 3. E, já sem rede, tentar gravar. */
  await js(`
    const escrever = (campo, valor) => {
      const nativo = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      nativo.call(campo, valor);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    };
    escrever(document.querySelector("#login-email"), "offline@chef-xp.test");
    escrever(document.querySelector("#login-password"), "Chef12345!");
    document.querySelector("form").requestSubmit();
    return true;`);

  await ate("a app explicar porque não gravou", async () => {
    const ecra = await js(`return document.body.innerText;`);
    if (/Failed to fetch|NetworkError/i.test(ecra)) {
      throw new Error("a app mostrou o erro cru do browser");
    }
    return /You're offline|didn't answer/i.test(ecra);
  });
  console.log('[offline] ao tentar gravar, a app explica-se em vez de mostrar "Failed to fetch"');

  console.log("[offline] ok");
} catch (erro) {
  console.error(`[offline] falhou: ${erro.message}`);
  falhou = true;
} finally {
  for (const fechar of paraFechar.reverse()) {
    try {
      await fechar();
    } catch (erro) {
      console.warn(`[offline] limpeza: ${erro.message}`);
    }
  }
}

process.exit(falhou ? 1 : 0);
