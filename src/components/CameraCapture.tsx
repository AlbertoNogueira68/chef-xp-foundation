import { Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useCamera } from "@/features/missions/hooks/useCamera";
import { cn } from "@/lib/utils";

/**
 * A câmara a correr dentro da app: o que se vê, e os três botões por baixo.
 *
 * O `useCamera` fica com quem chama — é ele que decide quando abrir e o que
 * fazer com a fotografia. Aqui só está o ecrã, porque é a parte que a missão e
 * a publicação de receitas têm exatamente igual, e ter duas cópias de um
 * `<video>` com `autoPlay playsInline muted` é ter duas maneiras de partir o
 * mesmo detalhe (sem `playsInline`, o iOS abre a câmara em ecrã inteiro).
 */
export function CameraCapture({
  camera,
  onCapture,
  busy = false,
  captureLabel = "Tirar",
  busyLabel = "A guardar…",
  className,
  buttonClassName,
}: {
  camera: ReturnType<typeof useCamera>;
  /** Recebe o fotograma já reduzido, como data URL. */
  onCapture: (dataUrl: string) => void | Promise<void>;
  busy?: boolean;
  captureLabel?: string;
  busyLabel?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const tirar = async () => {
    const dataUrl = camera.capture();
    if (!dataUrl) return;
    camera.stop();
    await onCapture(dataUrl);
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border-2 bg-black", className)}>
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
          className={cn("flex-1 rounded-full", buttonClassName)}
          onClick={tirar}
          disabled={busy}
        >
          <Camera className="size-4" />
          {busy ? busyLabel : captureLabel}
        </Button>
        <Button size="icon" variant="ghost" onClick={camera.flip} aria-label="Trocar de câmara">
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
