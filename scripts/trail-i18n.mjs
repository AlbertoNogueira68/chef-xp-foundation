/**
 * O texto de um trilho, para fora e para dentro.
 *
 * Um trilho vive em `shared/trails/<id>.json` e a variante portuguesa em
 * `<id>.pt.json`, com os **mesmos ids**: é isso que permite servir português
 * sem tocar em lógica nenhuma, porque o progresso e o XP andam sobre ids.
 *
 *   node scripts/trail-i18n.mjs extract <id> [ficheiro] [--valores]
 *   node scripts/trail-i18n.mjs apply   <id> <traducoes.json>
 *
 * O `apply` aceita as traduções como mapa (caminho → frase) ou como lista pela
 * ordem do `extract --valores`.
 *
 * Escrever o `.pt.json` à mão era pedir para trocar um id ou perder um passo
 * de uma missão. O `extract` tira só as frases, o `apply` volta a montar a
 * estrutura a partir do inglês e troca o texto — tudo o que não é texto vem
 * do ficheiro inglês e não há por onde divergir.
 */
import fs from "node:fs";
import path from "node:path";

const TRAILS = path.resolve(import.meta.dirname, "../shared/trails");

/** Campos de texto, por onde aparecem. O resto — ids, números — não se toca. */
const TEXTO = new Set([
  "name",
  "description",
  "title",
  "subtitle",
  "dishName",
  "summary",
  "prompt",
  "explanation",
  "explainWrong",
  "answer",
  "unit",
]);

/** Listas de frases. `practices` e `dietaryTags` são ids: ficam de fora. */
const LISTAS_DE_TEXTO = new Set(["ingredients", "options", "items"]);

/**
 * Campos que **não** se traduzem porque se derivam de outro.
 *
 * A resposta certa tem de ser exactamente uma das opções — o validador exige-o.
 * Traduzi-la à parte era a maneira de a desalinhar; aqui ela é reconstruída
 * pelo índice que ocupava no inglês.
 */
const DERIVADOS = new Set(["correctAnswer", "correctOrder"]);

function* andar(no, caminho = "") {
  if (Array.isArray(no)) {
    for (const [i, v] of no.entries()) yield* andar(v, `${caminho}[${i}]`);
    return;
  }
  if (no === null || typeof no !== "object") return;

  for (const [chave, valor] of Object.entries(no)) {
    const aqui = caminho ? `${caminho}.${chave}` : chave;

    if (typeof valor === "string" && TEXTO.has(chave)) {
      yield [aqui, valor];
    } else if (LISTAS_DE_TEXTO.has(chave) && Array.isArray(valor)) {
      for (const [i, item] of valor.entries()) {
        if (typeof item === "string") yield [`${aqui}[${i}]`, item];
      }
    } else if (!DERIVADOS.has(chave)) {
      yield* andar(valor, aqui);
    }
  }
}

function lerIngles(id) {
  const caminho = path.join(TRAILS, `${id}.json`);
  if (!fs.existsSync(caminho)) throw new Error(`Não há trilho ${id} em ${TRAILS}`);
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

/**
 * As frases pela ordem em que aparecem, sem os caminhos.
 *
 * A travessia é determinista, por isso a posição basta para as pôr de volta —
 * e uma lista de frases é muito mais fácil de traduzir de seguida do que um
 * mapa onde cada chave é um caminho de trinta caracteres.
 */
function extract(id, destino, { valores = false } = {}) {
  const pares = [...andar(lerIngles(id))];
  const saida =
    JSON.stringify(valores ? pares.map(([, frase]) => frase) : Object.fromEntries(pares), null, 2) +
    "\n";
  if (destino) fs.writeFileSync(destino, saida);
  else process.stdout.write(saida);
  process.stderr.write(`[trail-i18n] ${id}: ${pares.length} frases\n`);
}

/** Troca o texto no sítio, seguindo o mesmo caminho que o `extract` produziu. */
function pousar(raiz, caminho, valor) {
  const partes = caminho.match(/[^.[\]]+/g);
  let no = raiz;
  for (const parte of partes.slice(0, -1)) no = no[parte];
  no[partes.at(-1)] = valor;
}

function apply(id, ficheiroTraducoes) {
  const ingles = lerIngles(id);
  const lido = JSON.parse(fs.readFileSync(ficheiroTraducoes, "utf8"));
  const pt = structuredClone(ingles);

  const pares = [...andar(ingles)];

  // Uma lista vem pela ordem da travessia; um mapa vem por caminho.
  let traducoes;
  if (Array.isArray(lido)) {
    if (lido.length !== pares.length) {
      throw new Error(
        `[trail-i18n] ${id}: ${lido.length} frases traduzidas para ${pares.length} do inglês`,
      );
    }
    traducoes = Object.fromEntries(pares.map(([caminho], i) => [caminho, lido[i]]));
  } else {
    traducoes = lido;
  }

  const esperadas = Object.fromEntries(pares);
  const faltam = Object.keys(esperadas).filter((c) => typeof traducoes[c] !== "string");
  const sobram = Object.keys(traducoes).filter((c) => !(c in esperadas));
  if (faltam.length > 0 || sobram.length > 0) {
    const erro = [
      faltam.length > 0 && `sem tradução (${faltam.length}):\n  - ${faltam.join("\n  - ")}`,
      sobram.length > 0 && `caminho inexistente (${sobram.length}):\n  - ${sobram.join("\n  - ")}`,
    ].filter(Boolean);
    throw new Error(`[trail-i18n] ${id}:\n${erro.join("\n")}`);
  }

  for (const [caminho, frase] of Object.entries(traducoes)) pousar(pt, caminho, frase);

  // Os derivados, agora que as opções já estão em português.
  for (const [unidade, uIdx] of pt.units.map((u, i) => [u, i])) {
    for (const [licao, lIdx] of unidade.lessons.map((l, i) => [l, i])) {
      for (const [pergunta, qIdx] of (licao.questions ?? []).map((q, i) => [q, i])) {
        const original = ingles.units[uIdx].lessons[lIdx].questions[qIdx];

        if (Array.isArray(original.options) && typeof original.correctAnswer === "string") {
          const indice = original.options.indexOf(original.correctAnswer);
          if (indice < 0) throw new Error(`${original.id}: a resposta certa não está nas opções`);
          pergunta.correctAnswer = pergunta.options[indice];
        }

        if (Array.isArray(original.correctOrder)) {
          pergunta.correctOrder = original.correctOrder.map((passo) => {
            const indice = original.items.indexOf(passo);
            if (indice < 0) throw new Error(`${original.id}: "${passo}" não está em items`);
            return pergunta.items[indice];
          });
        }
      }
    }
  }

  fs.writeFileSync(path.join(TRAILS, `${id}.pt.json`), JSON.stringify(pt, null, 2) + "\n");
  process.stderr.write(
    `[trail-i18n] ${id}.pt.json escrito — ${Object.keys(traducoes).length} frases\n`,
  );
}

const argumentos = process.argv.slice(2).filter((a) => a !== "--valores");
const valores = process.argv.includes("--valores");
const [modo, id, ficheiro] = argumentos;
if (modo === "extract" && id) extract(id, ficheiro, { valores });
else if (modo === "apply" && id && ficheiro) apply(id, ficheiro);
else {
  process.stderr.write(
    "uso:\n  trail-i18n.mjs extract <id> [ficheiro]\n  trail-i18n.mjs apply <id> <traducoes.json>\n",
  );
  process.exit(1);
}
