/**
 * A Content-Security-Policy de produção, verificada e não prometida.
 *
 * Abre a aplicação num browser a sério, com a política real a ser servida
 * pelo helmet, percorre os ecrãs, abre diálogos e menus, e falha se o browser
 * comunicar **uma** violação.
 *
 * Existe por causa de uma regra em concreto. A CSP desta app tinha
 * `style-src 'unsafe-inline'`, e isso abria as duas coisas que o CSP3 separa:
 * folhas de estilo injetadas (`<style>`, que servem para exfiltrar o conteúdo
 * de um formulário com seletores de atributo) e atributos `style=` (que são
 * como o Radix posiciona um popover). Só a segunda é precisa aqui. Apertar a
 * primeira é grátis — desde que se saiba, e não se adivinhe, que nenhuma
 * biblioteca desta app injeta estilos.
 *
 * Adivinhar é fácil e errado: o `react-remove-scroll`, que vem com os
 * diálogos do Radix, injeta mesmo um `<style>` em certas versões. É por isso
 * que isto abre diálogos em vez de se ficar pelas páginas.
 *
 * Uso (precisa da app construída e servida com NODE_ENV=production):
 *   npm run build && NODE_ENV=production ... node server/index.js &
 *   BASE_URL=http://localhost:3010 node scripts/check-csp.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const EMAIL = process.env.CHECK_EMAIL ?? "demo@chef-xp.local";
const PASSWORD = process.env.CHECK_PASSWORD ?? "chef123";

const ROTAS = [
  "/",
  "/auth",
  "/forgot-password",
  "/reset-password?token=" + "0".repeat(64),
  "/feed",
  "/search",
  "/publish",
  "/challenges",
  "/profile",
  "/admin",
];

const violacoes = [];

/**
 * Regista o que o browser recusou.
 *
 * Duas fontes, porque nenhuma apanha tudo: o evento
 * `securitypolicyviolation`, que o browser dispara na página, e as mensagens
 * da consola, que apanham o que acontece antes de o nosso `addInitScript`
 * correr.
 */
async function observar(page, onde) {
  await page.exposeFunction("__cspViolacao", (detalhe) => {
    violacoes.push({ onde, ...detalhe });
  });

  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (evento) => {
      window.__cspViolacao?.({
        directive: evento.effectiveDirective || evento.violatedDirective,
        blocked: String(evento.blockedURI || "").slice(0, 120),
        sample: String(evento.sample || "").slice(0, 160),
      });
    });
  });

  page.on("console", (mensagem) => {
    const texto = mensagem.text();
    if (/Content Security Policy/i.test(texto)) {
      violacoes.push({ onde, directive: "(consola)", blocked: texto.slice(0, 200) });
    }
  });
}

/** Confirma que a política está mesmo a ser servida — senão isto não prova nada. */
async function exigirPolitica() {
  const resposta = await fetch(`${BASE}/api/health`);
  const politica = resposta.headers.get("content-security-policy");

  if (!politica) {
    throw new Error(
      `O servidor em ${BASE} não está a enviar Content-Security-Policy.\n` +
        `A CSP só é aplicada com NODE_ENV=production — sem ela, este guião passava sem verificar nada.`,
    );
  }

  console.log(`[csp] política em vigor:\n      ${politica.replace(/;/g, ";\n      ")}`);
  return politica;
}

async function entrar(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(PASSWORD);
  await page.locator("button[type=submit]").first().click();
  await page.waitForURL(/\/feed/, { timeout: 20_000 });
  await page.waitForTimeout(800);

  // A visita guiada é um diálogo, e um diálogo é precisamente o que interessa
  // medir aqui: é ele que traz o `react-remove-scroll`.
  const visita = page.getByRole("dialog");
  if (await visita.count()) {
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^skip$/i }).click();
    await page.waitForTimeout(400);
  }
}

/**
 * Carrega no que abre camadas por cima da página.
 *
 * Menus, diálogos e popovers são onde o Radix escreve `style=` e onde as
 * bibliotecas que o acompanham injetam o que têm a injetar. Uma página
 * parada não prova nada sobre eles.
 */
async function abrirCamadas(page) {
  const gatilhos = page.locator(
    '[aria-haspopup="menu"], [aria-haspopup="dialog"], [data-slot="dropdown-menu-trigger"], [data-slot="dialog-trigger"]',
  );

  const quantos = Math.min(await gatilhos.count(), 4);
  for (let i = 0; i < quantos; i += 1) {
    try {
      await gatilhos.nth(i).click({ timeout: 2000 });
      await page.waitForTimeout(350);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    } catch {
      // Um gatilho tapado por outra coisa não é uma violação de CSP.
    }
  }
}

await exigirPolitica();

/**
 * `CHROME_PATH` existe para as máquinas onde o browser do Playwright não é o
 * que ele espera — é a mesma variável que o `scripts/lib/chrome.mjs` já lê.
 * Sem ela, usa-se o que o Playwright instalou.
 */
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexto.newPage();

try {
  await observar(page, "arranque");
  await entrar(page);

  for (const rota of ROTAS) {
    await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await abrirCamadas(page);
    console.log(`[csp] ${rota} — ${violacoes.length} violação(ões) até aqui`);
  }
} finally {
  await browser.close();
}

if (violacoes.length > 0) {
  console.error(`\n[csp] ${violacoes.length} violação(ões):`);
  for (const v of violacoes.slice(0, 20)) {
    console.error(`  ${v.directive}  ${v.blocked}${v.sample ? `  «${v.sample}»` : ""}`);
  }
  console.error(
    `\nOu a aplicação passou a precisar do que a política recusa — e aí é a política que muda,\n` +
      `com o motivo escrito em server/lib/cspConfig.js — ou entrou código que não devia estar cá.`,
  );
  process.exit(1);
}

console.log("\n[csp] ok — nenhuma violação em nenhum dos ecrãs.");
