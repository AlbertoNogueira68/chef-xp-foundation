/**
 * A app instalável, verificada na build e não prometida no README.
 *
 * Um PWA parte-se em silêncio: basta um ícone que não foi copiado ou um
 * manifesto que deixou de estar ligado ao index.html para deixar de ser
 * instalável — e nada falha, nada avisa, só deixa de aparecer o botão de
 * instalar no telemóvel de quem avaliar o projeto.
 *
 *   npm run build && node scripts/check-pwa.mjs
 */

import fs from "node:fs";
import path from "node:path";

const DIST = path.join(process.cwd(), "dist");
const erros = [];

const ler = (relativo) => {
  const caminho = path.join(DIST, relativo);
  if (!fs.existsSync(caminho)) {
    erros.push(`falta ${relativo} na build`);
    return null;
  }
  return fs.readFileSync(caminho, "utf8");
};

/* O que tem de ter chegado ao dist. */
const html = ler("index.html");
const manifestoCru = ler("manifest.webmanifest");
const sw = ler("sw.js");
ler("offline.html");

/* O index.html tem de apontar para o manifesto e trazer a cor do tema. */
if (html) {
  if (!/<link[^>]+rel="manifest"/.test(html)) erros.push("o index.html não liga o manifesto");
  if (!/<meta[^>]+name="theme-color"/.test(html)) erros.push("o index.html não tem theme-color");
}

/* O manifesto tem de ser válido e ter os ícones que os sistemas exigem. */
if (manifestoCru) {
  try {
    const manifesto = JSON.parse(manifestoCru);

    for (const campo of ["name", "short_name", "start_url", "display", "theme_color", "icons"]) {
      if (!manifesto[campo]) erros.push(`o manifesto não tem "${campo}"`);
    }

    if (manifesto.display !== "standalone") {
      erros.push(`display devia ser "standalone" e é "${manifesto.display}"`);
    }

    const icones = manifesto.icons ?? [];
    for (const tamanho of ["192x192", "512x512"]) {
      if (!icones.some((icone) => icone.sizes === tamanho)) {
        erros.push(`falta um ícone de ${tamanho} no manifesto`);
      }
    }
    if (!icones.some((icone) => String(icone.purpose).includes("maskable"))) {
      // Sem ele, o Android desenha o ícone dentro de um quadrado branco.
      erros.push("falta um ícone maskable no manifesto");
    }

    // Os ficheiros têm de existir mesmo, não apenas estar declarados.
    for (const icone of icones) {
      const relativo = icone.src.replace(/^\//, "");
      if (!fs.existsSync(path.join(DIST, relativo))) {
        erros.push(`o ícone ${icone.src} está no manifesto mas não na build`);
      }
    }
  } catch {
    erros.push("o manifesto não é JSON válido");
  }
}

/* O worker tem de saber responder quando a rede falha. */
if (sw && !sw.includes("offline.html")) {
  erros.push("o service worker não tem recurso ao ecrã de offline");
}

/**
 * E — o mais importante — alguém tem de o registar.
 *
 * Esta verificação existe por causa de um erro que passou por tudo o resto: o
 * `sw.js` estava na build, o manifesto estava certo, os testes passavam, e o
 * registo tinha sido apagado do bundle como código morto porque o `.env` do
 * servidor punha `import.meta.env.PROD` a `false`. Nada falhava; a app é que
 * não funcionava offline. Procurar o "/sw.js" dentro do JavaScript da build é
 * o que apanha isso.
 */
const assets = path.join(DIST, "assets");
const registaOWorker = fs.existsSync(assets)
  ? fs
      .readdirSync(assets)
      .filter((ficheiro) => ficheiro.endsWith(".js"))
      .some((ficheiro) => fs.readFileSync(path.join(assets, ficheiro), "utf8").includes("/sw.js"))
  : false;

if (!registaOWorker) {
  erros.push('nenhum ficheiro da build regista o "/sw.js" — a app não vai funcionar offline');
}

if (erros.length > 0) {
  console.error("[pwa] a app não está instalável:");
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log("[pwa] ok — manifesto, ícones, service worker e ecrã de offline no sítio");
