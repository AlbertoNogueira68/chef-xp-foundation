import type {
  AuthChangeEvent,
  AuthRepository,
  AuthSession,
} from "@/data/contracts/AuthRepository";
import { AuthError } from "@/data/contracts/errors";
import { apiFetch, clearProfile, saveProfile } from "@/services/api";
import type { User } from "@/types/user";

type AuthListeners = Set<(event: AuthChangeEvent, session: AuthSession | null) => void>;

const listeners: AuthListeners = new Set();

function notify(event: AuthChangeEvent, session: AuthSession | null) {
  for (const listener of listeners) listener(event, session);
}

function toSession(user: User): AuthSession {
  return { userId: user.id, email: user.email };
}

export class ApiAuthRepository implements AuthRepository {
  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    try {
      const data = await apiFetch<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveProfile(data.user);
      const session = toSession(data.user);
      notify("SIGNED_IN", session);
      return session;
    } catch (error) {
      throw new AuthError(error instanceof Error ? error.message : "Login failed", error);
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
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      );
      saveProfile(data.user);
      notify("SIGNED_IN", toSession(data.user));
      return {
        userId: data.user.id,
        needsEmailConfirmation: data.needsEmailConfirmation,
      };
    } catch (error) {
      throw new AuthError(
        error instanceof Error ? error.message : "Registration failed",
        error,
      );
    }
  }

  async signInWithGoogle(_redirectUri: string): Promise<void> {
    void _redirectUri;
    throw new AuthError("Google sign-in is not available in this build");
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
      const data = await apiFetch<{ user: User }>("/auth/me", {
        skipAuthRedirect: true,
      });
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
