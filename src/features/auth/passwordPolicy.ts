import { z } from "zod";

/**
 * A regra da password, num sítio só.
 *
 * Isto é a versão do cliente; o servidor tem a mesma lista em
 * `server/domain/passwordPolicy.js` e é ele que decide. Aqui serve para dois
 * fins: dar erro sem ir à rede e, sobretudo, mostrar em tempo real o que a
 * password já cumpre — quem está a escrever vê a lista a ficar verde em vez
 * de adivinhar e levar com um erro no fim.
 */

export const PASSWORD_MIN = 8;

/** Pontuação ASCII. Deixar de fora acentos e letras de outros alfabetos, que
 *  são letras e não caracteres especiais. */
const ESPECIAL = /[!-/:-@[-`{-~]/;

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const passwordRules: PasswordRule[] = [
  {
    id: "tamanho",
    label: `Pelo menos ${PASSWORD_MIN} caracteres`,
    test: (value) => value.length >= PASSWORD_MIN,
  },
  {
    id: "maiuscula",
    label: "Uma letra maiúscula",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "numero",
    label: "Um número",
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: "especial",
    label: "Um caractere especial (! ? @ # …)",
    test: (value) => ESPECIAL.test(value),
  },
];

/** O estado de cada regra para a password que está a ser escrita. */
export function checkPassword(value: string) {
  return passwordRules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    ok: rule.test(value),
  }));
}

export function passwordIsStrong(value: string) {
  return passwordRules.every((rule) => rule.test(value));
}

/**
 * O schema. Aponta uma regra de cada vez — a lista por baixo do campo é que
 * mostra o conjunto todo, e repetir aqui as quatro mensagens só enchia o ecrã.
 */
export const passwordSchema = z
  .string()
  .max(200, "Máximo 200 caracteres")
  .superRefine((value, ctx) => {
    const falta = passwordRules.find((rule) => !rule.test(value));
    if (!falta) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Falta: ${falta.label.toLowerCase()}`,
    });
  });
