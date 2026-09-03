/**
 * Conversa com a Google. Fluxo Authorization Code, do lado do servidor.
 *
 * Porquê este fluxo e não o botão do Google Identity Services: o GIS exige
 * carregar um script de accounts.google.com, o que obrigaria a abrir a CSP
 * (`scriptSrc`, `connectSrc` e `frameSrc`) que este projeto fechou de
 * propósito — e há um teste de hardening a impedir CDNs. Assim o browser
 * nunca fala com a Google a partir da nossa página: só é reencaminhado.
 */
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || "";
}

/**
 * O URI de retorno tem de ser exatamente igual ao registado na Google Cloud
 * Console. Por omissão deriva do FRONTEND_URL, que em desenvolvimento é o
 * Vite (que faz proxy do /api) e em produção é o próprio Express.
 */
export function googleRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const base = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

/** Sem credenciais, o SSO não existe: as rotas respondem 404 e o botão não aparece. */
export function isGoogleConfigured() {
  return Boolean(googleClientId() && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleAuthUrl({ state }) {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", googleClientId());
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // Só queremos identificar a pessoa, não agir por ela mais tarde: sem
  // refresh token, não há nada de longa duração para guardar nem para
  // vazar.
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeCodeForIdToken(code) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    // O corpo do erro da Google traz o client_id; não vai para os logs.
    throw new Error(`A troca de código com a Google falhou (${response.status})`);
  }

  const data = await response.json();
  if (!data.id_token) throw new Error("A Google não devolveu id_token");
  return data.id_token;
}
