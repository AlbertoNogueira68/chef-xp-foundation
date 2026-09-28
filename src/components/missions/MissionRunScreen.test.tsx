import { describe, expect, test, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MissionRunScreen } from "@/components/missions/MissionRunScreen";
import { renderWithProviders } from "@/test/utils";
import type { MissionCheckpoint, MissionRunState, MissionStep, Skill } from "@/types/learning";

/**
 * O modo cozinha. É o ecrã que se usa com as mãos sujas e o telemóvel pousado
 * a um braço de distância, e era o segundo componente central sem um teste.
 *
 * O que aqui se protege é sobretudo a regra que dá sentido à missão inteira:
 * **sem fotografia não há missão acabada**. É a única verificação de que
 * alguém cozinhou de facto, em vez de ter carregado em "seguinte" cinco vezes.
 *
 * Os periféricos (temporizadores, voz, câmara, wake lock) são substituídos:
 * nenhum deles existe no jsdom, e o que está em teste é o ecrã, não o browser.
 */

const periféricos = vi.hoisted(() => ({
  timers: {
    runningCount: 0,
    remainingMs: () => 0,
    isPaused: () => false,
    start: vi.fn(),
    toggle: vi.fn(),
    clear: vi.fn(),
  },
  voz: { supported: false, listening: false, toggle: vi.fn() },
  camara: { supported: false, active: false, error: null as string | null, start: vi.fn() },
}));

vi.mock("@/features/missions/hooks/useStepTimers", () => ({
  useStepTimers: () => periféricos.timers,
}));
vi.mock("@/features/missions/hooks/useVoiceControl", () => ({
  useVoiceControl: () => periféricos.voz,
}));
vi.mock("@/features/missions/hooks/useCamera", () => ({
  useCamera: () => periféricos.camara,
}));
vi.mock("@/features/missions/hooks/useWakeLock", () => ({ useWakeLock: vi.fn() }));

function passo(overrides: Partial<MissionStep> = {}): MissionStep {
  return {
    id: "s1",
    index: 0,
    title: "Refogar a cebola",
    description: "Cebola em meias-luas, lume médio, até ficar translúcida.",
    rescues: [],
    ...overrides,
  };
}

function estado(overrides: Partial<MissionRunState> = {}): MissionRunState {
  const steps = overrides.mission?.steps ?? [
    passo(),
    passo({ id: "s2", index: 1, title: "Juntar o arroz", checkpoint: true }),
  ];

  return {
    run: {
      id: 1,
      missionId: "m1",
      status: "in_progress",
      currentStep: 0,
      startedAt: "2026-04-01T18:00:00.000Z",
      completedAt: null,
      resultImage: null,
      shared: false,
    },
    checkpoints: [],
    ...overrides,
    mission: {
      id: "m1",
      unitId: "u1",
      title: "Arroz de tomate",
      dishName: "arroz de tomate",
      cookTimeMin: 30,
      summary: "O arroz que se faz com o que há em casa.",
      practices: [],
      xpReward: 80,
      ingredients: ["arroz", "tomate", "cebola"],
      steps,
      ...overrides.mission,
    },
  };
}

/** Um `run` como o `useMissionRun` o devolve, com o estado que o teste quiser. */
function corrida(overrides: Record<string, unknown> = {}) {
  const st = (overrides.state as MissionRunState | null | undefined) ?? estado();
  const stepIndex = (overrides.stepIndex as number) ?? 0;

  return {
    state: st,
    step: st?.mission.steps[stepIndex] ?? null,
    stepIndex,
    isLastStep: st ? stepIndex === st.mission.steps.length - 1 : false,
    rescue: null,
    completion: null,
    isBusy: false,
    isUploading: false,
    checkpointDone: false,
    isOpen: true,
    open: vi.fn(),
    close: vi.fn(),
    goToStep: vi.fn(),
    askRescue: vi.fn(),
    dismissRescue: vi.fn(),
    uploadCheckpoint: vi.fn(),
    uploadDataUrl: vi.fn(),
    finish: vi.fn(),
    abandon: vi.fn(),
    ...overrides,
  } as unknown as Parameters<typeof MissionRunScreen>[0]["run"];
}

const semCompetencias = new Map<string, Skill>();

