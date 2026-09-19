import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import { AdminPage } from "@/pages/AdminPage";
import { makeUser, renderWithProviders } from "@/test/utils";
import type { UserRole } from "@/types/user";

const mocks = vi.hoisted(() => ({ role: "user" as UserRole }));

vi.mock("@/features/profile/hooks/useCurrentUser", () => ({
  currentUserQueryKey: ["currentUser"],
  useCurrentUser: () => ({ data: makeUser({ role: mocks.role }), isLoading: false }),
}));

vi.mock("@/features/admin/hooks/useAdmin", () => ({
  useReports: () => ({ data: { reports: [], open: 0 }, isLoading: false }),
  useResolveReport: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminUsers: () => ({ data: [], isLoading: false }),
  useSetRole: () => ({ mutate: vi.fn(), isPending: false }),
  usePlatformMetrics: () => ({ data: undefined, isLoading: true }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Esconder não é proteger — quem guarda as rotas é o servidor. O que se prova
 * aqui é o outro lado: não oferecer portas fechadas a quem não as pode abrir.
 */
describe("área de administração", () => {
  test("o moderador vê a fila, e não as contas nem os números", () => {
    mocks.role = "moderator";

    renderWithProviders(<AdminPage />, { route: "/admin" });

    expect(screen.getByRole("heading", { name: "Moderation" })).toBeInTheDocument();
    expect(screen.getByText(/nothing to handle/i)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Contas" })).not.toBeInTheDocument();
  });

  test("o admin vê os três separadores", () => {
    mocks.role = "admin";

    renderWithProviders(<AdminPage />, { route: "/admin" });

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Contas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Numbers" })).toBeInTheDocument();
  });

  test("quem não tem papel nenhum é reencaminhado para fora", () => {
    mocks.role = "user";

    renderWithProviders(<AdminPage />, { route: "/admin" });

    expect(screen.queryByRole("heading", { name: /admin|moderation/i })).not.toBeInTheDocument();
  });
});
