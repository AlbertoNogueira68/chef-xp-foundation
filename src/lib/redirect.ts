/**
 * Para onde voltar depois de entrar.
 *
 * Só se aceitam caminhos internos (`/algo`), nunca `//host`, um URL completo ou
 * o próprio ecrã de entrada: o destino vem do estado do router, e um destino
 * que aceitasse qualquer coisa era um open redirect com sessão acabada de criar.
 */
export function destinoAposEntrar(from: unknown, porOmissao = "/feed"): string {
  return typeof from === "string" && /^\/(?!\/|auth)/.test(from) ? from : porOmissao;
}
