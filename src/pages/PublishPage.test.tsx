import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishPage } from "@/pages/PublishPage";
import { renderWithProviders } from "@/test/utils";

const camera = vi.hoisted(() => ({
  videoRef: { current: null },
  supported: true,
  active: false,
  error: null as string | null,
  facing: "environment" as const,
  start: vi.fn(),
  stop: vi.fn(),
  flip: vi.fn(),
  capture: vi.fn(() => "data:image/jpeg;base64,foto"),
}));

// Parar a câmara desliga o `active` de verdade, senão o ecrã da câmara ficava
// por cima da pré-visualização e o teste da foto tirada não provava nada.
camera.stop.mockImplementation(() => {
  camera.active = false;
});

vi.mock("@/features/missions/hooks/useCamera", () => ({ useCamera: () => camera }));

describe("publicar receita: a fotografia", () => {
  beforeEach(() => {
    camera.supported = true;
    camera.active = false;
    camera.error = null;
    camera.start.mockClear();
    camera.stop.mockClear();
    camera.capture.mockClear();
  });

  test("dá as duas opções: tirar agora ou ir à galeria", () => {
    renderWithProviders(<PublishPage />);

    expect(screen.getByRole("button", { name: /take photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /from gallery/i })).toBeInTheDocument();
  });

  test("tirar foto abre a câmara da app", async () => {
    renderWithProviders(<PublishPage />);

    await userEvent.click(screen.getByRole("button", { name: /take photo/i }));

    expect(camera.start).toHaveBeenCalled();
  });

  test("sem câmara na app, resta o input que abre a do sistema", async () => {
    // Num telemóvel em http o `getUserMedia` não existe. O `capture` do input
    // continua a abrir a câmara — e é por isso que ele lá está.
    camera.supported = false;
    const { container } = renderWithProviders(<PublishPage />);

    await userEvent.click(screen.getByRole("button", { name: /take photo/i }));

    expect(camera.start).not.toHaveBeenCalled();
    expect(container.querySelector('input[capture="environment"]')).toBeInTheDocument();
  });

  test("a foto tirada fica como pré-visualização da receita", async () => {
    camera.active = true;
    renderWithProviders(<PublishPage />);

    await userEvent.click(screen.getByRole("button", { name: /take photo/i }));

    expect(camera.capture).toHaveBeenCalled();
    // A câmara fecha-se sozinha: deixá-la a correr por trás da pré-visualização
    // seria ter a luz do telemóvel acesa sem ninguém a olhar.
    expect(camera.stop).toHaveBeenCalled();
    expect(await screen.findByAltText("Recipe preview")).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,foto",
    );
  });
});
