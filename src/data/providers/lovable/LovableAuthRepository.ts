import type {
  AuthChangeEvent,
  AuthRepository,
  AuthSession,
} from "@/data/contracts/AuthRepository";
import { AuthError } from "@/data/contracts/errors";
import { lovable, supabase } from "./client";

function toSession(user: { id: string; email?: string | null } | null): AuthSession | null {
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}

export class LovableAuthRepository implements AuthRepository {
  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new AuthError(error?.message ?? "Failed to sign in", error);
    }
    return { userId: data.user.id, email: data.user.email ?? null };
  }

  async signUpWithEmail({
    email,
    password,
    username,
  }: {
    email: string;
    password: string;
    username: string;
  }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { username },
      },
    });
    if (error || !data.user) {
      throw new AuthError(error?.message ?? "Failed to sign up", error);
    }
    return {
      userId: data.user.id,
      needsEmailConfirmation: !data.session,
    };
  }

  async signInWithGoogle(redirectUri: string): Promise<void> {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
    });
    if (result.error) {
      throw new AuthError(
        result.error instanceof Error ? result.error.message : "Google sign-in failed",
        result.error,
      );
    }
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new AuthError(error.message, error);
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const { data } = await supabase.auth.getUser();
    return toSession(data.user);
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ): () => void {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      callback(event as AuthChangeEvent, toSession(session?.user ?? null));
    });
    return () => data.subscription.unsubscribe();
  }
}
