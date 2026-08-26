import type { AuthChangeEvent, AuthRepository, AuthSession } from "@/data/contracts/AuthRepository";
import { AuthError } from "@/data/contracts/errors";
import { apiFetch, clearProfile, saveProfile } from "@/services/api";
import type { User } from "@/types/user";

type AuthListeners = Set<(event: AuthChangeEvent, session: AuthSession | null) => void>;

const listeners: AuthListeners = new Set();

function notify(event: AuthChangeEvent, session: AuthSession | null) {
  for (const listener of listeners) listener(event, session);
}

function toSession(user: User): AuthSession {
  return { userId: user.id, email: user.email ?? null };
}

export class ApiAuthRepository implements AuthRepository {
  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    try {
      const data = await apiFetch<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        silentOn401: true,
      });
      saveProfile(data.user);
      const session = toSession(data.user);
      notify("SIGNED_IN", session);
      return session;
    } catch (error) {
      throw new AuthError(error instanceof Error ? error.message : "Falha no login", error);
    }
  }

  async signUpWithEmail(input: {
    email: string;
    password: string;
    username: string;
  }): Promise<{ userId: string; needsEmailConfirmation: boolean }> {
    try {
      const data = await apiFetch<{ user: User; needsEmailConfirmation: boolean }>(
        "/auth/register",
        { method: "POST", body: JSON.stringify(input), silentOn401: true },
      );
      saveProfile(data.user);
      notify("SIGNED_IN", toSession(data.user));
      return {
        userId: data.user.id,
        needsEmailConfirmation: data.needsEmailConfirmation,
      };
    } catch (error) {
      throw new AuthError(error instanceof Error ? error.message : "Falha no registo", error);
    }
  }

  async signInWithGoogle(_redirectUri: string): Promise<void> {
    void _redirectUri;
    throw new AuthError("O login com Google não está disponível nesta versão");
  }

  async signOut(): Promise<void> {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      clearProfile();
      notify("SIGNED_OUT", null);
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    try {
      // `silentOn401` evita disparar o evento de sessão expirada: aqui um 401
      // é a resposta normal para "ainda não iniciaste sessão".
      const data = await apiFetch<{ user: User }>("/auth/me", { silentOn401: true });
      saveProfile(data.user);
      return toSession(data.user);
    } catch {
      clearProfile();
      return null;
    }
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }
}
