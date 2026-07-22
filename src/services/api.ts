const PROFILE_KEY = "chef-xp:user";

function apiBase(): string {
  if (import.meta.env.PROD) return "/api";
  return import.meta.env.VITE_API_URL || "/api";
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrf(): Promise<string | null> {
  const existing = getCookie("csrf");
  if (existing) return existing;

  const res = await fetch(`${apiBase()}/auth/csrf`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { csrfToken?: string };
  return data.csrfToken ?? getCookie("csrf");
}

export type ApiError = Error & { status?: number };

type ApiFetchOptions = RequestInit & {
  skipAuthRedirect?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuthRedirect, ...init } = options;
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
    localStorage.removeItem(PROFILE_KEY);
    if (!skipAuthRedirect && !window.location.pathname.startsWith("/auth")) {
      window.location.assign("/auth");
    }
    const err = new Error("Unauthorized") as ApiError;
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message) as ApiError;
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function saveProfile(user: unknown) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
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
  localStorage.removeItem(PROFILE_KEY);
}
