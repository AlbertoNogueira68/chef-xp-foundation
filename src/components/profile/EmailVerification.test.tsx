import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailVerification } from "@/components/profile/EmailVerification";
import { makeUser, renderWithProviders } from "@/test/utils";

const enviar = vi.hoisted(() => vi.fn());
const providers = vi.hoisted(() => ({ value: { google: false, passwordRecovery: true } }));

vi.mock("@/features/auth/hooks/useAuthProviders", () => ({
  useAuthProviders: () => ({ data: providers.value }),
}));

vi.mock("@/features/auth/hooks/usePasswordRecovery", () => ({
  useSendEmailVerification: () => ({ mutate: enviar, isPending: false, isSuccess: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("estado do email nas definições", () => {
  beforeEach(() => {
    enviar.mockClear();
    providers.value = { google: false, passwordRecovery: true };
  });

  test("uma conta por confirmar mostra o aviso e o botão", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<EmailVerification user={makeUser({ emailVerified: false })} />);

    expect(screen.getByText(/por confirmar/i)).toBeInTheDocument();
    await utilizador.click(screen.getByRole("button", { name: /enviar confirmação/i }));

    expect(enviar).toHaveBeenCalledTimes(1);
  });

  test("uma conta confirmada não oferece botão nenhum", () => {
    renderWithProviders(<EmailVerification user={makeUser({ emailVerified: true })} />);

    expect(screen.getByText(/email confirmado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  /**
   * Sem SMTP no servidor não há confirmação possível. Um aviso permanente
   * sobre algo que ninguém pode resolver é ruído, não informação.
   */
  test("sem email configurado no servidor, não aparece nada", () => {
    providers.value = { google: false, passwordRecovery: false };
    const { container } = renderWithProviders(
      <EmailVerification user={makeUser({ emailVerified: false })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
