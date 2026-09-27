import { useSyncExternalStore } from "react";

/**
 * Quem já viu a apresentação da app, e quem a pediu outra vez.
 *
 * São duas coisas diferentes e vivem as duas aqui. A primeira é memória: fica
 * no `localStorage`, por pessoa, para que o tutorial apareça uma vez e não a
 * cada visita. A segunda é um pedido — o botão nas definições — e esse tem de
 * atravessar a árvore inteira: o botão está dentro do diálogo de definições e
 * o tutorial está na casca da aplicação, sem parentesco nenhum entre eles.
 *
 * Como no `i18n`, o estado vive fora do React: é um contador de pedidos que
 * qualquer componente pode ouvir, sem obrigar metade da app a passar uma
 * função de mão em mão.
 */

const CHAVE = "chefxp.tour";

/**
 * A versão do que já foi visto.
 *
 * Mudar de número é a maneira de voltar a mostrar o tutorial a toda a gente
 * quando ele passar a explicar alguma coisa nova. Guardar apenas "já viu"
 * deixava-nos sem essa hipótese.
 */
const VERSAO = "1";

function chaveDe(userId: string) {
  return `${CHAVE}.${userId}`;
}

/** Por pessoa: dois chefs no mesmo telemóvel são dois primeiros dias. */
export function tutorialVisto(userId: string) {
  try {
    return localStorage.getItem(chaveDe(userId)) === VERSAO;
  } catch {
    // Modo privado ou armazenamento bloqueado. Assumir "já viu" é o menos
    // mau: mais vale não mostrar do que mostrar o mesmo tutorial a cada
    // navegação a quem não o pode dispensar.
    return true;
  }
}

export function marcarTutorialVisto(userId: string) {
  try {
    localStorage.setItem(chaveDe(userId), VERSAO);
  } catch {
    /* não poder guardar não impede de fechar o tutorial nesta sessão */
  }
}

let pedidos = 0;
const ouvintes = new Set<() => void>();

/** O botão "ver outra vez" das definições. */
export function abrirTutorial() {
  pedidos += 1;
  for (const ouvinte of ouvintes) ouvinte();
}

function subscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Quantas vezes o tutorial foi pedido nesta sessão.
 *
 * É um contador e não um booleano de propósito: pedir duas vezes seguidas —
 * fechar e voltar a carregar no botão — tem de voltar a abrir, e um `true`
 * que já era `true` não avisa ninguém.
 */
export function usePedidosDeTutorial() {
  return useSyncExternalStore(
    subscrever,
    () => pedidos,
    () => 0,
  );
}
