import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateAccountPage } from "@/pages/CreateAccountPage";
import { renderWithProviders } from "@/test/utils";

const verificarLink = vi.hoisted(() => vi.fn());
const criar = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/services/authService", () => ({
  authService: { checkSignupToken: verificarLink, completeSignup: criar },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** Um token diferente por teste: a chave da query inclui-o. */
let contador = 0;
const proximoToken = () => String(contador++).padStart(64, "b");

async function abrir(token = proximoToken()) {
  renderWithProviders(<CreateAccountPage />, { route: `/criar-conta?token=${token}` });
  return token;
}

describe("escolher nome e password pelo link do email", () => {
  beforeEach(() => {
    verificarLink.mockReset();
    verificarLink.mockResolvedValue({ email: "novo@chef-xp.test" });
    criar.mockReset();
    criar.mockResolvedValue({ userId: "user-1" });
  });

  test("o ecrã diz para que endereço é a conta", async () => {
    await abrir();
    expect(await screen.findByText("novo@chef-xp.test")).toBeInTheDocument();
  });

  test("um link expirado não mostra formulário nenhum", async () => {
    verificarLink.mockRejectedValue(new Error("Link inválido ou expirado. Pede outro."));
    await abrir();

    expect(await screen.findByText(/link inválido ou expirado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome de utilizador")).not.toBeInTheDocument();
  });

  test("sem token, nem se pergunta ao servidor", async () => {
    renderWithProviders(<CreateAccountPage />, { route: "/criar-conta" });

    expect(await screen.findByText(/link inválido ou expirado/i)).toBeInTheDocument();
    expect(verificarLink).not.toHaveBeenCalled();
  });

  test("duas passwords diferentes não criam conta nenhuma", async () => {
    const utilizador = userEvent.setup();
    await abrir();

    await utilizador.type(await screen.findByLabelText("Nome de utilizador"), "chefnovo");
    await utilizador.type(screen.getByLabelText("Password"), "Chef12345!");
    await utilizador.type(screen.getByLabelText("Repetir a password"), "Chef12345?");
    await utilizador.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(await screen.findByText(/não coincidem/i)).toBeInTheDocument();
    expect(criar).not.toHaveBeenCalled();
  });

  test("cada campo tem o seu olho, e um não revela o outro", async () => {
    const utilizador = userEvent.setup();
    await abrir();

    await screen.findByLabelText("Nome de utilizador");
    const password = screen.getByLabelText("Password");
    const repetir = screen.getByLabelText("Repetir a password");

    await utilizador.click(screen.getAllByRole("button", { name: "Mostrar a password" })[0]);
    expect(password).toHaveAttribute("type", "text");
    expect(repetir).toHaveAttribute("type", "password");
  });

  test("com tudo certo, a conta é criada com o token do link", async () => {
    const utilizador = userEvent.setup();
    const token = await abrir();

    await utilizador.type(await screen.findByLabelText("Nome de utilizador"), "chefnovo");
    await utilizador.type(screen.getByLabelText("Password"), "Chef12345!");
    await utilizador.type(screen.getByLabelText("Repetir a password"), "Chef12345!");
    await utilizador.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({ token, username: "chefnovo", password: "Chef12345!" }),
    );
  });
});
