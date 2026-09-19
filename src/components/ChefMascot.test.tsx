import { describe, expect, test } from "vitest";
import { screen } from "@testing-library/react";
import { ChefMascot, ChefSpeech } from "@/components/ChefMascot";
import { chefGreeting, chefPrepLine, chefQuizLine } from "@/lib/chefLines";
import { renderWithProviders } from "@/test/utils";

describe("chef sapo", () => {
  test("é decorativo quando está ao lado do texto que se lê", () => {
    const { container } = renderWithProviders(<ChefMascot />);

    const img = container.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
  });

  test("muda de cara conforme o que aconteceu", () => {
    const { container } = renderWithProviders(
      <>
        <ChefMascot mood="aprovar" />
        <ChefMascot mood="erro" />
        <ChefMascot size="xl" mood="triste" />
        <ChefSpeech mood="celebrar">+25 XP</ChefSpeech>
      </>,
    );

    const srcs = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(srcs).toEqual([
      "/mascot/chef-frog-aprovar-96.png",
      "/mascot/chef-frog-erro-96.png",
      "/mascot/chef-frog-triste.png",
      "/mascot/chef-frog-celebrar-96.png",
    ]);
  });

  test("o balão mostra o que o chef diz", () => {
    renderWithProviders(<ChefSpeech title="That's it!">Salt at the end, always.</ChefSpeech>);

    expect(screen.getByText("That's it!")).toBeInTheDocument();
    expect(screen.getByText("Salt at the end, always.")).toBeInTheDocument();
  });

  test("a mesma lição dá sempre a mesma frase", () => {
    // Com uma frase à sorte, cada re-render do React trocava o que o chef
    // estava a dizer a meio da lição.
    expect(chefGreeting("Arroz de tomate")).toBe(chefGreeting("Arroz de tomate"));
    expect(chefPrepLine("Arroz de tomate", 2)).toBe(chefPrepLine("Arroz de tomate", 2));
    expect(chefQuizLine("Arroz de tomate", 0)).toBe(chefQuizLine("Arroz de tomate", 0));
  });

  test("a saudação trata o prato pelo nome", () => {
    expect(chefGreeting("Bacalhau à Brás")).toContain("Bacalhau à Brás");
  });
});
