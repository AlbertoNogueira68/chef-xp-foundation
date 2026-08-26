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

  const res = await fetch(`${apiBase()}/auth/csrf`, { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as { csrfToken?: string };
  return data.csrfToken ?? readCsrfCookie();
}

export type ApiError = Error & { status?: number; details?: unknown };

type ApiFetchOptions = RequestInit & {
  /** Não emitir o evento de sessão expirada (usado pelo próprio /auth/me). */
  silentOn401?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { silentOn401, ...init } = options;
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD") {
    const csrf = await ensureCsrf();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

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
