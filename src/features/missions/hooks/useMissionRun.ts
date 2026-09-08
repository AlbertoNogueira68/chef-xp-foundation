import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MissionCompletion, MissionRunState, RescueKind } from "@/types/learning";
import { fileToResizedDataUrl } from "@/lib/image";
import { missionService } from "../services/missionService";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import { FEED_ROOT_KEY } from "@/features/feed/hooks/useFeed";

/**
 * Estado do modo cozinha.
 *
 * O passo atual vive no servidor, não aqui: quem está a cozinhar pousa o
 * telemóvel, deixa-o bloquear e volta dez minutos depois — se o passo só
 * existisse em memória, voltava ao princípio.
 */
export function useMissionRun() {
  const queryClient = useQueryClient();

  const [state, setState] = useState<MissionRunState | null>(null);
  const [rescue, setRescue] = useState<{ kind: RescueKind; answer: string } | null>(null);
  const [completion, setCompletion] = useState<MissionCompletion | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const runId = state?.run.id ?? null;
  const stepIndex = state?.run.currentStep ?? 0;
  const step = state?.mission.steps[stepIndex] ?? null;
  const isLastStep = state ? stepIndex === state.mission.steps.length - 1 : false;
  const abandoning = useRef(false);

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback);

  const open = useCallback(async (missionId: string) => {
    setIsBusy(true);
    try {
      const next = await missionService.start(missionId);
      setState(next);
      setCompletion(null);
      setRescue(null);
      if (next.resumed) toast.info("Retomámos onde ficaste.");
    } catch (error) {
      fail(error, "Não foi possível arrancar a missão");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const close = useCallback(() => {
    setState(null);
    setCompletion(null);
    setRescue(null);
  }, []);

  const goToStep = useCallback(
    async (next: number) => {
      if (!runId || isBusy) return;
      setIsBusy(true);
      setRescue(null);
      try {
        setState(await missionService.moveToStep(runId, next));
      } catch (error) {
        fail(error, "Não foi possível mudar de passo");
      } finally {
        setIsBusy(false);
      }
    },
    [runId, isBusy],
  );

  const askRescue = useCallback(
    async (kind: RescueKind) => {
      if (!runId) return;
      try {
        const result = await missionService.rescue(runId, stepIndex, kind);
        setRescue({ kind, answer: result.answer });
      } catch (error) {
        fail(error, "Não foi possível pedir ajuda");
      }
    },
    [runId, stepIndex],
  );

  /** A foto pode vir da câmara (já redimensionada) ou de um ficheiro. */
  const uploadDataUrl = useCallback(
    async (dataUrl: string) => {
      if (!runId) return;
      setIsUploading(true);
      try {
        const { checkpoint } = await missionService.checkpoint(runId, stepIndex, dataUrl);
        setState((current) =>
          current
            ? {
                ...current,
                checkpoints: [
                  ...current.checkpoints.filter((c) => c.stepIndex !== checkpoint.stepIndex),
                  { ...checkpoint, feedback: null },
                ],
              }
            : current,
        );
        toast.success("Foto guardada.");
      } catch (error) {
        fail(error, "Não foi possível guardar a foto");
      } finally {
        setIsUploading(false);
      }
    },
    [runId, stepIndex],
  );

  const uploadCheckpoint = useCallback(
    async (file: File) => {
      try {
        await uploadDataUrl(await fileToResizedDataUrl(file));
      } catch (error) {
        fail(error, "Não foi possível ler a imagem");
      }
    },
    [uploadDataUrl],
  );

  const finish = useCallback(
    async (share: boolean, caption?: string) => {
      if (!runId || isBusy) return;
      setIsBusy(true);
      try {
        const result = await missionService.complete(runId, share, caption);
        setCompletion(result);
        // O XP, o nível e as competências praticadas mudaram.
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
        queryClient.invalidateQueries({ queryKey: ["learningPath"] });
        queryClient.invalidateQueries({ queryKey: ["userStats"] });
        queryClient.invalidateQueries({ queryKey: ["missionPosts"] });
        // Partilhar põe o cozinhado no feed de toda a gente — inclusive no dele.
        if (share) queryClient.invalidateQueries({ queryKey: [FEED_ROOT_KEY] });
      } catch (error) {
        fail(error, "Não foi possível concluir a missão");
      } finally {
        setIsBusy(false);
      }
    },
    [runId, isBusy, queryClient],
  );

  const abandon = useCallback(async () => {
    if (!runId || abandoning.current) return;
    abandoning.current = true;
    try {
      await missionService.abandon(runId);
    } catch {
      // Desistir nunca deve dar erro ao utilizador: já está de saída.
    } finally {
      abandoning.current = false;
      close();
    }
  }, [runId, close]);

  const checkpointDone = state?.checkpoints.some((c) => c.stepIndex === stepIndex) ?? false;

  return {
    state,
    step,
    stepIndex,
    isLastStep,
    rescue,
    completion,
    isBusy,
    isUploading,
    checkpointDone,
    isOpen: state !== null,
    open,
    close,
    goToStep,
    askRescue,
    dismissRescue: () => setRescue(null),
    uploadCheckpoint,
    uploadDataUrl,
    finish,
    abandon,
  };
}
