/**
 * Contrato do repositório de autenticação.
 * A UI e os serviços devem depender APENAS desta interface.
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

  /**
   * Criar conta, primeiro passo: pede o link. Responde sempre igual, esteja o
   * endereço livre ou já registado.
   */
  startSignup(email: string): Promise<void>;
  /** O link ainda vale? Para que endereço é? */
  checkSignupToken(token: string): Promise<{ email: string }>;
  /** Segundo passo: nome e password. Cria a conta e abre a sessão. */
  completeSignup(input: {
    token: string;
    username: string;
    password: string;
  }): Promise<{ userId: string }>;

  /** Pede o email com o link de recuperação. Responde sempre igual, haja conta ou não. */
  requestPasswordReset(email: string): Promise<void>;
  /** Redefine com o token que veio no email. Não inicia sessão. */
  resetPassword(token: string, password: string): Promise<void>;
  /** Manda (ou repete) o email de confirmação da conta com sessão aberta. */
  sendEmailVerification(): Promise<void>;
  /** Confirma o email. Não precisa de sessão: o token é a prova. */
  verifyEmail(token: string): Promise<{ alreadyVerified: boolean }>;
  signOut(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ): () => void;
}
