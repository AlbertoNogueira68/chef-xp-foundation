import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PT } from "./pt";
import { DIETARY_TAGS } from "@/constants/dietaryTags";
import { CHEF_LINES } from "@/lib/chefLines";

/**
 * O dicionário tem de cobrir o que o código pede.
 *
 * Uma chave em falta não rebenta nada — aparece em inglês no meio do
 * português, que é a maneira de isto apodrecer sem ninguém dar por ela. Este
 * teste lê o código à procura de `t("…")` e exige tradução para cada um.
 */
function ficheiros(dir: string, encontrados: string[] = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome !== "i18n" && nome !== "ui") ficheiros(caminho, encontrados);
    } else if (/\.tsx?$/.test(nome) && !nome.includes(".test.")) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

/** Comentários fora: explicam o código, e explicam-no em português. */
function semComentarios(codigo: string) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, " "))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (linha) => linha.replace(/[^\n]/g, " "));
}

function chavesUsadas() {
  const chaves = new Set<string>();
  for (const caminho of ficheiros(path.join(process.cwd(), "src"))) {
    // Sem os comentários: um `t("…")` citado numa explicação não é uma chave.
    const codigo = semComentarios(readFileSync(caminho, "utf8"));
    // O `(?<![A-Za-z0-9_$])` evita apanhar o `test(…)` e afins.
    for (const m of codigo.matchAll(/(?<![A-Za-z0-9_$])t\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      chaves.add(JSON.parse(`"${m[1]}"`));
    }
    for (const m of codigo.matchAll(/(?<![A-Za-z0-9_$])t\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      chaves.add(m[1].replace(/\\'/g, "'"));
    }
  }
  return [...chaves];
}

/**
 * As chaves que não nascem de um `t("…")` literal.
 *
 * As etiquetas de dieta são traduzidas por variável — `t(tag.label)` — e o
 * varredor acima não as vê. Sem esta lista, apagar uma tradução dessas passava
 * o teste e aparecia em inglês no formulário de publicar.
 */
const CHAVES_INDIRETAS = [...DIETARY_TAGS.map((tag) => tag.label), ...CHEF_LINES];

/**
 * Nada de português cravado no código.
 *
 * A chave do dicionário é o inglês. Uma frase escrita em português dentro de
 * um componente não tem por onde ser traduzida: aparece igual a quem tem a app
 * em inglês — que era exactamente a mistura que este ficheiro existe para
 * evitar.
 */
const ACENTOS = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;
const PALAVRAS_PT =
  /\b(?:não|uma|umas|dos|das|para|com|sem|que|teu|tua|teus|tuas|está|estás|ficou|volta|pessoas?|apagar|guardar|bloquear|enviar|criar|abrir|instante|falha|pedido|falhou|copiado|nome|utilizador(?:es)?|receita|gostos?|denúncias?)\b/i;

/**
 * Português que não é texto de interface, e por isso não se traduz.
 *
 * O `useVoiceControl` guarda as palavras que o reconhecedor de voz procura em
 * cada língua: essas *têm* de estar em português, senão não há como ouvir quem
 * diz "próximo". O `register.ts` escreve para a consola, que é para quem
 * programa.
 */
const FORA = [/useVoiceControl\.ts$/, /lib\/pwa\/register\.ts$/];

/** Formas que nunca são texto de interface. */
const TECNICO = [
  /^[\w.-]+$/,
  /^[#.][\w-]/,
  /^(?:https?:)?\/\//,
  /^\//,
  /^[A-Za-z]+(?:[A-Z][a-z]+)+$/,
  /^[a-z]+(?:-[a-z0-9]+)+$/,
  /^[MmLlCcZzHhVvAaQqSsTt]\s?-?[\d.]+[\s,].*[\d.]/,
  /^[\s\d.,:;%+*/()[\]{}<>=|&!?^~`$#@-]+$/,
];

function literaisEmPortugues() {
  const encontrados: string[] = [];

  for (const caminho of ficheiros(path.join(process.cwd(), "src"))) {
    if (FORA.some((excepcao) => excepcao.test(caminho))) continue;
    const codigo = semComentarios(readFileSync(caminho, "utf8"));

    codigo.split("\n").forEach((linha, i) => {
      for (const m of linha.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
        const texto = m[1];
        if (!texto || !/[A-Za-zÀ-ÿ]/.test(texto)) continue;
        if (TECNICO.some((forma) => forma.test(texto))) continue;
        if (!ACENTOS.test(texto) && !PALAVRAS_PT.test(texto)) continue;
        // Já traduzido, ou é uma chave do dicionário a ser traduzida.
        const antes = linha.slice(0, m.index);
        if (/(?<![A-Za-z0-9_$])t\(\s*$/.test(antes)) continue;
        if (texto in PT) continue;
        encontrados.push(
          `${path.relative(process.cwd(), caminho)}:${i + 1}  ${JSON.stringify(texto)}`,
        );
      }
    });
  }

  return encontrados;
}

describe("dicionário de português", () => {
  test("traduz tudo o que o código pede", () => {
    const semTraducao = chavesUsadas().filter((chave) => !(chave in PT));
    expect(semTraducao).toEqual([]);
  });

  test("os marcadores das frases são os mesmos nas duas línguas", () => {
    const marcadores = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const diferentes = Object.entries(PT)
      .filter(([en, pt]) => marcadores(en).join() !== marcadores(pt).join())
      .map(([en]) => en);

    // Um `{dish}` que se perca na tradução aparece como texto cru no ecrã.
    expect(diferentes).toEqual([]);
  });

  test("traduz as chaves que passam por variável", () => {
    const semTraducao = CHAVES_INDIRETAS.filter((chave) => !(chave in PT));
    expect(semTraducao).toEqual([]);
  });

  test("não há português cravado no código", () => {
    // Uma frase em português dentro de um componente aparece igual a quem tem
    // a app em inglês. A chave é sempre o inglês.
    expect(literaisEmPortugues()).toEqual([]);
  });
});
