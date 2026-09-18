import { authRepository } from "@/data";
import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SignupCompleteInput,
} from "../schemas";

/**
 * Auth service: orquestra o AuthRepository. Regras de negócio de autenticação
 * vivem aqui — os hooks nunca chamam o repositório diretamente.
 */
export const authService = {
  signIn(input: LoginInput) {
    return authRepository.signInWithEmail(input.email, input.password);
  },

  signUp(input: RegisterInput) {
    return authRepository.signUpWithEmail(input);
  },

  startSignup(email: string) {
    return authRepository.startSignup(email);
  },

  checkSignupToken(token: string) {
    return authRepository.checkSignupToken(token);
  },

  /** O `confirm` fica-se pelo formulário: o servidor só guarda uma password. */
  completeSignup({ token, username, password }: SignupCompleteInput) {
    return authRepository.completeSignup({ token, username, password });
  },

  signInWithGoogle() {
    return authRepository.signInWithGoogle(window.location.origin);
  },

  requestPasswordReset(email: string) {
    return authRepository.requestPasswordReset(email);
  },

  resetPassword(input: ResetPasswordInput) {
    return authRepository.resetPassword(input.token, input.password);
  },

  sendEmailVerification() {
    return authRepository.sendEmailVerification();
  },

  verifyEmail(token: string) {
    return authRepository.verifyEmail(token);
  },

  signOut() {
    return authRepository.signOut();
  },

  getCurrentSession() {
    return authRepository.getCurrentSession();
  },
};
