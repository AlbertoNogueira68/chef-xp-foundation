/**
 * Service worker do ChefXP.
 *
 * Escrito à mão, e não gerado por uma biblioteca, por duas razões: são cem
 * linhas, e é a peça que decide o que a app mostra quando a rede falha — vale
 * a pena poder lê-la de uma ponta à outra.
 *
 * O que fica offline, e porquê:
 *
 *   - O "shell" (a página, o offline.html, os ícones) é guardado na
 *     instalação: é o que faz a app abrir sem rede em vez de dar o dinossauro.
 *   - Os ficheiros de `/assets/` têm o hash do conteúdo no nome, portanto são
 *     imutáveis: cache primeiro, sem sequer perguntar à rede.
 *   - As imagens de `/uploads/` também, com um limite — a cozinha de alguém
 *     não pode encher o disco do telemóvel.
 *   - Os GET da API são rede primeiro, cache como rede de segurança. Ver a
 *     receita de há bocado sem rede é útil; vê-la desatualizada durante uma
 *     semana não é.
 *
 * E o que **não** fica: nada que escreva. Um POST offline falha e diz que
 * falhou. Guardá-lo numa fila para enviar mais tarde parece simpático e é uma
 * armadilha — o XP é um livro-razão com ordem, e reenviar três passos de uma
 * missão fora de ordem, meia hora depois, dá um estado que ninguém pediu. Quem
 * está a cozinhar prefere saber já que aquele passo não foi registado.
 */

const VERSAO = "v3";
const CACHE_SHELL = `chefxp-shell-${VERSAO}`;
const CACHE_ASSETS = `chefxp-assets-${VERSAO}`;
const CACHE_API = `chefxp-api-${VERSAO}`;
const CACHE_IMAGENS = `chefxp-imagens-${VERSAO}`;
const CACHE_OUTROS = `chefxp-outros-${VERSAO}`;
const CACHES_ATUAIS = [CACHE_SHELL, CACHE_ASSETS, CACHE_API, CACHE_IMAGENS, CACHE_OUTROS];

/** Quantas fotografias se guardam. Acima disto, saem as mais antigas. */
const LIMITE_DE_IMAGENS = 60;

const SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // O chef aparece em todos os ecrãs de lição, e as lições são para fazer ao
  // pé do fogão — onde a rede é o que é. Sem isto, quem cozinha offline vê
  // balões de fala com um buraco ao lado.
  "/mascot/chef-frog-avatar.png",
  "/mascot/chef-frog-avatar-96.png",
];

self.addEventListener("install", (event) => {
  // `skipWaiting` não é chamado aqui: uma versão nova não toma conta da app a
  // meio de uma missão. Fica à espera, a app avisa, e a pessoa decide.
  event.waitUntil(caches.open(CACHE_SHELL).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((nome) => !CACHES_ATUAIS.includes(nome)).map((nome) => caches.delete(nome)),
      );
      await self.clients.claim();
    })(),
  );
});

/** A app pede a troca quando a pessoa aceita atualizar. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET. O resto vai à rede como sempre foi e falha quando não há rede —
  // que é exatamente o que se quer que aconteça.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navegacao(request));
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(api(request));
  } else if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(cachePrimeiro(request, CACHE_IMAGENS, LIMITE_DE_IMAGENS));
  } else if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/mascot/")
  ) {
    event.respondWith(cachePrimeiro(request, CACHE_ASSETS));
  } else {
    // Tudo o resto — incluindo os módulos que o Vite serve em `/src/` e
    // `/@vite/` durante o desenvolvimento.
    //
    // Rede primeiro, e é isso que torna isto seguro: com rede, o browser
    // recebe sempre a versão mais recente e o hot reload continua a funcionar
    // como se nada fosse. A cópia guardada só entra em jogo quando não há
    // rede — e sem ela a app instalada a partir do servidor de
    // desenvolvimento abria offline sem o JavaScript que a põe de pé, ou
    // seja, não abria de todo.
    event.respondWith(redePrimeiro(request, CACHE_OUTROS));
  }
});

/**
 * Navegação: rede primeiro.
 *
 * A app é uma SPA, portanto qualquer rota devolve o mesmo index.html — e é
 * esse que fica guardado em "/". Sem rede, é ele que abre e o router trata do
 * resto; o offline.html só aparece se nem isso houver (primeira visita sem
 * rede nenhuma).
 */
async function navegacao(request) {
  try {
    const resposta = await fetch(request);
    if (resposta.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put("/", resposta.clone());
    }
    return resposta;
  } catch {
    return (await caches.match("/")) ?? (await caches.match("/offline.html"));
  }
}

/**
 * API: rede primeiro, cache como rede de segurança.
 *
 * Só se guarda o que veio bem. Guardar um 401 ou um 500 era servir o erro
 * outra vez, já offline, a quem afinal tinha sessão.
 */
async function api(request) {
  const cache = await caches.open(CACHE_API);

  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch {
    const guardada = await cache.match(request);
    if (guardada) {
      // O cabeçalho diz à app que aquilo veio da despensa e não da rede, para
      // ela poder avisar em vez de mostrar dados velhos como se fossem novos.
      const copia = new Response(guardada.body, {
        status: guardada.status,
        statusText: guardada.statusText,
        headers: new Headers(guardada.headers),
      });
      copia.headers.set("X-ChefXP-Cache", "offline");
      return copia;
    }

    return new Response(JSON.stringify({ error: "Sem ligação e sem cópia guardada." }), {
      status: 503,
      headers: { "Content-Type": "application/json", "X-ChefXP-Cache": "vazia" },
    });
  }
}

/** Sempre da rede quando há rede; a cache é só a rede de segurança. */
async function redePrimeiro(request, nomeDaCache) {
  const cache = await caches.open(nomeDaCache);
  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
    throw erro;
  }
}

/** Ficheiros imutáveis: se está na cache, nem se pergunta à rede. */
async function cachePrimeiro(request, nomeDaCache, limite) {
  const cache = await caches.open(nomeDaCache);
  const guardada = await cache.match(request);
  if (guardada) return guardada;

  const resposta = await fetch(request);
  if (resposta.ok) {
    await cache.put(request, resposta.clone());
    if (limite) await aparar(cache, limite);
  }
  return resposta;
}

/** Sai a mais antiga. `keys()` devolve por ordem de inserção. */
async function aparar(cache, limite) {
  const chaves = await cache.keys();
  for (const chave of chaves.slice(0, Math.max(0, chaves.length - limite))) {
    await cache.delete(chave);
  }
}
