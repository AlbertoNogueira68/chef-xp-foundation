import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { renderWithProviders } from "@/test/utils";

const providers = vi.hoisted(() => ({
  valor: { google: false, passwordRecovery: true, signupFlow: "verified" as "verified" | "direct" },
}));
const pedirLink = vi.hoisted(() => vi.fn());
const signUp = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));

vi.mock("@/services/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  apiFetch: vi.fn(async () => providers.valor),
}));
vi.mock("@/features/auth/hooks/useSignUp", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSignUp: () => signUp,
}));
vi.mock("@/features/auth/services/authService", () => ({
  authService: { startSignup: pedirLink },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** O estado de um requisito da password, lido como o utilizador o lê. */
function requisito(texto: string | RegExp) {
  const item = screen.getByText(texto).closest("li");
  if (!item) throw new Error(`requisito não encontrado: ${texto}`);
  return within(item).queryByText("— done") ? "cumprido" : "em falta";
}

describe("criar conta com email a funcionar", () => {
  beforeEach(() => {
    providers.valor.signupFlow = "verified";
    pedirLink.mockReset();
    pedirLink.mockResolvedValue(undefined);
  });

  test("pede o endereço e mais nada — a password fica para depois", async () => {
    renderWithProviders(<RegisterForm />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });

  test("submeter manda o email e diz que o link vai a caminho", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await utilizador.type(await screen.findByLabelText("Email"), "novo@chef-xp.test");
    await utilizador.click(screen.getByRole("button", { name: /send sign-up link/i }));

    expect(pedirLink).toHaveBeenCalledWith("novo@chef-xp.test");
    expect(
      await screen.findByText(/an email is on its way to novo@chef-xp.test/i),
    ).toBeInTheDocument();
  });
});

describe("criar conta sem email configurado", () => {
  beforeEach(() => {
    providers.valor.signupFlow = "direct";
    signUp.mutate.mockClear();
  });

  test("a lista de requisitos acompanha o que já foi escrito", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    const campo = await screen.findByLabelText("Password");

    await utilizador.type(campo, "chefchef");
    expect(requisito(/at least 8 characters/i)).toBe("cumprido");
    expect(requisito(/uppercase letter/i)).toBe("em falta");
    expect(requisito(/one number/i)).toBe("em falta");

    await utilizador.clear(campo);
    await utilizador.type(campo, "Chef12345!");
    for (const texto of [
      /at least 8 characters/i,
      /uppercase letter/i,
      /one number/i,
      /special character/i,
    ]) {
      expect(requisito(texto)).toBe("cumprido");
    }
  });

  test("o olho mostra e volta a esconder o que se escreveu", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    const campo = await screen.findByLabelText("Password");
    expect(campo).toHaveAttribute("type", "password");

    await utilizador.click(screen.getByRole("button", { name: "Show password" }));
    expect(campo).toHaveAttribute("type", "text");

    await utilizador.click(screen.getByRole("button", { name: "Hide password" }));
    expect(campo).toHaveAttribute("type", "password");
  });

  test("uma password que não cumpre a regra não chega a ser enviada", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await utilizador.type(await screen.findByLabelText("Username"), "chefteste");
    await utilizador.type(screen.getByLabelText("Email"), "chef@chef-xp.test");
    await utilizador.type(screen.getByLabelText("Password"), "chefchef");
    await utilizador.click(screen.getByRole("button", { name: /create account/i }));

    expect(signUp.mutate).not.toHaveBeenCalled();
  });

  test("com tudo cumprido, o registo segue para o servidor", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<RegisterForm />);

    await utilizador.type(await screen.findByLabelText("Username"), "chefteste");
    await utilizador.type(screen.getByLabelText("Email"), "chef@chef-xp.test");
    await utilizador.type(screen.getByLabelText("Password"), "Chef12345!");
    await utilizador.click(screen.getByRole("button", { name: /create account/i }));

    expect(signUp.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ password: "Chef12345!" }),
      expect.anything(),
    );
  });
});
