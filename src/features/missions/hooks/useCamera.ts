import { useCallback, useEffect, useRef, useState } from "react";
import { JPEG_QUALITY, MAX_IMAGE_DIMENSION } from "@/lib/image";

/**
 * Câmara dentro da app, para o checkpoint da missão.
 *
 * O `<input capture>` abre a câmara do telemóvel mas no computador abre o
 * explorador de ficheiros — e a foto de verificação é a única prova de que
 * alguém cozinhou. Sem isto, testar a missão no computador obrigava a ter uma
 * foto já guardada no disco.
 *
 * `getUserMedia` exige contexto seguro: funciona em localhost e em HTTPS, mas
 * não num telemóvel a aceder por IP da rede local em http. Por isso o input de
 * ficheiro continua lá como alternativa, e nunca como erro.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const supported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (typeof window === "undefined" || window.isSecureContext);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(
    async (which: "environment" | "user" = facing) => {
      if (!supported) return;
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: which, width: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;
        setFacing(which);
        setActive(true);
      } catch (cause) {
        // Recusar a câmara é uma escolha legítima, não uma avaria: dizemos o
        // que aconteceu e o input de ficheiro continua disponível.
        setError(
          cause instanceof DOMException && cause.name === "NotAllowedError"
            ? "Sem acesso à câmara. Podes escolher uma foto do dispositivo."
            : "Não foi possível abrir a câmara.",
        );
        setActive(false);
      }
    },
    [supported, facing],
  );

  // O elemento <video> só existe depois de `active` ficar verdadeiro, por isso
  // a ligação ao stream tem de acontecer aqui e não dentro do `start`.
  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [active]);

  useEffect(() => stop, [stop]);

  const flip = useCallback(() => {
    const next = facing === "environment" ? "user" : "environment";
    stop();
    void start(next);
  }, [facing, stop, start]);

  /** Congela o fotograma atual e devolve-o já redimensionado. */
  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }, []);

  return { videoRef, supported, active, error, facing, start, stop, flip, capture };
}
