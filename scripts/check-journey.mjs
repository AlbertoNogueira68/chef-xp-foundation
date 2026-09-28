/**
 * A jornada da defesa, verificada num browser a sério.
 *
 * Criar conta → fazer a primeira lição de ponta a ponta → publicar uma receita
 * → vê-la no feed. É o caminho exacto que se mostra a quem avalia o projeto, e
 * era o único que nenhum teste percorria: há 431 testes de servidor e 200 de
 * interface, e nenhum deles junta as duas metades no browser.
 *
 * O que isto apanha e o resto não apanha: um `apiFetch` que perdeu o cookie,
 * uma rota do React Router que deixou de existir, um botão que fica
 * `disabled` por uma razão que só acontece com dados reais, um CSP que bloqueia
 * o que a página precisa. Nada disso aparece num teste com o servidor
 * simulado, e tudo isso estraga uma demonstração.
 *
 * As respostas certas vêm de `shared/curriculum.json` — o mesmo sítio de onde
 * o servidor as lê. Um script do repositório pode saber o que um utilizador
 * não sabe; o que não pode é o **browser** saber, e é isso que o teste da
 * lição confirma pelo caminho: o gabarito nunca está na página antes de se
 * responder.
 *
 * Uso:
 *   npm run check:journey                      (contra http://localhost:5173)
 *   BASE_URL=http://localhost:3010 npm run ... (contra a build servida)
 *
 * Precisa de um servidor sem SMTP configurado: aí criar conta é um formulário
 * só, sem link de email para clicar. Com SMTP ligado, o registo passa pelo
 * endereço confirmado e este percurso não se aplica — o script diz isso e sai.
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { encontrarChrome } from "./lib/chrome.mjs";

const BASE = (process.env.BASE_URL ?? "http://localhost:5173").replace(/\/$/, "");
const HEADFUL = process.env.HEADFUL === "true";
/** Margem generosa: a primeira lição tem quatro passos e cinco perguntas. */
const TIMEOUT = Number(process.env.JOURNEY_TIMEOUT_MS ?? 20_000);

const curriculum = JSON.parse(readFileSync(new URL("../shared/curriculum.json", import.meta.url)));
const PRIMEIRA = curriculum.units[0].lessons[0];

const sufixo = Math.random().toString(36).slice(2, 8);
const CONTA = {
  username: `juri${sufixo}`,
  email: `juri${sufixo}@chef-xp.test`,
  password: "Chef12345!",
};

const RECEITA = {
  title: `Arroz de tomate do júri ${sufixo}`,
  description: "Tomate maduro, arroz solto e o refogado feito com tempo.",
  ingredients: "arroz\ntomate\ncebola\nazeite",
};

let passos = 0;
const passo = (texto) => console.log(`  ${String(++passos).padStart(2)}. ${texto}`);
const falhar = (texto) => {
  throw new Error(texto);
};

/* ---------------------------------------------------------------- *
 * A lição
 * ---------------------------------------------------------------- */

/** A resposta certa de uma pergunta, lida do currículo. */
function respostaCerta(questionId) {
  const q = PRIMEIRA.questions.find((x) => x.id === questionId);
  if (!q) falhar(`a pergunta ${questionId} não existe no currículo`);
  return q;
}

/**
 * Responde a uma pergunta no ecrã, seja do tipo que for.
 *
 * Cada tipo tem a sua maneira de se responder, e é de propósito que este
 * script a faz como um dedo a faria — carregar na opção, tocar nos passos por
 * ordem, escrever o número — em vez de chamar a API. O que está em teste é a
 * página.
 */
async function responder(page, pergunta) {
  if (pergunta.type === "choice" || pergunta.type === "judge") {
    await page.getByRole("button", { name: pergunta.correctAnswer, exact: true }).click();
    return;
  }

  if (pergunta.type === "order") {
    // Os passos vêm baralhados do servidor: toca-se neles pela ordem do
    // currículo, e cada toque tira o botão da lista de escolhas.
    for (const item of pergunta.correctOrder) {
      await page.getByRole("button", { name: item, exact: true }).click();
    }
    await page.getByRole("button", { name: /Confirm order/i }).click();
    return;
  }

  if (pergunta.type === "estimate") {
    await page.locator('input[type="number"]').fill(String(pergunta.correctAnswer));
    await page.getByRole("button", { name: /^Confirm$/i }).click();
    return;
  }

  falhar(`não sei responder a uma pergunta do tipo ${pergunta.type}`);
}

/* ---------------------------------------------------------------- *
 * A jornada
 * ---------------------------------------------------------------- */

