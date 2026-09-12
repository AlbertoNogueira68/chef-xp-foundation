/**
 * Regras de participação nos desafios.
 *
 * Módulo puro, sem I/O, pelo mesmo motivo que `xp.js` o é: a pergunta "esta
 * pessoa pode entrar neste desafio?" tem de ter uma resposta que se possa
 * testar sem base de dados, e uma mensagem só. A rota trata de ir buscar os
 * factos; quem decide é esta função.
 */

/** Motivos de recusa, com a mensagem que o utilizador acaba por ler. */
export const ENTRY_ERRORS = {
  ended: "Este desafio já terminou",
  alreadyEntered: "Já participaste neste desafio",
  notOwner: "Só podes submeter uma receita tua",
  recipeTaken: "Essa receita já está noutro desafio",
};

/**
 * @param {object} facts
 * @param {string|Date} facts.endsAt        fim do desafio
 * @param {string|null} facts.recipeAuthorId autor da receita submetida
 * @param {string} facts.userId              quem está a submeter
 * @param {boolean} facts.alreadyEntered     já tem entrada neste desafio
 * @param {boolean} [facts.recipeEntered]    esta receita já está em algum desafio
 * @param {Date} [facts.now]
 * @returns {{ ok: true } | { ok: false, reason: keyof ENTRY_ERRORS, message: string }}
 */
export function canEnterChallenge({
  endsAt,
  recipeAuthorId,
  userId,
  alreadyEntered,
  recipeEntered = false,
  now = new Date(),
}) {
  if (!(new Date(endsAt).getTime() > now.getTime())) return refuse("ended");
  if (alreadyEntered) return refuse("alreadyEntered");
  if (!recipeAuthorId || recipeAuthorId !== userId) return refuse("notOwner");
  if (recipeEntered) return refuse("recipeTaken");
  return { ok: true };
}

/**
 * Retirar a participação só faz sentido enquanto o desafio corre. Depois de
 * fechado o resultado fica como está — é o que dá sentido a haver um fim.
 */
export function canLeaveChallenge({ endsAt, now = new Date() }) {
  if (!(new Date(endsAt).getTime() > now.getTime())) return refuse("ended");
  return { ok: true };
}

function refuse(reason) {
  return { ok: false, reason, message: ENTRY_ERRORS[reason] };
}
