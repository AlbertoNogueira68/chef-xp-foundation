import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewCard } from "@/components/learning/ReviewCard";
import { renderWithProviders } from "@/test/utils";

describe("o cartão de revisão", () => {
  test("não aparece quando não há nada a rever", () => {
    const { container } = renderWithProviders(<ReviewCard due={0} onStart={vi.fn()} />);

    // Um cartão permanente a dizer "0 para rever" é a primeira coisa que se
    // aprende a ignorar — e depois já não funciona quando tem conteúdo.
    expect(container).toBeEmptyDOMElement();
  });

  test("uma pergunta à espera fala no singular", () => {
    renderWithProviders(<ReviewCard due={1} onStart={vi.fn()} />);
    expect(screen.getByText("One question is waiting to come back.")).toBeInTheDocument();
  });

  test("várias perguntas dizem quantas são", () => {
    renderWithProviders(<ReviewCard due={12} onStart={vi.fn()} />);
    expect(screen.getByText(/12 questions are waiting/i)).toBeInTheDocument();
  });

  test("começar a revisão avisa quem tem de a abrir", async () => {
    const onStart = vi.fn();
    renderWithProviders(<ReviewCard due={3} onStart={onStart} />);

    await userEvent.click(screen.getByRole("button", { name: /Start review/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test("é uma secção com título, não um bloco solto", () => {
    renderWithProviders(<ReviewCard due={3} onStart={vi.fn()} />);

    // Quem navega por regiões e cabeçalhos tem de encontrar isto.
    expect(screen.getByRole("region", { name: /Time to review/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Time to review/i })).toBeInTheDocument();
  });
});
