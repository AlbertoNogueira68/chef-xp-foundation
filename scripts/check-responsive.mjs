/**
 * A regra de responsividade, verificada e não prometida.
 *
 * Abre a aplicação a sério num browser, em quatro larguras de telemóvel, e
 * falha se encontrar:
 *
 *   1. scroll horizontal — a página não pode ser mais larga do que o ecrã;
 *   2. elementos a sair da janela — texto ou botões cortados na margem;
 *   3. alvos de toque pequenos — o que se carrega tem de ter altura de dedo.
 *
 * Porquê um browser e não um lint de classes CSS: o que parte o layout num
 * telemóvel é o resultado do conjunto — uma grelha de quatro colunas com
 * `tabular-nums`, um título longo sem `truncate`, um diálogo com padding a
 * mais. Nenhuma regra sobre nomes de classes apanha isso; medir apanha.
 *
 * Uso:
 *   node scripts/check-responsive.mjs                 (usa BASE_URL ou :5173)
 *   BASE_URL=http://localhost:3010 node scripts/...   (contra a build servida)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.CHECK_EMAIL ?? "demo@chef-xp.local";
const PASSWORD = process.env.CHECK_PASSWORD ?? "chef123";

/** As larguras que interessam: do iPhone SE ao Pro Max. */
const LARGURAS = [320, 360, 390, 414];

const ROTAS = ["/", "/auth", "/feed", "/search", "/publish", "/challenges", "/profile"];

/**
 * Altura mínima de um alvo de toque.
 *
 * As diretrizes falam em 44 px; 32 é o mínimo que esta aplicação aceita, por
 * ser o que o design de cartões densos permite sem se desfazer. Abaixo disso é
 * pontaria, não interface.
 */
const ALTURA_MINIMA = 32;
const LARGURA_MINIMA = 24;

const problemas = [];

/**
 * Isenções, com o motivo — e não uma lista de exceções para calar o erro.
 *
 * - Um link dentro de um parágrafo tem a altura da linha de texto e não pode
 *   ter outra. As próprias WCAG isentam links em texto corrido (2.5.8).
 * - Inputs nativos escondidos (o `file` da fotografia, o `select` que o Radix
 *   esconde por baixo do seu próprio menu) medem 1 px e não se carregam: quem
 *   se carrega é o botão que está por cima.
 */
function isento(el) {
  return el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    if (r.width <= 4 || r.height <= 4) return true;

    const estilo = getComputedStyle(node);
    if (estilo.visibility === "hidden" || estilo.opacity === "0") return true;

    if (node.tagName === "A") {
      const pai = node.parentElement;
      if (pai && ["P", "SPAN", "LI"].includes(pai.tagName)) {
        const texto = (pai.textContent ?? "").trim().length;
        const meu = (node.textContent ?? "").trim().length;
        // O link é parte de uma frase maior: é texto, não um botão.
        if (texto > meu + 4) return true;
      }
    }
    return false;
  });
}

async function entrar(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().fill(EMAIL);
  await page.locator("input[type=password]").first().fill(PASSWORD);
  await page.locator("button[type=submit]").first().click();
  await page.waitForURL(/\/feed/, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function medir(page, onde, largura) {
  const achados = await page.evaluate(
    ({ largura, ALTURA_MINIMA, LARGURA_MINIMA }) => {
      const saida = [];
      const doc = document.documentElement;

      if (doc.scrollWidth > largura + 1) {
        saida.push({
          tipo: "scroll-horizontal",
          detalhe: `a página mede ${doc.scrollWidth}px numa janela de ${largura}px`,
        });
      }

      const dentroDeScroll = (el) => {
        let pai = el.parentElement;
        while (pai && pai !== document.body) {
          const ps = getComputedStyle(pai);
          if (["auto", "scroll", "hidden"].includes(ps.overflowX)) return true;
          pai = pai.parentElement;
        }
        return false;
      };

      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (getComputedStyle(el).position === "fixed") continue;
        // Carrosséis saem da janela de propósito, dentro do seu contentor.
        if (dentroDeScroll(el)) continue;

        if (r.right > largura + 1 || r.left < -1) {
          saida.push({
            tipo: "sai-da-janela",
            detalhe: `${el.tagName.toLowerCase()} vai até ${Math.round(r.right)}px`,
            seletor: `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`,
          });
        }
      }

      const alvos = [];
      document.querySelectorAll("button, a[href], input, select, [role=tab]").forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < ALTURA_MINIMA || r.width < LARGURA_MINIMA) {
          el.setAttribute("data-alvo-pequeno", String(i));
          alvos.push({
            indice: i,
            detalhe: `${el.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)}px`,
            texto: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
          });
        }
      });

      return { saida, alvos };
    },
    { largura, ALTURA_MINIMA, LARGURA_MINIMA },
  );

  for (const achado of achados.saida) {
    problemas.push({ ...achado, onde, largura });
  }

  // As isenções são avaliadas fora do `evaluate` para ficarem num só sítio.
  for (const alvo of achados.alvos) {
    const el = page.locator(`[data-alvo-pequeno="${alvo.indice}"]`).first();
    if ((await el.count()) === 0) continue;
    if (await isento(el)) continue;
    problemas.push({
      tipo: "alvo-pequeno",
      detalhe: `${alvo.detalhe} — "${alvo.texto}"`,
      onde,
      largura,
    });
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

try {
  for (const largura of LARGURAS) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 780 } });
    const page = await ctx.newPage();
    await entrar(page);

    for (const rota of ROTAS) {
      await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await medir(page, rota, largura);
    }

    // Os diálogos são metade da aplicação e nenhum deles aparece numa rota.
    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Definições" }).click();
    await page.waitForTimeout(700);
    await medir(page, "diálogo: definições", largura);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    await page.getByRole("button", { name: /Seguidores/ }).click();
    await page.waitForTimeout(900);
    await medir(page, "diálogo: seguidores", largura);
    await page.keyboard.press("Escape");

    await page.goto(`${BASE}/challenges`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.getByRole("tab", { name: /desafios/i }).click();
    await page.waitForTimeout(1000);
    const cartao = page.getByRole("button", { name: /participar|ver participações/i }).first();
    if (await cartao.count()) {
      await cartao.click();
      await page.waitForTimeout(1200);
      await medir(page, "diálogo: desafio", largura);
      await page.keyboard.press("Escape");
    }

    await page.getByRole("tab", { name: /ranking/i }).click();
    await page.waitForTimeout(1200);
    await medir(page, "ranking", largura);

    await ctx.close();
  }
} finally {
  await browser.close();
}

if (problemas.length === 0) {
  console.log(
    `[responsivo] ok — ${ROTAS.length + 4} ecrãs em ${LARGURAS.join(", ")}px: ` +
      "sem scroll horizontal, sem cortes e sem alvos pequenos",
  );
  process.exit(0);
}

const porTipo = new Map();
for (const p of problemas) {
  const chave = `${p.tipo}|${p.onde}|${p.detalhe}`;
  if (!porTipo.has(chave)) porTipo.set(chave, { ...p, larguras: [] });
  porTipo.get(chave).larguras.push(p.largura);
}

console.error(`[responsivo] ${porTipo.size} problemas:\n`);
for (const p of porTipo.values()) {
  console.error(`  ${p.tipo} · ${p.onde} · ${p.detalhe}  [${p.larguras.join(", ")}px]`);
}
console.error("\nA regra está em docs/RESPONSIVIDADE.md.");
process.exit(1);
