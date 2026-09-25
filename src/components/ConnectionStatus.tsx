import { useEffect } from "react";
import { CloudOff, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useConnection } from "@/hooks/useConnection";
import { useOutboxCount } from "@/hooks/useOutbox";
import { NEW_VERSION_EVENT, applyUpdate } from "@/lib/pwa/register";
import { SYNC_EVENT, flushOutbox, type ResumoDaSincronizacao } from "@/lib/offline/sync";
import { avisoDoEnvio, avisoDoResumo, type Aviso } from "@/lib/offline/mensagens";
import { refreshOutboxCount } from "@/lib/offline/outbox";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import { t } from "@/i18n";

/**
 * A barra de "sem ligação" e o aviso de versão nova.
 *
 * A barra fica fixa no topo e empurra nada: é um aviso, não um ecrã de erro.
 * Sem rede, a app continua a mostrar o que já tinha — o que não dá é gravar,
 * e é isso que a frase diz.
 */
export function ConnectionStatus() {
  const ligacao = useConnection();
  const porEnviar = useOutboxCount();
  const queryClient = useQueryClient();

  /**
   * Esvaziar a caixa de saída quando há ligação — ao arrancar e sempre que a
   * ligação volta. O `flushOutbox` protege-se de correr duas vezes ao mesmo
   * tempo, por isso chamar em excesso é inofensivo.
   */
  useEffect(() => {
    if (ligacao !== "ok" || porEnviar === 0) return;
    void flushOutbox();
  }, [ligacao, porEnviar]);

  // A contagem da fila vem do armazenamento, que é assíncrono: no arranque
  // ainda não está lida.
  useEffect(() => {
    void refreshOutboxCount();
  }, []);

  /**
   * O que foi enviado mexeu no XP, no percurso e no perfil — e é esta a única
   * altura em que quem respondeu offline fica a saber se passou a lição.
   */
  useEffect(() => {
    const contar = (evento: Event) => {
      const resumo = (evento as CustomEvent<ResumoDaSincronizacao>).detail;

      if (resumo.enviados.length > 0) {
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
        queryClient.invalidateQueries({ queryKey: ["learningPath"] });
        queryClient.invalidateQueries({ queryKey: ["userStats"] });
      }

      // Até três, cada um tem direito ao seu resultado; a partir daí um
      // resumo, para não encher o ecrã de avisos empilhados.
      const avisos: Aviso[] =
        resumo.enviados.length > 3
          ? [avisoDoResumo(resumo.enviados)]
          : resumo.enviados.map(avisoDoEnvio);

      // Uma recusa do servidor nunca entra no resumo: quem respondeu offline
      // tem de saber que aquilo não ficou registado, e porquê.
      avisos.push(...resumo.recusados.map(avisoDoEnvio));

      for (const aviso of avisos) {
        const opcoes = { duration: aviso.demorado ? 10_000 : 4_000 };
        if (aviso.tom === "sucesso") toast.success(aviso.texto, opcoes);
        else if (aviso.tom === "erro") toast.error(aviso.texto, opcoes);
        else toast(aviso.texto, opcoes);
      }
    };

    window.addEventListener(SYNC_EVENT, contar);
    return () => window.removeEventListener(SYNC_EVENT, contar);
  }, [queryClient]);

  // A versão nova não entra sozinha: quem está a meio de uma missão não quer
  // a app a recarregar-se por baixo dos pés. Pergunta-se, e só se troca com
  // um toque.
  useEffect(() => {
    const avisar = () => {
      toast(t("There's a new version of ChefXP."), {
        duration: Infinity,
        action: { label: t("Update"), onClick: () => applyUpdate() },
      });
    };

    window.addEventListener(NEW_VERSION_EVENT, avisar);
    return () => window.removeEventListener(NEW_VERSION_EVENT, avisar);
  }, []);

  if (ligacao === "ok") {
    // Com ligação e com fila, o aviso passa a ser sobre o envio — dura os
    // segundos que a sincronização demora.
    if (porEnviar === 0) return null;

    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-center text-xs font-medium text-white"
      >
        <UploadCloud className="size-4 shrink-0" aria-hidden />
        <span>
          {porEnviar === 1
            ? t("Sending 1 saved answer…")
            : t("Sending {count} saved answers…", { count: porEnviar })}
        </span>
      </div>
    );
  }

  // Duas situações, duas frases. Mandar verificar a Internet a quem a tem a
  // funcionar é a maneira mais rápida de parecer que a app não sabe o que se
  // passa.
  const base =
    ligacao === "sem-rede"
      ? t("You're offline. Carry on — whatever you do is saved here.")
      : t("The server isn't responding. Carry on — it's saved here.");

  const mensagem =
    porEnviar > 0
      ? `${base} ${
          porEnviar === 1 ? t("1 still to send") : t("{count} still to send", { count: porEnviar })
        }.`
      : base;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-stone-800 px-4 py-2 text-center text-xs font-medium text-stone-50"
    >
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <span>{mensagem}</span>
    </div>
  );
}
