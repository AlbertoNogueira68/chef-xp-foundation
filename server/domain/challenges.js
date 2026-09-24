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
  notStarted: "This challenge hasn't started yet",
  ended: "This challenge is over",
  alreadyEntered: "You've already entered this challenge",
  limitReached: "You've used all your entries in this challenge",
  notOwner: "You can only submit a recipe of your own",
  recipeTaken: "That recipe is already in another challenge",
};

/**
 * @param {object} facts
 * @param {string|Date} [facts.startsAt]    princípio do desafio
 * @param {string|Date} facts.endsAt        fim do desafio
 * @param {string|null} facts.recipeAuthorId autor da receita submetida
 * @param {string} facts.userId              quem está a submeter
 * @param {number} [facts.entryCount]        submissões que já tem neste desafio
 * @param {number} [facts.maxEntries]        quantas quem criou o desafio permite
 * @param {boolean} [facts.recipeEntered]    esta receita já está em algum desafio
 * @param {Date} [facts.now]
 * @returns {{ ok: true } | { ok: false, reason: keyof ENTRY_ERRORS, message: string }}
 */
export function canEnterChallenge({
  startsAt = null,
  endsAt,
  recipeAuthorId,
  userId,
  entryCount = 0,
  maxEntries = 1,
  recipeEntered = false,
  now = new Date(),
}) {
  if (startsAt && new Date(startsAt).getTime() > now.getTime()) return refuse("notStarted");
  if (!(new Date(endsAt).getTime() > now.getTime())) return refuse("ended");

  /**
   * Quantas submissões cabem a cada pessoa é de quem criou o desafio, não do
   * código: um desafio de prato único e um de "três fotos da tua semana" são
   * o mesmo desafio com números diferentes. Enquanto o número foi sempre um,
   * isto era o UNIQUE da 007; agora é uma contagem, e a mensagem muda com o
   * número para não dizer "gastaste as tuas submissões" a quem só tinha uma.
   */
  const limit = Math.max(1, Math.floor(Number(maxEntries) || 1));
  if (Math.max(0, Number(entryCount) || 0) >= limit) {
    // Duas frases fixas e nenhuma interpolação: a tradução em `lib/i18n.js`
    // tem a mensagem inglesa por chave, e uma frase montada com o número lá
    // dentro nunca encontraria a sua.
    return refuse(limit === 1 ? "alreadyEntered" : "limitReached");
  }

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

/**
 * Mexer num desafio depois de ele arrancar — o que o impede.
 *
 * Um desafio a decorrer é uma promessa a quem já submeteu: o XP que vai
 * pagar, quantas fotos aceita e quando fecha fazem parte do que essas pessoas
 * aceitaram. Por isso, com participações em cima da mesa, só se mexe no que
 * não muda o jogo — título, descrição, imagem — e o prazo só pode ser
 * esticado, nunca encurtado. Um desafio já liquidado não se mexe de todo:
 * o XP do pódio já foi pago a partir daqueles números.
 */
export function challengeEditRefusal({
  settled,
  hasEntries,
  changes = {},
  endsAt,
  now = new Date(),
}) {
  if (settled) return "This challenge is closed and its result was paid";
  if (!hasEntries) return null;

  const trancadas = [
    "xpReward",
    "maxEntriesPerUser",
    "firstPlaceXp",
    "secondPlaceXp",
    "thirdPlaceXp",
  ];
  const mexida = trancadas.find((campo) => changes[campo] !== undefined);
  if (mexida) return "Rules can't change once people have entered";

  if (changes.endsAt !== undefined) {
    const novo = new Date(changes.endsAt).getTime();
    if (!(novo > now.getTime())) return "The new end date has to be in the future";
    if (novo < new Date(endsAt).getTime()) return "The deadline can be extended, not shortened";
  }

  return null;
}

/**
 * Apagar um desafio — o que o impede.
 *
 * Um desafio já liquidado pagou XP a partir do seu resultado; apagá-lo
 * deixava no livro-razão eventos a apontar para um desafio que não existe.
 * Com participações mas por liquidar, apagar é tirar do ecrã trabalho que as
 * pessoas submeteram — encurtar o prazo é o caminho, e esse está na edição.
 */
export function challengeDeletionRefusal({ settled, hasEntries }) {
  if (settled) return "This challenge is closed and its result was paid";
  if (hasEntries) return "This challenge already has entries";
  return null;
}

function refuse(reason) {
  return { ok: false, reason, message: ENTRY_ERRORS[reason] };
}
