import { describe, expect, test, vi, beforeEach } from "vitest";
import { shareLink } from "@/lib/share";

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

describe("partilhar um link", () => {
  beforeEach(() => {
    toasts.success.mockClear();
    toasts.error.mockClear();
    Object.defineProperty(window, "location", {
      value: { origin: "https://chef-xp.test" },
      writable: true,
    });
  });

  test("usa a folha de partilha do sistema quando existe", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });

    await shareLink({ path: "/recipe/abc", title: "Arroz de tomate" });

    expect(share).toHaveBeenCalledWith({
      title: "Arroz de tomate",
      url: "https://chef-xp.test/recipe/abc",
    });
    // Sem aviso: a folha do sistema já mostrou o que aconteceu.
    expect(toasts.success).not.toHaveBeenCalled();
  });

  test("sem essa API, copia o link e avisa", async () => {
    Object.assign(navigator, { share: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await shareLink({ path: "/chef/1", title: "chefdemo", copiedMessage: "Link copiado" });

    expect(writeText).toHaveBeenCalledWith("https://chef-xp.test/chef/1");
    expect(toasts.success).toHaveBeenCalledWith("Link copiado");
  });

  test("cancelar a partilha não é um erro", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError"));
    Object.assign(navigator, { share });

    await shareLink({ path: "/recipe/abc", title: "Arroz" });

    expect(toasts.error).not.toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  test("uma falha a sério avisa", async () => {
    const share = vi.fn().mockRejectedValue(new Error("sem permissão"));
    Object.assign(navigator, { share });

    await shareLink({ path: "/recipe/abc", title: "Arroz" });

    expect(toasts.error).toHaveBeenCalled();
  });
});
