import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlockedAccounts } from "@/components/moderation/BlockedAccounts";
import { renderWithProviders } from "@/test/utils";

const mocks = vi.hoisted(() => ({
  blocked: [] as Array<{
    id: string;
    username: string;
    photoUrl: null;
    level: number;
    blockedAt: string;
  }>,
  toggle: vi.fn(),
}));

vi.mock("@/features/moderation/hooks/useModeration", () => ({
  useBlockedUsers: () => ({ data: mocks.blocked, isLoading: false }),
  useToggleBlock: () => ({ mutate: mocks.toggle, isPending: false }),
}));

/**
 * Bloquear esconde a pessoa de todos os sítios onde se poderia lá voltar para
 * desfazer o bloqueio. Esta lista é a maçaneta do lado de dentro — se ela
 * desaparecer, o bloqueio passa a ser permanente sem ninguém ter decidido isso.
 */
describe("contas bloqueadas", () => {
  test("sem ninguém bloqueado, explica o que o bloqueio faz", () => {
    mocks.blocked = [];

    renderWithProviders(<BlockedAccounts />);

    expect(screen.getByText(/haven't blocked anyone/i)).toBeInTheDocument();
  });

  test("cada linha tem o nome e o caminho de volta", async () => {
    mocks.blocked = [
      { id: "user-9", username: "bruno", photoUrl: null, level: 4, blockedAt: "2026-09-01" },
    ];
    const utilizador = userEvent.setup();

    renderWithProviders(<BlockedAccounts />);

    expect(screen.getByText("bruno")).toBeInTheDocument();

    await utilizador.click(screen.getByRole("button", { name: "Desbloquear" }));
    expect(mocks.toggle).toHaveBeenCalledWith({ id: "user-9", blocked: true });
  });
});
