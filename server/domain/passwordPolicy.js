/**
 * A regra da password, do lado de quem decide.
 *
 * O cliente tem a mesma lista em `src/features/auth/passwordPolicy.ts` para
 * mostrar os requisitos a ficarem verdes enquanto se escreve, mas isso é
 * cortesia: quem faz o pedido pode ignorar o formulário e falar diretamente
 * com a API, e por isso a regra é aplicada aqui outra vez.
 *
 * Mudar os requisitos obriga a mudar os dois ficheiros. São quatro linhas,
 * e a alternativa — servir a política numa rota e o formulário montá-la a
 * partir dela — era maquinaria a mais para uma regra que muda de dois em dois
 * anos.
 */

export const PASSWORD_MIN = 8;

/** Pontuação ASCII: acentos e letras de outros alfabetos são letras, não
 *  caracteres especiais. */
const ESPECIAL = /[!-/:-@[-`{-~]/;

export const passwordRules = [
  {
    id: "tamanho",
    message: `A password tem de ter pelo menos ${PASSWORD_MIN} caracteres`,
    test: (value) => value.length >= PASSWORD_MIN,
  },
  {
    id: "maiuscula",
    message: "The password needs an uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "numero",
    message: "The password needs a number",
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: "especial",
    message: "The password needs a special character",
    test: (value) => ESPECIAL.test(value),
  },
];

/** A primeira regra que falha, ou `null` se a password serve. */
export function firstFailedRule(value) {
  return passwordRules.find((rule) => !rule.test(value)) ?? null;
}
