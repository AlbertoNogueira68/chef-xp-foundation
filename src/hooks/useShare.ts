import { useCallback } from "react";
import { toast } from "sonner";

/**
 * Partilhar, pelos dois caminhos que existem mesmo.
 *
 * No telemóvel o `navigator.share` abre o menu do sistema, que é o que a
 * pessoa espera. No computador esse menu não existe na maior parte dos
 * browsers, e aí copia-se o link e diz-se que foi copiado — calar-se deixava
 * a pessoa a pensar que o botão está avariado.
 *
 * As duas APIs exigem contexto seguro: funcionam em localhost e em HTTPS, mas
 * não num telemóvel a aceder por IP da rede local em http. Daí o terceiro
 * caminho, que é mostrar o link para ser copiado à mão.
 */
export function useShare() {
  return useCallback(async (data: { title: string; text?: string; url: string }) => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        // Fechar o menu do sistema dá `AbortError` e não é uma falha: quem
        // desistiu de partilhar não quer um aviso por causa disso.
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(data.url);
      toast.success("Link copiado.");
    } catch {
      toast.info(data.url, { description: "Copia o link à mão.", duration: 10_000 });
    }
  }, []);
}
