import { useCallback, useEffect, useRef, useState } from "react";

type Timer = { endsAt: number; paused: boolean; remaining: number };

/**
 * Vários temporizadores ao mesmo tempo, um por passo.
 *
 * O ponto é este: o arroz continua a cozer enquanto lês o passo seguinte. Um
 * temporizador que morresse ao mudar de ecrã não servia para nada numa
 * cozinha — e é por isso que o estado vive aqui em cima, e não dentro do
 * componente de cada passo.
 *
 * Guarda-se o instante em que acaba, não os segundos que faltam: assim o
 * relógio continua certo mesmo que o browser suspenda o intervalo com o
 * separador em segundo plano.
 */
export function useStepTimers() {
  const [timers, setTimers] = useState<Record<number, Timer>>({});
  const [, forceTick] = useState(0);
  const hasRunning = useRef(false);

  hasRunning.current = Object.values(timers).some((t) => !t.paused);

  useEffect(() => {
    if (!hasRunning.current) return;
    const id = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [timers]);

  const start = useCallback((step: number, seconds: number) => {
    setTimers((current) => ({
      ...current,
      [step]: { endsAt: Date.now() + seconds * 1000, paused: false, remaining: seconds * 1000 },
    }));
  }, []);

  const toggle = useCallback((step: number) => {
    setTimers((current) => {
      const timer = current[step];
      if (!timer) return current;
      return {
        ...current,
        [step]: timer.paused
          ? { ...timer, paused: false, endsAt: Date.now() + timer.remaining }
          : { ...timer, paused: true, remaining: Math.max(0, timer.endsAt - Date.now()) },
      };
    });
  }, []);

  const clear = useCallback((step: number) => {
    setTimers((current) => {
      const next = { ...current };
      delete next[step];
      return next;
    });
  }, []);

  const remainingMs = (step: number) => {
    const timer = timers[step];
    if (!timer) return null;
    return timer.paused ? timer.remaining : Math.max(0, timer.endsAt - Date.now());
  };

  return {
    timers,
    start,
    toggle,
    clear,
    remainingMs,
    isPaused: (step: number) => timers[step]?.paused ?? false,
    runningCount: Object.values(timers).filter((t) => !t.paused && t.endsAt > Date.now()).length,
  };
}
