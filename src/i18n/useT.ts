import { useSyncExternalStore } from "react";
import { getLanguage, subscribe, t } from "./store";

/**
 * O `t` dentro de um componente.
 *
 * `useSyncExternalStore` é o que faz o ecrã inteiro voltar a desenhar quando
 * a língua muda — sem ele, a troca só se via nas partes que por acaso
 * voltassem a renderizar por outro motivo.
 */
export function useT() {
  useSyncExternalStore(subscribe, getLanguage, () => "en" as const);
  return t;
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, () => "en" as const);
}
