const PROFILE_KEY = "chef-xp:user";

/**
 * Em produção o cookie de CSRF tem o prefixo `__Host-`; em desenvolvimento não.
 * O cliente aceita os dois para não ficar preso a um ambiente.
 */
const CSRF_COOKIE_NAMES = ["__Host-csrf", "csrf"];

/** Emitido quando a API responde 401. A UI decide o que fazer. */
export const SESSION_EXPIRED_EVENT = "chef-xp:session-expired";

function apiBase(): string {
  if (import.meta.env.PROD) return "/api";
  return import.meta.env.VITE_API_URL || "/api";
}

function getCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function readCsrfCookie(): string | null {
  for (const name of CSRF_COOKIE_NAMES) {
    const value = getCookie(name);
    if (value) return value;
  }
  return null;
}

async function ensureCsrf(): Promise<string | null> {
  const existing = readCsrfCookie();
  if (existing) return existing;

  /**
   * Este pedido é o primeiro de qualquer escrita — e era ele que rebentava
   * com "Failed to fetch" quando o servidor estava em baixo, antes de o
   * pedido a sério chegar a ser feito. Falhar aqui em silêncio é o correto:
   * sem token, o pedido seguinte vai na mesma e é ele que dá a mensagem, uma
   * só e explicada.
   */
  try {
    const res = await fetch(`${apiBase()}/auth/csrf`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrfToken?: string };
    return data.csrfToken ?? readCsrfCookie();
  } catch {
    return null;
  }
}

export type ApiError = Error & { status?: number; details?: unknown };

type ApiFetchOptions = RequestInit & {
  /** Não emitir o evento de sessão expirada (usado pelo próprio /auth/me). */
  silentOn401?: boolean;
};

/**
 * As duas maneiras de não haver ligação, com as palavras certas para cada uma.
 *
 * Não são a mesma coisa para quem está do outro lado: sem rede, a pessoa sabe
 * o que fazer (sair do túnel, ligar o wifi); com rede mas sem servidor, não há
 * nada que ela possa fazer e o pior seria mandá-la verificar a Internet que
 * está a funcionar.
 */
export const OFFLINE_MESSAGE = "Sem ligação. Isto fica por gravar até voltares a ter rede.";
export const SERVER_MESSAGE = "O servidor não respondeu. Nada ficou gravado — tenta outra vez.";

/**
 * Emitido quando um pedido falha na rede, e outra vez quando volta a haver
 * resposta. `detail.alcancavel` diz qual dos dois.
 *
 * Existe porque `navigator.onLine` responde "tenho ligação a alguma coisa" e
 * não "chego ao servidor". Com o servidor em baixo e o wifi de pé, o browser
 * diz que está online e a app mostrava o erro cru do `fetch` — "Failed to
 * fetch" — a quem não faz ideia do que isso é. Quem sabe mesmo é o pedido que
 * falhou, e é ele que avisa.
 */
export const CONNECTION_EVENT = "chef-xp:connection";

function anunciarLigacao(alcancavel: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONNECTION_EVENT, { detail: { alcancavel } }));
}

/** Um erro de rede, já com uma frase que se percebe. */
function erroDeLigacao(): ApiError {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const err = new Error(offline ? OFFLINE_MESSAGE : SERVER_MESSAGE) as ApiError;
  err.status = 0;
  return err;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { silentOn401, ...init } = options;
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);

  /**
   * Escrever offline falha aqui, antes de sair da app.
   *
   * Podia ir à rede e falhar na mesma — mas falharia com "Failed to fetch",
   * que não diz nada a ninguém. E podia guardar numa fila para enviar mais
   * tarde: não guarda de propósito. O XP é um livro-razão com ordem, e
   * reenviar meia missão fora de ordem daria um estado que a pessoa nunca
   * pediu. Melhor dizer já que não ficou gravado.
   */
  if (
    method !== "GET" &&
    method !== "HEAD" &&
    typeof navigator !== "undefined" &&
    !navigator.onLine
  ) {
    const err = new Error(OFFLINE_MESSAGE) as ApiError;
    err.status = 0;
    throw err;
  }

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD") {
    const csrf = await ensureCsrf();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    // Aqui só chegam falhas de rede: o `fetch` só rejeita quando não houve
    // resposta nenhuma. Um 500 do servidor segue o caminho normal, abaixo.
    anunciarLigacao(false);
    throw erroDeLigacao();
  }

  /**
   * O service worker responde 503 com este cabeçalho quando não há rede nem
   * cópia guardada. Para quem chamou, é uma falha de rede como as outras — e
   * não um erro que o servidor tenha decidido devolver.
   */
  if (res.status === 503 && res.headers.get("X-ChefXP-Cache") === "vazia") {
    anunciarLigacao(false);
    throw erroDeLigacao();
  }

  anunciarLigacao(true);

  if (res.status === 401) {
    clearProfile();
    if (!silentOn401) {
      // Antes daqui saía um window.location.assign("/auth"), que recarregava a
      // página inteira e deitava fora a cache do React Query. Agora é a UI que
      // reage, mantendo o estado e a rota de origem.
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    const err = new Error("Sessão expirada") as ApiError;
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    let message = "O pedido falhou";
    let details: unknown;
    try {
      const data = (await res.json()) as { error?: string; details?: unknown };
      if (data.error) message = data.error;
      details = data.details;
    } catch {
      /* resposta sem corpo JSON */
    }
    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.details = details;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function saveProfile(user: unknown) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
  } catch {
    /* modo privado ou armazenamento cheio */
  }
}

export function readProfile<T>(): T | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