describe("modo cozinha", () => {
  beforeEach(() => {
    periféricos.timers.runningCount = 0;
    periféricos.voz.supported = false;
    periféricos.voz.listening = false;
    periféricos.camara.supported = false;
    periféricos.camara.active = false;
    periféricos.camara.error = null;
  });

  test("sem corrida não desenha nada", () => {
    const { container } = renderWithProviders(
      <MissionRunScreen run={corrida({ state: null, step: null })} skills={semCompetencias} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("o passo é o cabeçalho do ecrã, em letra grande", () => {
    renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);

    expect(screen.getByRole("heading", { name: "Refogar a cebola" })).toBeInTheDocument();
    expect(
      screen.getByText("Cebola em meias-luas, lume médio, até ficar translúcida."),
    ).toBeInTheDocument();
  });

  test("diz em que passo se vai, e de quantos", () => {
    renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
  });

  test("no primeiro passo não há para onde voltar", () => {
    renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);
    expect(screen.getByRole("button", { name: /Previous/i })).toBeDisabled();
  });

  test("avançar e recuar passam pelo servidor, que guarda o passo atual", async () => {
    const goToStep = vi.fn();
    renderWithProviders(
      <MissionRunScreen run={corrida({ stepIndex: 0, goToStep })} skills={semCompetencias} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(goToStep).toHaveBeenCalledWith(1);
  });

  test("sair da missão tem nome, não é só um X", () => {
    renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);
    expect(screen.getByRole("button", { name: /Leave the mission/i })).toBeInTheDocument();
  });

  test("os ingredientes estão escondidos até se pedirem — o passo é que manda no ecrã", async () => {
    renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);

    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ingredients/i }));

    const itens = screen.getAllByRole("listitem").map((li) => li.textContent?.trim());
    expect(itens).toEqual(["· arroz", "· tomate", "· cebola"]);
  });

  describe("a fotografia de verificação", () => {
    test("no último passo, sem foto não se acaba a missão", () => {
      renderWithProviders(
        <MissionRunScreen
          run={corrida({ stepIndex: 1, checkpointDone: false })}
          skills={semCompetencias}
        />,
      );

      const acabar = screen.getByRole("button", { name: /Photo missing/i });
      expect(acabar).toBeDisabled();
    });

    test("com foto, o botão muda de texto e deixa acabar", () => {
      renderWithProviders(
        <MissionRunScreen
          run={corrida({ stepIndex: 1, checkpointDone: true })}
          skills={semCompetencias}
        />,
      );

      expect(screen.getByRole("button", { name: /I'm done/i })).toBeEnabled();
      expect(screen.queryByRole("button", { name: /Photo missing/i })).not.toBeInTheDocument();
    });

    test("o passo de verificação explica porque é que a foto é obrigatória", () => {
      renderWithProviders(
        <MissionRunScreen run={corrida({ stepIndex: 1 })} skills={semCompetencias} />,
      );

      expect(screen.getByText(/No photo, no finished mission/i)).toBeInTheDocument();
    });

    test("com uma foto já tirada, oferece tirar outra em vez de esconder o botão", () => {
      periféricos.camara.supported = true;
      const checkpoints: MissionCheckpoint[] = [
        { stepIndex: 1, imageUrl: "/uploads/arroz.webp", feedback: null },
      ];

      renderWithProviders(
        <MissionRunScreen
          run={corrida({ state: estado({ checkpoints }), stepIndex: 1, checkpointDone: true })}
          skills={semCompetencias}
        />,
      );

      expect(screen.getByRole("button", { name: /Take another/i })).toBeInTheDocument();
    });

    test("um erro da câmara aparece no ecrã, não na consola", () => {
      periféricos.camara.supported = true;
      periféricos.camara.error = "Sem permissão para a câmara.";

      renderWithProviders(
        <MissionRunScreen run={corrida({ stepIndex: 1 })} skills={semCompetencias} />,
      );

      expect(screen.getByText("Sem permissão para a câmara.")).toBeInTheDocument();
    });
  });

  describe("a voz", () => {
    test("sem reconhecimento de voz não há botão a prometê-lo", () => {
      renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);
      expect(screen.queryByRole("button", { name: /voice commands/i })).not.toBeInTheDocument();
    });

    test("a ouvir, diz o que se pode dizer", () => {
      periféricos.voz.supported = true;
      periféricos.voz.listening = true;

      renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);

      expect(screen.getByText(/Listening/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Turn voice commands off/i })).toBeInTheDocument();
    });
  });

  test("um temporizador a correr aparece na barra de topo, mesmo noutro passo", () => {
    periféricos.timers.runningCount = 2;
    renderWithProviders(<MissionRunScreen run={corrida()} skills={semCompetencias} />);

    // O número de temporizadores a contar: quem está a cozinhar precisa de o
    // ver sem voltar ao passo onde os ligou.
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("enquanto o servidor não responde, não se avança duas vezes", () => {
    renderWithProviders(
      <MissionRunScreen run={corrida({ isBusy: true })} skills={semCompetencias} />,
    );

    expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();
  });
});
