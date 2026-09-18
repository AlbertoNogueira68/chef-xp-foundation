import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { renderWithProviders } from "@/test/utils";

const pedir = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
  reset: vi.fn(),
}));
const redefinir = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
}));

vi.mock("@/features/auth/hooks/usePasswordRecovery", () => ({
  useForgotPassword: () => pedir,
  useResetPassword: () => redefinir,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("pedir o link de recuperação", () => {
  beforeEach(() => {
    pedir.mutate.mockClear();
    pedir.isSuccess = false;
  });

  test("um email válido é enviado ao servidor", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await utilizador.type(screen.getByLabelText(/email/i), "alguem@chef-xp.test");
    await utilizador.click(screen.getByRole("button", { name: /enviar o link/i }));

    expect(pedir.mutate).toHaveBeenCalledWith("alguem@chef-xp.test");
  });

  /**
   * O campo é `type="email"`, portanto quem trava isto primeiro é o próprio
   * browser: a submissão nem chega ao `handleSubmit`, e o aviso que a pessoa
   * vê é o nativo. O zod continua lá por baixo, para o caso de o campo mudar
   * de tipo — mas o que este teste garante é o que interessa: um endereço mal
   * escrito não chega à rede.
   */
  test("um email inválido não chega à rede", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await utilizador.type(screen.getByLabelText(/email/i), "isto-nao-e-um-email");
    await utilizador.click(screen.getByRole("button", { name: /enviar o link/i }));

    expect(pedir.mutate).not.toHaveBeenCalled();
  });

  /**
   * A confirmação é condicional — "se houver uma conta" — e nunca diz que o
   * email existe. É a mesma frase para quem tem conta e para quem se enganou
   * no endereço.
   */
  test("depois de enviar, a mensagem não confirma que a conta existe", () => {
    pedir.isSuccess = true;
    renderWithProviders(<ForgotPasswordPage />);

    expect(screen.getByText(/se houver uma conta/i)).toBeInTheDocument();
  });
});

describe("redefinir a password", () => {
  beforeEach(() => redefinir.mutate.mockClear());

  test("sem token no endereço, o ecrã manda pedir outro link", () => {
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password" });

    expect(screen.getByText(/link incompleto/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pedir outro link/i })).toBeInTheDocument();
  });

  test("passwords diferentes não são enviadas", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, {
      route: `/reset-password?token=${"a".repeat(64)}`,
    });

    await utilizador.type(screen.getByLabelText(/^password nova$/i), "Password-nova-1!");
    await utilizador.type(screen.getByLabelText(/repetir/i), "password-diferente");
    await utilizador.click(screen.getByRole("button", { name: /guardar a password/i }));

    expect(await screen.findByText(/não coincidem/i)).toBeInTheDocument();
    expect(redefinir.mutate).not.toHaveBeenCalled();
  });

  test("o token do endereço vai com o pedido", async () => {
    const utilizador = userEvent.setup();
    const token = "b".repeat(64);
    renderWithProviders(<ResetPasswordPage />, { route: `/reset-password?token=${token}` });

    await utilizador.type(screen.getByLabelText(/^password nova$/i), "Password-nova-1!");
    await utilizador.type(screen.getByLabelText(/repetir/i), "Password-nova-1!");
    await utilizador.click(screen.getByRole("button", { name: /guardar a password/i }));

    expect(redefinir.mutate).toHaveBeenCalledTimes(1);
    expect(redefinir.mutate.mock.calls[0][0]).toMatchObject({
      token,
      password: "Password-nova-1!",
    });
  });
});
