import { query } from "../db/index.js";

/**
 * Bloqueios, do lado do SQL.
 *
 * A regra é sempre a mesma e é bidirecional: quem eu bloqueei desaparece-me
 * do ecrã, e a quem me bloqueou eu também desapareço. Está escrita uma vez
 * aqui porque a alternativa — repetir o `NOT EXISTS` em cada consulta do feed,
 * da pesquisa, dos comentários e das sugestões — é a receita para ficar
 * escondido num sítio e visível no outro.
 */

/**
 * Fragmento para pôr num WHERE. `meParam` é o placeholder de quem está a pedir
 * (`$1` na maioria das consultas) e `authorExpr` a coluna do autor do conteúdo.
 *
 * Fica como `NOT EXISTS` sobre a chave primária e sobre o índice do sentido
 * inverso: as duas metades do OR são procuras por índice, não varrimentos.
 */
export function notBlockedSql(meParam, authorExpr) {
  return `NOT EXISTS (
    SELECT 1 FROM user_blocks b
     WHERE (b.blocker_id = ${meParam} AND b.blocked_id = ${authorExpr})
        OR (b.blocker_id = ${authorExpr} AND b.blocked_id = ${meParam})
  )`;
}

/** Há bloqueio entre estes dois, em qualquer sentido? */
export async function blockExistsBetween(a, b, client = null) {
  if (!a || !b || a === b) return false;
  const run = client ? (text, params) => client.query(text, params) : query;
  const { rowCount } = await run(
    `SELECT 1 FROM user_blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
      LIMIT 1`,
    [a, b],
  );
  return rowCount > 0;
}
