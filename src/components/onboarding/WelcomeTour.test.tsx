import { beforeEach, describe, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { abrirTutorial } from "@/features/onboarding/tourStore";
import { makeUser, renderWithProviders } from "@/test/utils";

const navegar = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const real = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...real, useNavigate: () => navegar };
});

const utilizador = makeUser();

vi.mock("@/features/profile/hooks/useCurrentUser", () => ({
  currentUserQueryKey: ["currentUser"],
  useCurrentUser: () => ({ data: utilizador }),
}));

/**
 * A visita guiada aparece uma vez — e essa "uma vez" é por pessoa e fica no
 * `localStorage`. Todos os testes começam com o armazenamento limpo, senão o
 * primeiro que fechasse o tutorial calava todos os seguintes.
 */
beforeEach(() => {
  localStorage.clear();
  navegar.mockClear();
});

const abrir = () => renderWithProviders(<WelcomeTour />);

describe("apresentação de quem entra pela primeira vez", () => {
  test("abre sozinha e começa por dizer o que é a app", async () => {
    abrir();

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toHaveTextContent(/welcome, chef chefdemo/i);
  });

  test("percorre os passos até à primeira lição", async () => {
    const pessoa = userEvent.setup();
    abrir();

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    for (let i = 0; i < 4; i += 1) {
      await pessoa.click(screen.getByRole("button", { name: /^next$/i }));
    }

    // O último passo não diz "seguinte": leva mesmo a pessoa ao trilho, que é
    // o sítio onde a app começa.
    await pessoa.click(screen.getByRole("button", { name: /start the first lesson/i }));
    expect(navegar).toHaveBeenCalledWith("/challenges");
  });

  test("voltar atrás mostra o passo anterior", async () => {
    const pessoa = userEvent.setup();
    abrir();

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await pessoa.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/learn one skill at a time/i);

    await pessoa.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/welcome, chef chefdemo/i);
  });

  test("quem a salta não volta a vê-la na visita seguinte", async () => {
    const pessoa = userEvent.setup();
    const primeira = abrir();

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await pessoa.click(screen.getByRole("button", { name: /^skip$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    primeira.unmount();
    abrir();

    // Um instante para o efeito de arranque correr: o que não acontece é o
    // diálogo voltar a aparecer.
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("o botão das definições volta a abri-la", async () => {
    const pessoa = userEvent.setup();
    abrir();

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await pessoa.click(screen.getByRole("button", { name: /^skip$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    abrirTutorial();

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toHaveTextContent(/welcome, chef chefdemo/i);
  });
});
