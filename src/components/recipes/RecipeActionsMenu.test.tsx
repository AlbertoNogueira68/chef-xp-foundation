import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipeActionsMenu } from "@/components/recipes/RecipeActionsMenu";
import { makeRecipe, makeUser, renderWithProviders } from "@/test/utils";

const mocks = vi.hoisted(() => ({ user: null as ReturnType<typeof makeUser> | null }));

vi.mock("@/features/profile/hooks/useCurrentUser", () => ({
  currentUserQueryKey: ["currentUser"],
  useCurrentUser: () => ({ data: mocks.user }),
}));

const remove = vi.hoisted(() => vi.fn());
vi.mock("@/features/feed/hooks/useRecipes", () => ({
  useDeleteRecipe: () => ({ mutate: remove, isPending: false }),
  useUpdateRecipe: () => ({ mutate: vi.fn(), isPending: false }),
}));

const block = vi.hoisted(() => vi.fn());
vi.mock("@/features/moderation/hooks/useModeration", () => ({
  useToggleBlock: () => ({ mutate: block, isPending: false }),
  useReport: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * O servidor já recusa quem não é autor. Este menu não existe por segurança —
 * existe para não oferecer a alguém uma ação que vai falhar, e para oferecer a
 * quem não é autor as duas que lhe pertencem: denunciar e bloquear.
 */
describe("menu de opções da receita", () => {
  test("nas receitas de outra pessoa dá denunciar e bloquear, e não editar", async () => {
    mocks.user = makeUser({ id: "outro-qualquer" });
    const utilizador = userEvent.setup();

    renderWithProviders(<RecipeActionsMenu recipe={makeRecipe()} />);
    await utilizador.click(screen.getByRole("button", { name: "Opções da receita" }));

    expect(await screen.findByRole("menuitem", { name: /denunciar receita/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /bloquear/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /^apagar/i })).not.toBeInTheDocument();
  });

  test("bloquear pergunta antes, e diz o que acontece a quem se seguia", async () => {
    mocks.user = makeUser({ id: "outro-qualquer" });
    const utilizador = userEvent.setup();

    renderWithProviders(<RecipeActionsMenu recipe={makeRecipe()} />);
    await utilizador.click(screen.getByRole("button", { name: "Opções da receita" }));
    await utilizador.click(await screen.findByRole("menuitem", { name: /bloquear/i }));

    const aviso = await screen.findByRole("alertdialog");
    expect(aviso).toHaveTextContent(/deixam de se seguir/i);
    expect(block).not.toHaveBeenCalled();
  });

  test("não aparece antes de se saber quem está autenticado", () => {
    mocks.user = null;

    renderWithProviders(<RecipeActionsMenu recipe={makeRecipe()} />);

    expect(screen.queryByRole("button", { name: "Opções da receita" })).not.toBeInTheDocument();
  });

  test("aparece ao autor, com editar e apagar", async () => {
    mocks.user = makeUser({ id: "user-1" });
    const utilizador = userEvent.setup();

    renderWithProviders(<RecipeActionsMenu recipe={makeRecipe()} />);
    await utilizador.click(screen.getByRole("button", { name: "Opções da receita" }));

    expect(await screen.findByRole("menuitem", { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /apagar/i })).toBeInTheDocument();
  });

  test("apagar pede confirmação e diz o que se perde", async () => {
    mocks.user = makeUser({ id: "user-1" });
    const utilizador = userEvent.setup();

    renderWithProviders(<RecipeActionsMenu recipe={makeRecipe({ xpReward: 25 })} />);
    await utilizador.click(screen.getByRole("button", { name: "Opções da receita" }));
    await utilizador.click(await screen.findByRole("menuitem", { name: /apagar/i }));

    const aviso = await screen.findByRole("alertdialog");
    expect(aviso).toHaveTextContent(/25 XP/);
    expect(aviso).toHaveTextContent(/não dá para voltar atrás/i);
    // Ainda não apagou nada: só perguntou.
    expect(remove).not.toHaveBeenCalled();
  });
});
