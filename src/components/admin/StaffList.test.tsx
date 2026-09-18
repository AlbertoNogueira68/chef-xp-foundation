import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffList } from "@/components/admin/StaffList";
import { renderWithProviders } from "@/test/utils";
import type { AdminUser } from "@/types/admin";

const mocks = vi.hoisted(() => ({ users: [] as AdminUser[], setRole: vi.fn() }));

vi.mock("@/features/admin/hooks/useAdmin", () => ({
  useAdminUsers: () => ({ data: mocks.users, isLoading: false }),
  useSetRole: () => ({ mutate: mocks.setRole, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function conta(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "user-9",
    username: "bruno",
    email: "bruno@exemplo.com",
    photoUrl: null,
    level: 4,
    xp: 300,
    role: "user",
    emailVerified: true,
    createdAt: "2026-01-01",
    recipes: 3,
    reportsReceived: 0,
    ...overrides,
  };
}

/**
 * As três recusas do servidor (`roleChangeRefusal`) têm de ter tradução no
 * ecrã: um botão que existe para dar 403 é pior do que botão nenhum.
 */
describe("contas, na administração", () => {
  test("promove quem não tem papel", async () => {
    mocks.users = [conta()];
    const utilizador = userEvent.setup();

    renderWithProviders(<StaffList meId="admin-1" />);
    await utilizador.click(screen.getByRole("button", { name: /tornar moderador/i }));

    expect(mocks.setRole).toHaveBeenCalledWith({ id: "user-9", role: "moderator" });
  });

  test("a um moderador oferece o contrário", () => {
    mocks.users = [conta({ role: "moderator" })];

    renderWithProviders(<StaffList meId="admin-1" />);

    expect(screen.getByRole("button", { name: /retirar moderação/i })).toBeInTheDocument();
    expect(screen.getByText("Moderador")).toBeInTheDocument();
  });

  test("não oferece mudar o meu próprio papel nem despromover outro admin", () => {
    mocks.users = [
      conta({ id: "admin-1", role: "admin" }),
      conta({ id: "admin-2", role: "admin" }),
    ];

    renderWithProviders(<StaffList meId="admin-1" />);

    expect(
      screen.queryByRole("button", { name: /tornar moderador|retirar moderação/i }),
    ).not.toBeInTheDocument();
  });

  test("mostra o que decide uma promoção: receitas, denúncias e email", () => {
    mocks.users = [conta({ recipes: 3, reportsReceived: 2, emailVerified: false })];

    renderWithProviders(<StaffList meId="admin-1" />);

    const linha = screen.getByText(/3 receitas/);
    expect(linha).toHaveTextContent("2 denúncias");
    expect(linha).toHaveTextContent("email por confirmar");
  });
});
