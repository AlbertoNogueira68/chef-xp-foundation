/**
 * Contrato do repositório de autenticação.
 *
 * A UI e os serviços devem depender APENAS desta interface. Trocar de provider
 * (Lovable Cloud → API REST própria) consiste em criar outra implementação.
 */
export interface AuthSession {
  userId: string;
  email: string | null;
}

export type AuthChangeEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";

export interface AuthRepository {
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  signUpWithEmail(input: {
    email: string;
    password: string;
    username: string;
  }): Promise<{ userId: string; needsEmailConfirmation: boolean }>;
  signInWithGoogle(redirectUri: string): Promise<void>;
  signOut(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ): () => void;
}
