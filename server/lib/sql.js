/**
 * Um valor de utilizador como padrão de `ILIKE ... '%valor%'`.
 *
 * `%` e `_` são curingas em `LIKE`: sem os escapar, procurar "100%" ou "_"
 * devolvia tudo. A barra invertida é o caractere de escape por omissão.
 */
export function containsPattern(value) {
  return `%${String(value).replace(/[\\%_]/g, "\\$&")}%`;
}
