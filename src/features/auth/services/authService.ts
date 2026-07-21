import { authRepository } from "@/data";
import type { LoginInput, RegisterInput } from "../schemas";

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

  signInWithGoogle() {
    return authRepository.signInWithGoogle(window.location.origin);
  },

  signOut() {
    return authRepository.signOut();
  },

  getCurrentSession() {
    return authRepository.getCurrentSession();
  },
};
