/**
 * Registo do service worker e aviso de versão nova.
 *
 * Regista em desenvolvimento também, e não só na build. A razão é prática:
 * uma app que só é instalável noutro endereço obriga quem a experimenta a
 * saber de dois localhosts e a escolher o certo — e quem se enganar conclui
 * que o modo offline não existe.
 *
 * O perigo habitual de um service worker em desenvolvimento é servir módulos
 * velhos e transformar cada alteração numa caça ao fantasma. Aqui não
 * acontece: o `sw.js` trata tudo o que não é imutável — a página, a API e os
 * módulos que o Vite serve — como rede primeiro. Com rede, chega sempre o mais
 * recente e o hot reload não dá por nada; a cópia guardada só aparece quando a
 * rede falha.
 *
 * `VITE_DISABLE_SW=true` desliga o registo, para quando alguém estiver mesmo a
 * depurar cache e queira o browser sem intermediários.
 */

/** Emitido quando há uma versão nova à espera. A UI decide como avisar. */
export const NEW_VERSION_EVENT = "chef-xp:new-version";

let aEspera: ServiceWorker | null = null;

export function registerServiceWorker() {
  if (import.meta.env.VITE_DISABLE_SW === "true") return;
  if (!("serviceWorker" in navigator)) return;

  // Esperar pelo `load` evita disputar largura de banda com o primeiro
  // desenho. Mas se a página já acabou de carregar — o `main.tsx` pode ser
  // avaliado depois disso — o evento nunca mais chega, e sem esta condição o
  // registo simplesmente não acontecia. Foi o que aconteceu à primeira versão.
  if (document.readyState === "complete") {
    void registar();
  } else {
    window.addEventListener("load", () => void registar());
  }

  async function registar() {
    try {
      const registo = await navigator.serviceWorker.register("/sw.js");

      // Três caminhos para o mesmo sítio: já havia uma à espera quando a app
      // abriu, apareceu uma enquanto estávamos aqui, ou o browser encontrou-a
      // na verificação periódica.
      if (registo.waiting) anunciar(registo.waiting);

      registo.addEventListener("updatefound", () => {
        const nova = registo.installing;
        if (!nova) return;
        nova.addEventListener("statechange", () => {
          // `controller` nulo = primeira instalação: não há versão anterior
          // para substituir, e avisar aí só assustava sem motivo.
          if (nova.state === "installed" && navigator.serviceWorker.controller) {
            anunciar(nova);
          }
        });
      });
    } catch (error) {
      // Um service worker que não regista não pode partir a app: quem estiver
      // online continua a usá-la como sempre.
      console.warn("[pwa] service worker não registado:", error);
    }
  }

  // Quando a nova toma conta, recarrega uma vez — e só uma.
  let recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregou) return;
    recarregou = true;
    window.location.reload();
  });
}

function anunciar(worker: ServiceWorker) {
  aEspera = worker;
  window.dispatchEvent(new CustomEvent(NEW_VERSION_EVENT));
}

/** Aceitar a atualização: a versão à espera passa a mandar. */
export function applyUpdate() {
  aEspera?.postMessage({ type: "SKIP_WAITING" });
}
