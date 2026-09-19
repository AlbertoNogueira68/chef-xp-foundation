import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeaderboardTab } from "@/components/learning/LeaderboardTab";
import { renderWithProviders } from "@/test/utils";
import type { Leaderboard, LeaderboardEntry } from "@/types/leaderboard";

const estado = vi.hoisted(() => ({ dados: null as Leaderboard | null, scopes: [] as string[] }));

vi.mock("@/features/leaderboard/hooks/useLeaderboard", () => ({
  useLeaderboard: (scope: string) => {
    estado.scopes.push(scope);
    return { data: estado.dados, isLoading: false };
  },
}));

function linha(rank: number, username: string, score: number, isMe = false): LeaderboardEntry {
  return { rank, score, isMe, user: { id: username, username, photoUrl: null, level: 2 } };
}

describe("ranking", () => {
  beforeEach(() => {
    estado.dados = null;
    estado.scopes = [];
  });

  test("abre na semana, que é o ranking que ainda se pode mudar", () => {
    estado.dados = { scope: "weekly", entries: [], me: null };
    renderWithProviders(<LeaderboardTab />);

    expect(estado.scopes[0]).toBe("weekly");
  });

  test("mostra posições, e a minha destacada", () => {
    estado.dados = {
      scope: "global",
      entries: [linha(1, "maria", 760), linha(2, "chefdemo", 520, true)],
      me: linha(2, "chefdemo", 520, true),
    };
    renderWithProviders(<LeaderboardTab />);

    expect(screen.getByText("maria")).toBeInTheDocument();
    expect(screen.getByText("chefdemo")).toBeInTheDocument();
    // A palavra que marca quem está a ver.
    expect(screen.getByText("you")).toBeInTheDocument();
  });

  test("quem fica fora do top vê a sua linha à parte", () => {
    estado.dados = {
      scope: "global",
      entries: [linha(1, "maria", 760), linha(2, "joao", 520)],
      me: linha(84, "souschef", 30, true),
    };
    renderWithProviders(<LeaderboardTab />);

    expect(screen.getByText("souschef")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
  });

  test("quem está no top não aparece duas vezes", () => {
    const eu = linha(1, "chefdemo", 900, true);
    estado.dados = { scope: "global", entries: [eu], me: eu };
    renderWithProviders(<LeaderboardTab />);

    expect(screen.getAllByText("chefdemo")).toHaveLength(1);
  });

  test("quem não pontuou esta semana percebe porquê", () => {
    estado.dados = { scope: "weekly", entries: [linha(1, "maria", 200)], me: null };
    renderWithProviders(<LeaderboardTab />);

    expect(screen.getByText(/No XP yet this week/i)).toBeInTheDocument();
  });

  test("uma semana sem ninguém convida em vez de mostrar um vazio", () => {
    estado.dados = { scope: "weekly", entries: [], me: null };
    renderWithProviders(<LeaderboardTab />);

    expect(screen.getByText(/go first/i)).toBeInTheDocument();
  });

  test("trocar para «Sempre» pede o outro ranking", async () => {
    estado.dados = { scope: "weekly", entries: [], me: null };
    const utilizador = userEvent.setup();
    renderWithProviders(<LeaderboardTab />);

    await utilizador.click(screen.getByRole("button", { name: "All time" }));

    expect(estado.scopes).toContain("global");
  });

  test("a minha linha leva ao meu perfil, não ao de um chef qualquer", () => {
    estado.dados = {
      scope: "global",
      entries: [linha(1, "chefdemo", 900, true), linha(2, "maria", 500)],
      me: linha(1, "chefdemo", 900, true),
    };
    renderWithProviders(<LeaderboardTab />);

    const ligacoes = screen.getAllByRole("link");
    expect(ligacoes[0]).toHaveAttribute("href", "/profile");
    expect(ligacoes[1]).toHaveAttribute("href", "/chef/maria");
  });
});
