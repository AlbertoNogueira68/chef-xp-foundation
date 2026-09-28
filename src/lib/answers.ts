import type { AnswerValue } from "@/types/learning";

/**
 * Uma resposta em texto, para o painel de correção.
 *
 * Vive fora dos componentes porque é usada pela lição e pela revisão, e um
 * ficheiro de componentes que exporta funções perde o *fast refresh* do Vite:
 * qualquer alteração recarrega o módulo inteiro em vez de trocar só o
 * componente.
 *
 * Uma sequência mostra-se numerada — «1. Lavar as mãos · 2. Limpar a bancada»
 * — porque numa pergunta de ordenar o que estava errado foi a ordem, e uma
 * lista sem números não mostra ordem nenhuma.
 */
export function formatAnswer(answer: AnswerValue | null, unit?: string) {
  if (answer === null) return "";
  if (Array.isArray(answer)) return answer.map((step, i) => `${i + 1}. ${step}`).join("  ·  ");
  if (typeof answer === "number") return unit ? `${answer} ${unit}` : String(answer);
  return answer;
}
