import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PT } from "./pt";

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

function chavesUsadas() {
  const chaves = new Set<string>();
  for (const caminho of ficheiros(path.join(process.cwd(), "src"))) {
    const codigo = readFileSync(caminho, "utf8");
    // O `(?<![A-Za-z0-9_$])` evita apanhar o `test("…")` e afins.
    for (const m of codigo.matchAll(/(?<![A-Za-z0-9_$])t\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      chaves.add(JSON.parse(`"${m[1]}"`));
    }
    for (const m of codigo.matchAll(/(?<![A-Za-z0-9_$])t\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      chaves.add(m[1].replace(/\\'/g, "'"));
    }
  }
  return [...chaves];
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
});
