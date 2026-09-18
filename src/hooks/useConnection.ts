import { useEffect, useState } from "react";
import { CONNECTION_EVENT } from "@/services/api";
import { useOnlineStatus } from "./useOnlineStatus";

export type Ligacao = "ok" | "sem-rede" | "sem-servidor";

/**
 * O estado da ligação, das duas fontes que existem.
 *
 * `navigator.onLine` sabe quando o dispositivo perde a rede, e sabe-o logo.
 * Mas responde "tenho ligação a alguma coisa", não "chego ao servidor" — com
 * o servidor em baixo e o wifi de pé, diz que está tudo bem. Quem sabe isso é
 * o pedido que falhou, e é por isso que a segunda fonte é a própria API.
 */
export function useConnection(): Ligacao {
  const online = useOnlineStatus();
  const [servidorOk, setServidorOk] = useState(true);

  useEffect(() => {
    const ouvir = (evento: Event) => {
      const { alcancavel } = (evento as CustomEvent<{ alcancavel: boolean }>).detail;
      setServidorOk(alcancavel);
    };

    window.addEventListener(CONNECTION_EVENT, ouvir);
    return () => window.removeEventListener(CONNECTION_EVENT, ouvir);
  }, []);

  // Quando a rede volta, o servidor volta a ter o benefício da dúvida: o
  // próximo pedido é que decide, e sem isto o aviso ficava colado no ecrã.
  useEffect(() => {
    if (online) setServidorOk(true);
  }, [online]);

  if (!online) return "sem-rede";
  return servidorOk ? "ok" : "sem-servidor";
}
