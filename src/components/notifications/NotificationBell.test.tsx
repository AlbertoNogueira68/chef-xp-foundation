import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { renderWithProviders } from "@/test/utils";
import type { AppNotification } from "@/types/notification";

const estado = vi.hoisted(() => ({
  unread: 0,
  notifications: [] as AppNotification[],
  marcar: vi.fn(),
}));

vi.mock("@/features/notifications/hooks/useNotifications", () => ({
  useUnreadCount: () => ({ data: estado.unread }),
  useNotifications: (enabled: boolean) => ({
    data: enabled ? { notifications: estado.notifications, unread: estado.unread } : undefined,
    isLoading: false,
  }),
  useMarkAllRead: () => ({ mutate: estado.marcar }),
}));

function notificacao(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "1",
    kind: "like",
    read: false,
    createdAt: new Date().toISOString(),
    actor: { id: "a1", username: "mariacozinha", photoUrl: null, level: 5 },
    recipe: { id: "r1", title: "Risotto", imageUrl: null },
    commentBody: null,
    ...overrides,
  };
}

describe("sino das notificações", () => {
  beforeEach(() => {
    estado.unread = 0;
    estado.notifications = [];
    estado.marcar.mockClear();
  });

  test("sem nada por ler, não há ponto vermelho", () => {
    renderWithProviders(<NotificationBell />);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  test("a contagem aparece no sino e no rótulo, para quem não vê o ponto", () => {
    estado.unread = 3;
    renderWithProviders(<NotificationBell />);

    expect(screen.getByRole("button", { name: "Notifications (3 unread)" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("acima de nove, a contagem não estica o sino", () => {
    estado.unread = 42;
    renderWithProviders(<NotificationBell />);

    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  test("abrir a caixa marca tudo como lido", async () => {
    estado.unread = 2;
    const utilizador = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    await utilizador.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(estado.marcar).toHaveBeenCalledTimes(1);
  });

  test("abrir sem nada por ler não escreve na base de dados", async () => {
    estado.unread = 0;
    const utilizador = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    await utilizador.click(screen.getByRole("button", { name: "Notifications" }));

    expect(estado.marcar).not.toHaveBeenCalled();
  });

  test("a frase é montada a partir de quem fez e do quê", async () => {
    estado.unread = 3;
    estado.notifications = [
      notificacao({ id: "1", kind: "like" }),
      notificacao({ id: "2", kind: "comment", commentBody: "que bom" }),
      notificacao({ id: "3", kind: "follow", recipe: null }),
    ];
    const utilizador = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    await utilizador.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(await screen.findByText("mariacozinha liked Risotto")).toBeInTheDocument();
    expect(screen.getByText("mariacozinha commented on Risotto")).toBeInTheDocument();
    expect(screen.getByText("mariacozinha started following you")).toBeInTheDocument();
    expect(screen.getByText(/que bom/)).toBeInTheDocument();
  });

  test("um gosto leva à receita; um seguidor novo, ao perfil dele", async () => {
    estado.unread = 2;
    estado.notifications = [
      notificacao({ id: "1", kind: "like" }),
      notificacao({ id: "2", kind: "follow", recipe: null }),
    ];
    const utilizador = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    await utilizador.click(screen.getByRole("button", { name: /Notifications/ }));
    await screen.findByText(/liked/);

    const ligacoes = screen.getAllByRole("link");
    expect(ligacoes[0]).toHaveAttribute("href", "/recipe/r1");
    expect(ligacoes[1]).toHaveAttribute("href", "/chef/a1");
  });

  test("a caixa vazia explica o que vai aparecer lá", async () => {
    const utilizador = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    await utilizador.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText(/Nothing here yet/i)).toBeInTheDocument();
  });
});
