import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "@/components/profile/SettingsDialog";
import { makeUser, renderWithProviders } from "@/test/utils";

const update = vi.hoisted(() => vi.fn());
vi.mock("@/features/profile/hooks/useUpdateProfile", () => ({
  useUpdateProfile: () => ({ mutate: update, isPending: false }),
}));

vi.mock("@/features/profile/hooks/useAccount", () => ({
  useExportData: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAccount: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * O PATCH tem de levar só o que mudou.
 *
 * Enviar tudo faria o servidor voltar a gravar a fotografia a cada correção de
 * uma vírgula no nome — e a fotografia passa por `resolveImageInput`, que a
 * escreve em disco outra vez.
 */
describe("definições do perfil", () => {
  beforeEach(() => update.mockClear());

  const abrir = (user = makeUser()) =>
    renderWithProviders(<SettingsDialog user={user} open onOpenChange={() => {}} />);

  test("guardar sem mexer em nada não envia pedido nenhum", async () => {
    const utilizador = userEvent.setup();
    abrir();

    await utilizador.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(update).not.toHaveBeenCalled();
  });

  test("mudar só o nome envia só o nome", async () => {
    const utilizador = userEvent.setup();
    abrir(makeUser({ username: "chefdemo", dailyXpGoal: 50 }));

    const campo = screen.getByLabelText(/nome de utilizador/i);
    await utilizador.clear(campo);
    await utilizador.type(campo, "outronome");
    await utilizador.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toEqual({ username: "outronome" });
  });

  test("o nome é normalizado para minúsculas enquanto se escreve", async () => {
    const utilizador = userEvent.setup();
    abrir();

    const campo = screen.getByLabelText(/nome de utilizador/i);
    await utilizador.clear(campo);
    await utilizador.type(campo, "ChefDemo2");

    expect(campo).toHaveValue("chefdemo2");
  });

  test("mostra o fuso e a meta guardados, não valores por omissão", () => {
    abrir(makeUser({ timeZone: "Atlantic/Azores", dailyXpGoal: 100 }));

    expect(screen.getByLabelText(/fuso horário/i)).toHaveTextContent("Atlantic/Azores");
    expect(screen.getByLabelText(/meta diária/i)).toHaveTextContent("100 XP");
  });

  test("avisa que o fuso decide o streak", () => {
    abrir();
    expect(screen.getByText(/é o dia que decide o streak/i)).toBeInTheDocument();
  });
});
