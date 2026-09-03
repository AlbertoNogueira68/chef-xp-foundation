import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function format(ms: number) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function StepTimer({
  seconds,
  remainingMs,
  paused,
  onStart,
  onToggle,
  onReset,
}: {
  seconds: number;
  remainingMs: number | null;
  paused: boolean;
  onStart: () => void;
  onToggle: () => void;
  onReset: () => void;
}) {
  const done = remainingMs !== null && remainingMs <= 0;

  if (remainingMs === null) {
    return (
      <Button
        variant="outline"
        className="w-full rounded-xl border-2 py-6 text-base font-semibold"
        onClick={onStart}
      >
        <Timer className="size-5" />
        Contar {format(seconds * 1000)}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 px-4 py-3",
        done ? "animate-pulse border-emerald-500 bg-emerald-50" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "text-3xl font-bold tabular-nums",
          done ? "text-emerald-700" : "text-foreground",
        )}
      >
        {format(remainingMs)}
      </span>
      <span className="text-xs text-muted-foreground">
        {done ? "Está na hora" : paused ? "em pausa" : "a contar"}
      </span>

      <div className="ml-auto flex gap-1">
        {!done && (
          <Button size="icon" variant="ghost" onClick={onToggle} aria-label="Pausar">
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onReset} aria-label="Reiniciar">
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
