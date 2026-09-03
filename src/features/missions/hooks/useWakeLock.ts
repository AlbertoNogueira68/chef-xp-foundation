import { useEffect, useRef } from "react";

/**
 * Mantém o ecrã aceso enquanto se cozinha. Um telemóvel que adormece a meio
 * de um passo obriga a limpar as mãos para lhe tocar — que é exatamente o
 * momento em que as mãos estão sujas.
 *
 * Degrada em silêncio: nem todos os browsers têm a API, e nenhum a dá fora de
 * HTTPS. Não há aviso nenhum, porque não há nada que o utilizador possa fazer.
 */
export function useWakeLock(active: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        sentinel.current = lock;
      } catch {
        // Sem wake lock. O ecrã apaga-se como sempre se apagou.
      }
    };

    // O sistema liberta o lock ao mudar de separador; ao voltar, volta a pedir.
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel.current?.release().catch(() => {});
      sentinel.current = null;
    };
  }, [active]);
}
