/**
 * Criar notificações.
 *
 * Fica aqui, e não em cada rota, porque as três regras que interessam são as
 * mesmas em todo o lado: não notificar quem fez a ação, não rebentar o pedido
 * se a notificação falhar, e não duplicar.
 *
 * O `ON CONFLICT DO NOTHING` apoia-se nos índices parciais da migration 008:
 * gostar, desgostar e voltar a gostar dá uma notificação, não três.
 */
export async function notify(client, { userId, actorId, kind, recipeId = null, commentId = null }) {
  // Uma ação sobre a própria receita não é notícia para ninguém.
  if (!userId || !actorId || userId === actorId) return { created: false };

  const { rowCount } = await client.query(
    `INSERT INTO notifications (user_id, actor_id, kind, recipe_id, comment_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [userId, actorId, kind, recipeId, commentId],
  );

  return { created: rowCount > 0 };
}

/**
 * Como `notify`, mas nunca deixa o pedido falhar.
 *
 * Um gosto que foi registado não deve responder 500 porque a notificação não
 * conseguiu ser escrita: a ação principal já aconteceu e é essa que importa.
 * Usar só fora de transações — dentro de uma, um erro engolido deixaria a
 * transação abortada à mesma.
 */
export async function notifyQuietly(client, payload) {
  try {
    return await notify(client, payload);
  } catch (error) {
    console.error("[notificações] não foi possível criar:", error.message);
    return { created: false };
  }
}
