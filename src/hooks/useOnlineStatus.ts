import { useSyncExternalStore } from "react";

/**
 * Se há rede, segundo o browser.
 *
 * `useSyncExternalStore` e não um `useState` com dois `addEventListener`:
 * é o que o React pede para ler estado que vive fora dele, e resolve de
 * borla o caso de a ligação cair entre o primeiro desenho e o efeito.
 *
 * Aviso honesto: `navigator.onLine` responde "tenho ligação a alguma coisa",
 * não "chego ao servidor". Um wifi de cozinha sem Internet dá `true`. Serve
 * para avisar cedo; quem decide de verdade é o pedido que falha.
 */
function subscrever(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscrever,
    () => navigator.onLine,
    // No servidor (e nos testes sem `navigator`) assume-se ligação: mostrar
    // "estás offline" a quem não está é pior do que não dizer nada.
    () => true,
  );
}
