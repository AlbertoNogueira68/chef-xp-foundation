import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { closePool, query } from "../server/db/index.js";
import { UPLOAD_DIR, UPLOAD_ROUTE } from "../server/lib/imageStore.js";

/**
 * Apaga as imagens que já não pertencem a nada.
 *
 *   node scripts/prune-orphan-uploads.mjs            # só mostra (por omissão)
 *   node scripts/prune-orphan-uploads.mjs --apply    # apaga mesmo
 *
 * A aplicação apaga hoje o ficheiro no momento em que apaga a linha — quando
 * se apaga uma receita, uma conta, ou se troca uma fotografia. Este guião
 * existe para as duas coisas que isso não cobre:
 *
 *   · os ficheiros que ficaram órfãos **antes** de essa limpeza existir;
 *   · os que escaparam porque o `unlink` falhou (disco cheio, permissões) e
 *     a aplicação preferiu seguir em frente a rebentar um pedido que já tinha
 *     corrido bem.
 *
 * Não corre sozinho, e não apaga sem `--apply`, de propósito: apagar
 * ficheiros a partir de uma consulta é a classe de tarefa em que um `WHERE`
 * errado se paga caro. O que ele mostra pode ser lido antes de o autorizar.
 *
 * A pergunta que faz é a inversa da habitual — não "que linhas apontam para
 * ficheiros que não existem" mas "que ficheiros não têm linha nenhuma a
 * apontar-lhes". As cinco colunas abaixo são todas as que guardam um caminho
 * de `/uploads` nesta base; acrescentar uma sexta sem a pôr aqui faria este
 * guião apagar imagens vivas, por isso a lista é verificada contra o esquema
 * antes de se apagar o que quer que seja.
 */

const COLUNAS = [
  ["users", "photo_url"],
  ["recipes", "image_url"],
  ["challenges", "image_url"],
  ["mission_runs", "result_image"],
  ["mission_checkpoints", "image_url"],
  ["posts", "image_url"],
];

const aplicar = process.argv.includes("--apply");

/**
 * Trava se o esquema tiver uma coluna de imagem que esta lista não conhece.
 *
 * Sem isto, acrescentar uma tabela com imagens e esquecer este ficheiro
 * transformava a limpeza numa forma de apagar fotografias que estão em uso —
 * em silêncio, e só na próxima vez que alguém corresse o guião.
 */
async function confirmarCobertura() {
  const { rows } = await query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('text', 'character varying')
        AND (column_name LIKE '%image%' OR column_name LIKE '%photo%')
      ORDER BY table_name, column_name`,
  );

  const conhecidas = new Set(COLUNAS.map(([t, c]) => `${t}.${c}`));
  const desconhecidas = rows
    .map((row) => `${row.table_name}.${row.column_name}`)
    .filter((nome) => !conhecidas.has(nome));

  if (desconhecidas.length > 0) {
    throw new Error(
      `O esquema tem colunas de imagem que este guião não conhece:\n` +
        desconhecidas.map((n) => `  - ${n}`).join("\n") +
        `\n\nAcrescenta-as a COLUNAS em scripts/prune-orphan-uploads.mjs antes de correr.\n` +
        `Apagar sem elas seria apagar fotografias que estão em uso.`,
    );
  }
}

/** Todos os caminhos que alguma linha da base reclama como seus. */
async function caminhosEmUso() {
  const sql = COLUNAS.map(
    ([tabela, coluna]) => `SELECT ${coluna} AS caminho FROM ${tabela} WHERE ${coluna} IS NOT NULL`,
  ).join("\n UNION ALL ");

  const { rows } = await query(sql);
  return new Set(rows.map((row) => row.caminho));
}

try {
  await confirmarCobertura();

  const emUso = await caminhosEmUso();

  let ficheiros;
  try {
    ficheiros = await fs.readdir(UPLOAD_DIR);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`[uploads] ${UPLOAD_DIR} não existe — nada a limpar.`);
      ficheiros = [];
    } else {
      throw error;
    }
  }

  const orfaos = ficheiros.filter((nome) => !emUso.has(`${UPLOAD_ROUTE}/${nome}`));

  if (orfaos.length === 0) {
    console.log(`[uploads] ${ficheiros.length} ficheiro(s), nenhum órfão.`);
  } else {
    let bytes = 0;
    for (const nome of orfaos) {
      const info = await fs.stat(path.join(UPLOAD_DIR, nome)).catch(() => null);
      bytes += info?.size ?? 0;
    }
    const mb = (bytes / 1024 / 1024).toFixed(1);

    console.log(`[uploads] ${ficheiros.length} ficheiro(s), ${orfaos.length} sem dono (${mb} MB):`);
    for (const nome of orfaos.slice(0, 20)) console.log(`  ${nome}`);
    if (orfaos.length > 20) console.log(`  … e mais ${orfaos.length - 20}`);

    if (!aplicar) {
      console.log(`\n[uploads] nada foi apagado. Para apagar: --apply`);
    } else {
      let apagados = 0;
      for (const nome of orfaos) {
        try {
          await fs.unlink(path.join(UPLOAD_DIR, nome));
          apagados += 1;
        } catch (error) {
          console.error(`[uploads] falhou apagar ${nome}: ${error.message}`);
        }
      }
      console.log(`\n[uploads] ${apagados} ficheiro(s) apagado(s), ${mb} MB libertados.`);
    }
  }
} finally {
  await closePool();
}
