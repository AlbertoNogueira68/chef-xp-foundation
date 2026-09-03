import { useRef, useState } from "react";
import {
  Camera,
  Images,
  RefreshCw,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  Sparkles,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RescuePanel } from "./RescuePanel";
import { StepTimer } from "./StepTimer";
import { useStepTimers } from "@/features/missions/hooks/useStepTimers";
import { useVoiceControl } from "@/features/missions/hooks/useVoiceControl";
import { useCamera } from "@/features/missions/hooks/useCamera";
import { useWakeLock } from "@/features/missions/hooks/useWakeLock";
import type { useMissionRun } from "@/features/missions/hooks/useMissionRun";
import type { Skill } from "@/types/learning";
import { cn } from "@/lib/utils";

type Run = ReturnType<typeof useMissionRun>;

/**
 * Modo cozinha: um passo por ecrã, tipografia grande e o mínimo de coisas
 * para tocar. Quem está a usar isto tem as mãos ocupadas e o telemóvel
 * pousado à distância de um braço.
 */
export function MissionRunScreen({ run, skills }: { run: Run; skills: Map<string, Skill> }) {
  const timers = useStepTimers();
  const [showIngredients, setShowIngredients] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // O ecrã não se apaga enquanto se cozinha.
  useWakeLock(run.isOpen && !run.completion);

  const voice = useVoiceControl((command) => {
    if (!run.state) return;
    if (command === "next" && !run.isLastStep) run.goToStep(run.stepIndex + 1);
    if (command === "prev" && run.stepIndex > 0) run.goToStep(run.stepIndex - 1);
    if (command === "repeat") speak(run.step?.description ?? "");
  });

  if (!run.state) return null;
  if (run.completion) return <MissionComplete run={run} skills={skills} />;
  if (finishing) return <SharePrompt run={run} onBack={() => setFinishing(false)} />;

  const { mission } = run.state;
  const step = run.step;
  if (!step) return null;

  const total = mission.steps.length;
  const remaining = timers.remainingMs(run.stepIndex);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Barra de topo */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <Button size="icon" variant="ghost" onClick={run.abandon} aria-label="Sair da missão">
          <X className="size-5" />
        </Button>

        <div className="flex flex-1 gap-1">
          {mission.steps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < run.stepIndex
                  ? "bg-emerald-500"
                  : i === run.stepIndex
                    ? "bg-emerald-400"
                    : "bg-muted",
              )}
            />
          ))}
        </div>

        {timers.runningCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Timer className="size-3" />
            {timers.runningCount}
          </span>
        )}

        {voice.supported && (
          <Button
            size="icon"
            variant="ghost"
            onClick={voice.toggle}
            aria-label={voice.listening ? "Desligar comandos de voz" : "Ligar comandos de voz"}
            className={cn(voice.listening && "text-emerald-600")}
          >
            {voice.listening ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600">
          {mission.dishName} · passo {run.stepIndex + 1} de {total}
        </p>
        <h2 className="mt-1 text-2xl font-bold leading-tight">{step.title}</h2>
        <p className="mt-2 text-base leading-relaxed text-foreground/80">{step.description}</p>

        {voice.listening && (
          <p className="mt-2 text-xs text-emerald-700">
            A ouvir: diz «próximo», «anterior» ou «repetir».
          </p>
        )}

        <div className="mt-5 space-y-3">
          {step.durationSec && (
            <StepTimer
              seconds={step.durationSec}
              remainingMs={remaining}
              paused={timers.isPaused(run.stepIndex)}
              onStart={() => timers.start(run.stepIndex, step.durationSec!)}
              onToggle={() => timers.toggle(run.stepIndex)}
              onReset={() => timers.clear(run.stepIndex)}
            />
          )}

          {step.checkpoint && <CheckpointCapture run={run} />}

          <RescuePanel
            kinds={step.rescues.map((r) => r.kind)}
            answer={run.rescue}
            onAsk={run.askRescue}
            onDismiss={run.dismissRescue}
          />

          <div className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setShowIngredients((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold"
            >
              Ingredientes
              <ChevronRight
                className={cn("size-4 transition-transform", showIngredients && "rotate-90")}
              />
            </button>
            {showIngredients && (
              <ul className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
                {mission.ingredients.map((item) => (
                  <li key={item} className="py-0.5">
                    · {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="flex gap-2 border-t border-border p-3">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={run.stepIndex === 0 || run.isBusy}
          onClick={() => run.goToStep(run.stepIndex - 1)}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>

        {run.isLastStep ? (
          <Button
            className="flex-1 rounded-full bg-emerald-500 text-base hover:bg-emerald-600"
            disabled={run.isBusy || !run.checkpointDone}
            onClick={() => setFinishing(true)}
          >
            <Check className="size-4" />
            {run.checkpointDone ? "Terminei" : "Falta a foto"}
          </Button>
        ) : (
          <Button
            className="flex-1 rounded-full bg-emerald-500 text-base hover:bg-emerald-600"
            disabled={run.isBusy}
            onClick={() => run.goToStep(run.stepIndex + 1)}
          >
            Seguinte
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function speak(text: string) {
  if (!("speechSynthesis" in window) || !text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-PT";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** A foto é a única verificação real do que foi cozinhado. */
function CheckpointCapture({ run }: { run: Run }) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useCamera();
  const shot = run.state?.checkpoints.find((c) => c.stepIndex === run.stepIndex);

  const take = async () => {
    const dataUrl = camera.capture();
    if (!dataUrl) return;
    camera.stop();
    await run.uploadDataUrl(dataUrl);
  };

  if (camera.active) {
    return (
      <div className="overflow-hidden rounded-xl border-2 border-emerald-300 bg-black">
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-[4/3] w-full object-cover"
        />
        <div className="flex items-center gap-2 bg-card p-2">
          <Button variant="ghost" className="rounded-full" onClick={camera.stop}>
            Cancelar
          </Button>
          <Button
            className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600"
            onClick={take}
            disabled={run.isUploading}
          >
            <Camera className="size-4" />
            {run.isUploading ? "A guardar…" : "Tirar"}
          </Button>
          <Button size="icon" variant="ghost" onClick={camera.flip} aria-label="Trocar de câmara">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Foto de verificação
      </p>

      {shot ? (
        <div className="mt-2 flex items-center gap-3">
          <img src={shot.imageUrl} alt="" className="size-16 rounded-lg object-cover" />
          <p className="text-xs text-muted-foreground">
            Guardada. Podes tirar outra se esta não ficou boa.
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Sem foto não se conclui a missão — é o que distingue cozinhar de carregar em seguinte.
        </p>
      )}

      {camera.error && <p className="mt-2 text-xs text-rose-600">{camera.error}</p>}

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) run.uploadCheckpoint(file);
          event.target.value = "";
        }}
      />

      <div className="mt-2 flex gap-2">
        {camera.supported && (
          <Button
            className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600"
            disabled={run.isUploading}
            onClick={() => camera.start()}
          >
            <Camera className="size-4" />
            {shot ? "Tirar outra" : "Tirar foto"}
          </Button>
        )}
        <Button
          variant="outline"
          className={cn("rounded-full border-emerald-300", !camera.supported && "flex-1")}
          disabled={run.isUploading}
          onClick={() => input.current?.click()}
        >
          <Images className="size-4" />
          {camera.supported ? "Do dispositivo" : run.isUploading ? "A guardar…" : "Tirar foto"}
        </Button>
      </div>
    </div>
  );
}

/** O fim da missão fala de identidade, não de pontos. */
function MissionComplete({ run, skills }: { run: Run; skills: Map<string, Skill> }) {
  const result = run.completion!;
  const mission = run.state!.mission;
  const practised = (mission.practices ?? [])
    .map((id) => skills.get(id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-emerald-500 text-white">
        <ChefHat className="size-10" />
      </span>

      <div>
        <h2 className="text-2xl font-bold">Cozinhaste.</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Há {mission.cookTimeMin} minutos ainda não sabias fazer {mission.dishName.toLowerCase()}.
        </p>
      </div>

      {result.resultImage && (
        <img src={result.resultImage} alt="" className="h-40 w-full rounded-2xl object-cover" />
      )}

      <div className="flex w-full gap-2">
        <div className="flex-1 rounded-xl bg-emerald-50 py-3">
          <p className="text-xl font-bold text-emerald-700">+{result.xpEarned}</p>
          <p className="text-[10px] uppercase tracking-wide text-emerald-700/70">XP</p>
        </div>
        <div className="flex-1 rounded-xl bg-amber-50 py-3">
          <p className="text-xl font-bold text-amber-700">{result.level}</p>
          <p className="text-[10px] uppercase tracking-wide text-amber-700/70">nível</p>
        </div>
        <div className="flex-1 rounded-xl bg-sky-50 py-3">
          <p className="text-xl font-bold text-sky-700">{practised.length}</p>
          <p className="text-[10px] uppercase tracking-wide text-sky-700/70">praticadas</p>
        </div>
      </div>

      {practised.length > 0 && (
        <div className="w-full rounded-xl border border-border p-3 text-left">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5 text-emerald-500" />
            Deixaram de ser teoria
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{practised.join(" · ")}</p>
        </div>
      )}

      {result.post && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <Trophy className="size-4" />
          Publicado no feed.
        </p>
      )}

      <Button
        className="w-full rounded-full bg-emerald-500 hover:bg-emerald-600"
        onClick={run.close}
      >
        Voltar ao percurso
      </Button>
    </div>
  );
}

/**
 * "Queres mostrar como ficou?" — e é aqui que se decide, antes de concluir.
 *
 * A pergunta não pode vir depois: concluir é uma transação única e irrepetível
 * (o XP é idempotente pelo id da run), por isso publicar mais tarde exigiria
 * uma segunda rota. O único caminho para o feed continua a ser ter cozinhado.
 */
function SharePrompt({ run, onBack }: { run: Run; onBack: () => void }) {
  const [caption, setCaption] = useState("");
  const shot = run.state?.checkpoints.at(-1);

  return (
    <div className="flex h-full flex-col justify-center gap-4 px-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Queres mostrar como ficou?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No feed só aparece quem cozinhou. Podes guardar só para ti.
        </p>
      </div>

      {shot && <img src={shot.imageUrl} alt="" className="h-44 w-full rounded-2xl object-cover" />}

      <input
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        placeholder="Diz alguma coisa sobre o resultado…"
        maxLength={280}
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-emerald-300"
      />

      <div className="space-y-2">
        <Button
          className="w-full rounded-full bg-emerald-500 hover:bg-emerald-600"
          disabled={run.isBusy}
          onClick={() => run.finish(true, caption)}
        >
          Publicar e terminar
        </Button>
        <Button
          variant="outline"
          className="w-full rounded-full"
          disabled={run.isBusy}
          onClick={() => run.finish(false)}
        >
          Terminar sem publicar
        </Button>
        <Button variant="ghost" className="w-full rounded-full" onClick={onBack}>
          Voltar ao último passo
        </Button>
      </div>
    </div>
  );
}
