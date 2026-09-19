import { Languages } from "lucide-react";
import { LANGUAGES, setLanguage, t, useLanguage, type Language } from "@/i18n";
import { cn } from "@/lib/utils";

const NOMES: Record<Language, string> = { en: "EN", pt: "PT" };

/**
 * O botão que troca a língua da app.
 *
 * Duas línguas, um botão: carregar troca para a outra. Um menu para escolher
 * entre duas opções é um clique a mais, e o rótulo mostra sempre a língua em
 * que se está — não aquela para onde se vai, que era a maneira de confundir
 * toda a gente.
 *
 * `flutuante` é para os ecrãs que não têm cabeçalho (a landing e os de conta):
 * o botão fixa-se ao canto superior direito para estar sempre no mesmo sítio.
 */
export function LanguageToggle({
  flutuante = false,
  className,
}: {
  flutuante?: boolean;
  className?: string;
}) {
  const lingua = useLanguage();
  const outra = LANGUAGES.find((l) => l !== lingua) ?? "en";

  return (
    <button
      type="button"
      onClick={() => setLanguage(outra)}
      // O rótulo diz o nome da língua por extenso e na língua de destino:
      // quem não percebe a atual tem de perceber o botão.
      aria-label={`${t("Language")}: ${NOMES[lingua]} — ${outra === "pt" ? "mudar para português" : "switch to English"}`}
      title={outra === "pt" ? "Mudar para português" : "Switch to English"}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-sm transition-colors hover:border-amber-300 hover:text-amber-600",
        flutuante && "fixed right-3 top-3 z-50 shadow-sm",
        className,
      )}
    >
      <Languages className="size-3.5" aria-hidden />
      {NOMES[lingua]}
    </button>
  );
}