async function jornada(page) {
  /* 1 — a app abre */
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  passo("a aplicação abre");

  /* 2 — criar conta */
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });

  // Esperar pelo separador antes de lhe tocar: `count()` não espera, e numa
  // build servida a página existe antes de o React a hidratar — o clique caía
  // no vazio e o teste ficava no formulário de entrar.
  const registo = page.getByRole("tab", { name: /Sign up/i });
  await registo.waitFor({ state: "visible", timeout: TIMEOUT });
  await registo.click();

  // O Radix desmonta o separador inativo, por isso o formulário só existe
  // depois do clique — e `count()` não espera por nada. Espera-se pelo campo,
  // e a alternativa (o formulário de pedir link) identifica o outro caminho.
  const campoNome = page.locator("#register-username");
  try {
    await campoNome.waitFor({ state: "visible", timeout: TIMEOUT });
  } catch {
    if (await page.locator("#signup-email").count()) {
      falhar(
        "o formulário é o de pedir link por email — o servidor tem SMTP " +
          "configurado, e aí criar conta passa pelo endereço confirmado. Este " +
          "percurso precisa de um servidor sem SMTP.",
      );
    }
    falhar("o formulário de criar conta não apareceu");
  }

  await campoNome.fill(CONTA.username);
  await page.locator("#register-email").fill(CONTA.email);
  await page.locator("#register-password").fill(CONTA.password);
  await page.getByRole("button", { name: /Create account/i }).click();

  // A conta criada deixa de estar em /auth: quem já entrou não volta ao
  // formulário. É isto, e não um toast, que prova que a sessão existe.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: TIMEOUT });
  passo(`conta criada e sessão aberta (${CONTA.username})`);

  /* 3 — o percurso de aprendizagem, e a visita guiada que vem à frente dele */
  await page.goto(`${BASE}/challenges`, { waitUntil: "domcontentloaded" });

  // Quem cria conta agora vê a apresentação antes de ver a aplicação, e quem
  // avalia o projeto também vai ver. Faz parte do percurso: se a visita guiada
  // ficar presa, a demonstração fica presa com ela. Enquanto ela está aberta,
  // o resto da página está `aria-hidden` — daí ter de sair primeiro.
  const saltarVisita = page.getByRole("button", { name: /^Skip$/i });
  try {
    await saltarVisita.waitFor({ state: "visible", timeout: 5000 });
    await saltarVisita.click();
    await saltarVisita.waitFor({ state: "hidden", timeout: TIMEOUT });
    passo("a visita guiada de primeira entrada aparece e fecha-se");
  } catch {
    passo("sem visita guiada (conta que já a viu)");
  }

  await page.getByRole("heading", { name: /Learn to cook/i }).waitFor({ timeout: TIMEOUT });
  passo("o percurso de aprendizagem carrega");

  /* 4 — abrir a primeira lição */
  await page.getByText(PRIMEIRA.dishName, { exact: false }).first().click();
  await page.getByRole("button", { name: /Leave the lesson/i }).waitFor({ timeout: TIMEOUT });
  passo(`a primeira lição abre (${PRIMEIRA.dishName})`);

  /* 5 — o gabarito não está na página */
  const html = await page.content();
  for (const pergunta of PRIMEIRA.questions) {
    const resposta = pergunta.correctAnswer ?? pergunta.correctOrder;
    const texto = Array.isArray(resposta) ? resposta.join("") : String(resposta ?? "");
    // Só vale verificar respostas que não são também uma das opções visíveis.
    const visivel = (pergunta.options ?? []).includes(resposta);
    if (!visivel && texto.length > 12 && html.includes(texto)) {
      falhar(`a resposta de ${pergunta.id} está no HTML da lição antes de se responder`);
    }
  }
  if (html.includes("explainWrong") || html.includes("correctOrder")) {
    falhar("o gabarito chegou ao browser dentro dos dados da lição");
  }
  passo("o gabarito não está no browser antes de se responder");

  /* 6 — apresentação e preparação */
  await page.getByRole("button", { name: /Start prep/i }).click();

  // Os passos de preparação mais as dicas do Chef, um ecrã cada. O último
  // botão não diz "Next": diz que se vai para o quiz.
  const ecrasDePreparacao = PRIMEIRA.preparationSteps.length + (PRIMEIRA.tips?.length ?? 0);
  for (let i = 0; i < ecrasDePreparacao - 1; i += 1) {
    await page.getByRole("button", { name: /^Next$/i }).click();
  }
  await page.getByRole("button", { name: /Test what you know/i }).click();
  passo(`${ecrasDePreparacao} ecrãs de preparação percorridos`);

  /* 7 — o quiz, todo certo */
  for (const [i, pergunta] of PRIMEIRA.questions.entries()) {
    const noEcra = await page.getByRole("heading", { name: pergunta.prompt, exact: false }).count();
    if (!noEcra) falhar(`a pergunta ${pergunta.id} não apareceu no ecrã`);

    await responder(page, respostaCerta(pergunta.id));

    // A correção vem do servidor; sem ela não há botão de continuar.
    const continuar = page.getByRole("button", { name: /Continue/i });
    await continuar.waitFor({ timeout: TIMEOUT });
    await continuar.click();
    passo(`pergunta ${i + 1}/${PRIMEIRA.questions.length} respondida e corrigida`);
  }

  /* 8 — a lição paga XP */
  const xp = page.getByText(/XP/).first();
  await xp.waitFor({ timeout: TIMEOUT });
  const textoFinal = await page.locator("body").innerText();
  if (!/\d+\s*XP/.test(textoFinal)) falhar("a lição acabou sem mostrar XP ganho");
  passo("a lição fecha e paga XP");

  await page
    .getByRole("button", { name: /Continue|Back to the path/i })
    .first()
    .click();

  /* 9 — publicar uma receita */
  await page.goto(`${BASE}/publish`, { waitUntil: "domcontentloaded" });
  await page.locator("#title").fill(RECEITA.title);
  await page.locator("#description").fill(RECEITA.description);
  await page.locator("#ingredients").fill(RECEITA.ingredients);
  passo("o formulário de publicar aceita a receita");

  await page
    .getByRole("button", { name: /Publish|Publicar/i })
    .last()
    .click();

  // Publicar leva ao feed: é o sítio onde a receita aparece.
  await page.waitForURL((url) => !url.pathname.startsWith("/publish"), { timeout: TIMEOUT });
  passo("a receita é publicada");

  /* 10 — e aparece no feed */
  await page.goto(`${BASE}/feed`, { waitUntil: "domcontentloaded" });
  await page.getByText(RECEITA.title, { exact: false }).first().waitFor({ timeout: TIMEOUT });
  passo("a receita aparece no feed");

  /* 11 — e no perfil, com o XP das duas coisas */
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
  // O perfil é uma rota com carregamento tardio e os dados vêm da API: ler o
  // `body` à chegada apanhava o "Loading…".
  await page.getByText(CONTA.username, { exact: false }).first().waitFor({ timeout: TIMEOUT });

  const perfil = await page.locator("body").innerText();
  if (!/\d+\s*XP/.test(perfil)) falhar("o perfil não mostra XP nenhum depois de uma lição feita");
  passo("o perfil mostra a conta e o XP ganho");
}

