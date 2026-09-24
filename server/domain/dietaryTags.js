/**
 * O conjunto fechado de preferências e restrições alimentares que uma
 * receita pode ter. Fechado e não texto livre: filtrar por "vegetariano" só
 * funciona se todas as receitas vegetarianas usarem exatamente a mesma
 * palavra. A mesma lista está duplicada em `src/constants/dietaryTags.ts`
 * (com as etiquetas em português) porque o frontend não importa módulos do
 * servidor.
 */
export const DIETARY_TAGS = Object.freeze([
  "vegetariano",
  "vegano",
  "sem_gluten",
  "sem_lactose",
  "sem_frutos_secos",
  "sem_ovo",
  "sem_soja",
  "sem_acucar",
  "halal",
  "kosher",
]);
