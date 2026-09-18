import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentActions } from "@/components/recipes/CommentActions";
import { renderWithProviders } from "@/test/utils";
import type { Comment } from "@/types/recipe";

vi.mock("@/features/moderation/hooks/useModeration", () => ({
  useReport: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleBlock: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeComment(authorId: string): Comment {
  return {
    id: "comment-1",
    body: "isto não presta",
    createdAt: new Date().toISOString(),
    author: { id: authorId, username: "bruno", photoUrl: null, level: 2 },
  };
}

const abrirMenu = async () => {
  const utilizador = userEvent.setup();
  await utilizador.click(screen.getByRole("button", { name: /opções do comentário/i }));
  return utilizador;
};

/**
 * Apagar um comentário tem três donos (ver `domain/moderation.js`). Aqui
 * provam-se os dois que dependem de quem está a olhar para o ecrã — e, de
 * caminho, que ninguém é convidado a denunciar-se a si próprio.
 */
describe("opções de um comentário", () => {
  test("o autor do comentário pode apagá-lo e não se denuncia a si mesmo", async () => {
    renderWithProviders(
      <CommentActions
        comment={makeComment("eu")}
        meId="eu"
        recipeAuthorId="outra-pessoa"
        onDelete={vi.fn()}
        isDeleting={false}
      />,
    );
    await abrirMenu();

    expect(await screen.findByRole("menuitem", { name: /^apagar$/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /denunciar/i })).not.toBeInTheDocument();
  });

  test("o dono da receita apaga o comentário de outra pessoa — e vê de quem é a casa", async () => {
    const apagar = vi.fn();
    renderWithProviders(
      <CommentActions
        comment={makeComment("bruno")}
        meId="eu"
        recipeAuthorId="eu"
        onDelete={apagar}
        isDeleting={false}
      />,
    );
    const utilizador = await abrirMenu();

    const item = await screen.findByRole("menuitem", { name: /apagar da minha receita/i });
    await utilizador.click(item);
    expect(apagar).toHaveBeenCalled();
  });

  test("quem não é nenhum dos dois só tem a denúncia", async () => {
    renderWithProviders(
      <CommentActions
        comment={makeComment("bruno")}
        meId="eu"
        recipeAuthorId="outra-pessoa"
        onDelete={vi.fn()}
        isDeleting={false}
      />,
    );
    await abrirMenu();

    expect(await screen.findByRole("menuitem", { name: /denunciar/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /apagar/i })).not.toBeInTheDocument();
  });

  test("sem sessão não se mostra menu nenhum", () => {
    renderWithProviders(
      <CommentActions
        comment={makeComment("bruno")}
        recipeAuthorId="outra-pessoa"
        onDelete={vi.fn()}
        isDeleting={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /opções do comentário/i })).not.toBeInTheDocument();
  });
});