/* ---------------------------------------------------------------- *
 * Arranque
 * ---------------------------------------------------------------- */

/**
 * Que Chrome usar.
 *
 * O Playwright traz o seu, e é esse o caminho normal. Mas quando a versão do
 * pacote e a do browser descarregado não batem certo — um `npm ci` depois de
 * uma atualização, um container que já vinha com browsers instalados — o
 * Playwright recusa-se a arrancar e manda correr `playwright install`, que num
 * CI ou num ambiente sem rede não é uma opção.
 *
 * Nesse caso usa-se um Chrome do sistema, através do mesmo localizador que o
 * `check-offline` já usava. `CHROME_PATH` tem precedência, para quem quiser
 * apontar para um em concreto.
 */
function executavel() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const doSistema = encontrarChrome();
  if (!doSistema) return undefined; // o do Playwright, se existir

  // O do Playwright ganha quando está lá: é a versão com que os seletores
  // foram escritos.
  const doPlaywright = chromium.executablePath();
  return existsSync(doPlaywright) ? undefined : doSistema;
}

const caminho = executavel();
if (caminho) console.log(`[jornada] Chrome do sistema: ${caminho}`);

const browser = await chromium.launch({ headless: !HEADFUL, executablePath: caminho });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(TIMEOUT);

/** Um erro de JavaScript na página é uma falha, mesmo que o percurso siga. */
const errosNaPagina = [];
page.on("pageerror", (erro) => errosNaPagina.push(erro.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errosNaPagina.push(msg.text());
});

console.log(`\n[jornada] ${BASE}\n`);

try {
  await jornada(page);

  // Os avisos do React em desenvolvimento não contam.
  const relevantes = errosNaPagina.filter(
    (e) => !/favicon|manifest|sourcemap|Download the React DevTools/i.test(e),
  );

  /**
   * Um recurso de fora que não carrega não é um erro da aplicação.
   *
   * A landing e o ecrã de entrar trazem fotografias do Unsplash. Numa máquina
   * sem saída para a internet — um CI fechado, ou a sala onde isto vai ser
   * apresentado com o Wi-Fi a falhar — elas não chegam, e a aplicação continua
   * a funcionar. Fica como aviso, porque *é* uma dependência de rede para uma
   * coisa que se vê logo no primeiro ecrã.
   */
  const deFora = relevantes.filter((e) =>
    /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|unsplash/i.test(
      e,
    ),
  );
  const daApp = relevantes.filter((e) => !deFora.includes(e));

  if (deFora.length > 0) {
    console.warn(
      `\n[jornada] aviso — ${deFora.length} recurso(s) externo(s) não carregaram ` +
        "(imagens do Unsplash na landing e no /auth). A aplicação funcionou à mesma.",
    );
  }

  if (daApp.length > 0) {
    console.error("\n[jornada] a página deu erros:");
    for (const erro of daApp.slice(0, 5)) console.error(`  · ${erro}`);
    process.exitCode = 1;
  } else {
    console.log(`\n[jornada] ok — ${passos} passos, do registo ao feed.\n`);
  }
} catch (erro) {
  console.error(`\n[jornada] falhou ao passo ${passos + 1}: ${erro.message}\n`);
  try {
    await page.screenshot({ path: "journey-failure.png", fullPage: true });
    console.error("  o ecrã ficou em journey-failure.png");
  } catch {
    /* sem screenshot: o erro acima é o que importa */
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
