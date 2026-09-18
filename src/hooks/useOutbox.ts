import { useSyncExternalStore } from "react";
import { outboxCount, subscribeOutbox } from "@/lib/offline/outbox";

/** Quantos pedidos estão à espera de rede. */
export function useOutboxCount() {
  return useSyncExternalStore(
    (callback) => subscribeOutbox(callback),
    () => outboxCount(),
    () => 0,
  );
}
