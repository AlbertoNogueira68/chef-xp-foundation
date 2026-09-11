import { apiFetch } from "@/services/api";
import type { User } from "@/types/user";

/**
 * Confirmação de conta e password.
 *
 * O código de seis dígitos nunca é gerado nem validado aqui: é pedido ao
 * servidor e enviado de volta tal como chegou. O cliente não sabe — nem tem
 * como saber — se está certo.
 */
export const accountService = {
  /** Reenviar o código de confirmação. */
  requestVerification(): Promise<{ sent: boolean; alreadyVerified?: boolean }> {
    return apiFetch("/auth/verify/request", { method: "POST" });
  },

  async verify(code: string): Promise<User> {
    const data = await apiFetch<{ user: User }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    return data.user;
  },

  /**
   * Pedir um código para recuperar a password.
   *
   * Responde o mesmo exista ou não a conta — por isso não há nada de útil a
   * devolver a quem chamou, e a UI diz sempre "se existir conta, enviámos".
   */
  forgotPassword(email: string): Promise<{ sent: boolean }> {
    return apiFetch("/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(input: {
    email: string;
    code: string;
    password: string;
  }): Promise<{ ok: boolean }> {
    return apiFetch("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Mudar a password, ou definir a primeira numa conta que entrou pela Google. */
  async changePassword(input: {
    currentPassword?: string | null;
    password: string;
  }): Promise<User> {
    const data = await apiFetch<{ user: User }>("/auth/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data.user;
  },
};
