/**
 * O ranking de um desafio, sem base de dados à mistura.
 *
 * Quem ganha um desafio é uma conta com três decisões lá dentro — como se
 * somam os gostos de quem submeteu mais do que uma vez, o que acontece a um
 * empate, e quem fica de fora do pódio — e cada uma delas tem de ter uma
 * resposta que se possa testar sem levantar um Postgres. A liquidação em
 * `services/challengeSettlement.js` trata do resto: ir buscar os factos,
 * pagar o XP e congelar o resultado.
 */

/** O pódio por omissão, quando quem cria o desafio não escreve outro. */
export const DEFAULT_PODIUM_XP = Object.freeze([300, 200, 100]);

/**
 * Ordena os participantes e diz quanto XP leva cada um.
 *
 * Três regras, e nenhuma delas é arbitrária:
 *
 * 1. **Os gostos de uma pessoa somam-se.** Quem pode publicar três fotos e
 *    publica três é avaliado pelas três. O limite é o mesmo para toda a gente
 *    — é isso que torna a soma justa — e avaliar só a melhor submissão
 *    tornaria as outras duas decorativas.
 *
 * 2. **Um empate não desempata.** Duas pessoas com os mesmos gostos ficam as
 *    duas no mesmo lugar e levam as duas o mesmo XP; o lugar seguinte é o que
 *    o empate deixou livre (dois primeiros, e a seguir o terceiro). Era isto
 *    ou inventar um critério de desempate — data de submissão, por exemplo —
 *    que diria a duas pessoas com o mesmo resultado que uma delas ganhou.
 *
 * 3. **Zero gostos não é pódio.** Um desafio com um participante só, que
 *    ninguém votou, não paga 300 XP a ninguém. O prémio é por ter ganho
 *    alguma coisa, não por ter sido o único a aparecer.
 *
 * @param {Array<{ userId: string, likes: number|string }>} entries
 *   Uma linha por submissão. Podem vir várias do mesmo `userId`.
 * @param {number[]} [podiumXp] XP do 1.º, 2.º e 3.º lugares.
 * @returns {Array<{ userId: string, place: number, likes: number, xp: number }>}
 *   Todos os participantes, do primeiro ao último.
 */
export function rankChallenge(entries, podiumXp = DEFAULT_PODIUM_XP) {
  const totals = new Map();
  for (const entry of entries ?? []) {
    if (!entry?.userId) continue;
    const likes = Math.max(0, Math.floor(Number(entry.likes) || 0));
    totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + likes);
  }

  // Empates ficam pela ordem em que o utilizador aparece nos dados — não é
  // desempate nenhum, porque o lugar e o XP são iguais de qualquer maneira.
  const ordered = [...totals.entries()]
    .map(([userId, likes]) => ({ userId, likes }))
    .sort((a, b) => b.likes - a.likes);

  const ranked = [];
  let place = 0;
  let previousLikes = null;

  ordered.forEach((participant, index) => {
    // O lugar é o índice de quem abriu o grupo de empatados: [5, 5, 3] dá
    // 1.º, 1.º e 3.º. O 2.º lugar foi consumido pelo empate.
    if (participant.likes !== previousLikes) {
      place = index + 1;
      previousLikes = participant.likes;
    }
    ranked.push({ ...participant, place, xp: xpForPlace(place, participant.likes, podiumXp) });
  });

  return ranked;
}

function xpForPlace(place, likes, podiumXp) {
  if (likes <= 0) return 0;
  return Math.max(0, Math.floor(Number(podiumXp?.[place - 1]) || 0));
}

/** O pódio de um desafio, na forma que o resto do código espera. */
export function podiumOf(challenge) {
  return [
    Number(challenge?.first_place_xp ?? DEFAULT_PODIUM_XP[0]),
    Number(challenge?.second_place_xp ?? DEFAULT_PODIUM_XP[1]),
    Number(challenge?.third_place_xp ?? DEFAULT_PODIUM_XP[2]),
  ];
}
