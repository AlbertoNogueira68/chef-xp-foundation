import { toast } from "sonner";

/**
 * Partilhar um link.
 *
 * No telemóvel abre a folha de partilha do sistema; onde essa API não existe,
 * o link fica na área de transferência. Cancelar a partilha não é um erro e
 * não avisa ninguém de nada.
 */
export async function shareLink({
  path,
  title,
  copiedMessage = "Link copiado",
}: {
  path: string;
  title: string;
  copiedMessage?: string;
}): Promise<void> {
  const url = `${window.location.origin}${path}`;

  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success(copiedMessage);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    toast.error("Couldn't share");
  }
}
