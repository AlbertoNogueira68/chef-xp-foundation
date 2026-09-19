/**
 * As regras de moderação, sem base de dados à mistura.
 *
 * Quem pode apagar um comentário e quem pode denunciar o quê são decisões de
 * uma linha cada — e são exatamente o tipo de decisão que, espalhada por
 * dentro de rotas, acaba diferente em dois sítios. Aqui são funções puras,
 * testadas em milissegundos, e as rotas limitam-se a obedecer.
 */

/**
 * Os três papéis, do menos para o mais poderoso.
 *
 * Uma escada e não uma matriz de permissões por ação: a esta escala, uma
 * matriz seria mais código para configurar do que para cumprir. Quem está
 * acima pode o que está abaixo — e é isso que as duas funções seguintes
 * dizem, num sítio só, em vez de espalhar `role === "admin" || role ===
 * "moderator"` por dez rotas.
 */
export const ROLES = Object.freeze(["user", "moderator", "admin"]);

/** Tratar denúncias e apagar conteúdo de terceiros. */
export function canModerate(role) {
  return role === "moderator" || role === "admin";
}

/** Dar e tirar papéis, e ver os números da aplicação inteira. */
export function canAdminister(role) {
  return role === "admin";
}

/**
 * Mudar o papel de alguém — o que o impede.
 *
 * Três recusas, e nenhuma delas é caprichosa:
 *
 * 1. Mudar o meu próprio papel não se faz pela aplicação. Um admin que se
 *    despromova a si próprio pode ficar sem ninguém que o volte a promover, e
 *    um admin que se promova a si próprio já era admin.
 * 2. Ninguém cria um admin pela aplicação. O primeiro admin nasce na linha de
 *    comandos, onde é preciso ter acesso ao servidor; se um admin pudesse
 *    criar outro, uma sessão roubada bastava para criar uma porta permanente.
 * 3. Um admin não é despromovido por outro admin pela aplicação, pela mesma
 *    razão ao contrário: dois admins zangados não se anulam um ao outro à
 *    vez de um clique.
 */
export function roleChangeRefusal({ actorId, actorRole, targetId, targetRole, newRole }) {
  if (!canAdminister(actorRole)) return "This is for admins";
  if (!ROLES.includes(newRole)) return "Papel desconhecido";
  if (actorId === targetId) return "You can't change your own role here";
  if (newRole === "admin") return "An admin is only created from the command line";
  if (targetRole === "admin") return "An admin isn't demoted from here";
  if (targetRole === newRole) return null;
  return null;
}

/**
 * Apagar a conta de outra pessoa — o que o impede.
 *
 * 1. Só um admin apaga contas. Um moderador trata conteúdo, uma peça de cada
 *    vez; uma conta inteira leva tudo o que a pessoa fez, e isso é outra
 *    ordem de grandeza.
 * 2. A minha própria conta não se apaga por aqui. Há um sítio para isso, no
 *    perfil, que pede a password — e um admin que se apagasse do painel
 *    podia deixar a aplicação sem admin nenhum.
 * 3. Um admin não apaga outro admin, pela mesma razão que não o despromove:
 *    uma sessão roubada, ou dois admins zangados, não chegam para apagar a
 *    administração inteira.
 */
export function accountDeletionRefusal({ actorId, actorRole, targetId, targetRole }) {
  if (!canAdminister(actorRole)) return "This is for admins";
  if (actorId === targetId) return "Your own account is deleted from your profile";
  if (targetRole === "admin") return "An admin isn't deleted from here";
  return null;
}

/** Os motivos que uma denúncia pode ter. A mesma lista que o CHECK da 012. */
export const REPORT_REASONS = Object.freeze([
  "spam",
  "ofensivo",
  "perigoso",
  "copia",
  "outro",
]);

/** O que se pode denunciar. */
export const REPORT_SUBJECTS = Object.freeze(["recipe", "comment", "user"]);

/**
 * Quem pode apagar um comentário — e porquê.
 *
 * Devolve o papel que autoriza (para a rota poder registá-lo) ou `null`.
 * Os três casos não são o mesmo direito: o autor apaga o que escreveu, o dono
 * da receita limpa a própria página (é a casa dele, e era isto que não
 * existia), e o moderador age sobre uma denúncia.
 */
export function commentDeleterRole({ userId, role, commentAuthorId, recipeAuthorId }) {
  if (!userId) return null;
  if (commentAuthorId === userId) return "author";
  if (recipeAuthorId === userId) return "recipe_owner";
  if (canModerate(role)) return "moderator";
  return null;
}

/**
 * Uma denúncia válida.
 *
 * Denunciar o que é meu não é moderação, é apagar — e para isso há o botão de
 * apagar. Denunciar-me a mim próprio também não existe. As duas recusas são
 * 400 e não 403: o pedido não faz sentido, não é uma questão de permissão.
 */
export function reportRefusal({ reporterId, subjectType, subjectOwnerId }) {
  if (!REPORT_SUBJECTS.includes(subjectType)) return "Invalid content type";
  if (!subjectOwnerId) return null;
  if (subjectOwnerId !== reporterId) return null;

  return subjectType === "user"
    ? "You can't report yourself"
    : "To remove your own, delete it — reporting is for other people's";
}

/**
 * O que fica registado quando um moderador fecha uma denúncia.
 *
 * `remover` apaga o conteúdo e fecha tudo o que apontava para ele; `arquivar`
 * fecha sem tocar no conteúdo. Fechar uma denúncia nunca a apaga: a fila
 * tratada é o histórico de decisões e é ela que responde a "o que é que
 * fizeram quando isto foi reportado".
 */
export function resolutionOf(action) {
  if (action === "remover") return { status: "resolved", resolution: "removido" };
  if (action === "arquivar") return { status: "dismissed", resolution: "arquivado" };
  return null;
}
