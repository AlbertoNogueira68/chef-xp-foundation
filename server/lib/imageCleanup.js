import { deleteStoredImage } from "./imageStore.js";

/**
 * Apagar conteúdo tem de apagar também o que ele deixou em disco.
 *
 * As linhas caem por `ON DELETE CASCADE`; os ficheiros não caem por nada —
 * ninguém lhes aponta e continuam a responder a quem tiver o endereço. Uma
 * conta apagada cuja fotografia de perfil ainda abre num separador não é uma
 * conta apagada, e um volume que só cresce acaba por parar o servidor.
 *
 * A regra de uso é sempre a mesma: **recolher dentro da transação, apagar
 * depois do COMMIT**. Ao contrário, um ROLLBACK deixava a linha viva e o
 * ficheiro morto — e dessas duas metades só uma se recupera.
 */

/**
 * Todas as imagens que caem quando esta conta cai.
 *
 * São as que o `ON DELETE CASCADE` de `users` arrasta: a fotografia de
 * perfil, as receitas, e as fotografias de verificação das missões (a foto
 * final da run e os checkpoints de cada passo).
 *
 * O que fica de fora, de propósito: a capa de um desafio que esta pessoa
 * criou. `challenges.created_by` é `ON DELETE SET NULL` — o desafio sobrevive
 * a quem o criou, e pode ter gente lá dentro.
 */
export async function imagensDaConta(client, userId) {
  const { rows } = await client.query(
    `SELECT photo_url AS caminho FROM users WHERE id = $1 AND photo_url IS NOT NULL
      UNION ALL
     SELECT image_url FROM recipes WHERE author_id = $1 AND image_url IS NOT NULL
      UNION ALL
     SELECT result_image FROM mission_runs WHERE user_id = $1 AND result_image IS NOT NULL
      UNION ALL
     SELECT c.image_url
       FROM mission_checkpoints c
       JOIN mission_runs r ON r.id = c.run_id
      WHERE r.user_id = $1 AND c.image_url IS NOT NULL`,
    [userId],
  );

  return rows.map((row) => row.caminho);
}

/**
 * Apaga uma lista de caminhos. Nunca atira.
 *
 * O que falha fica no registo do servidor e é apanhado pelo
 * `scripts/prune-orphan-uploads.mjs`. Uma conta apagada com sucesso não volta
 * a existir porque o disco recusou apagar uma fotografia.
 */
export async function apagarImagens(caminhos) {
  let apagadas = 0;
  for (const caminho of new Set(caminhos)) {
    if (await deleteStoredImage(caminho)) apagadas += 1;
  }
  return apagadas;
}
