import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * O selo de uma receita que nasceu num desafio.
 *
 * Uma receita de desafio é publicada como todas as outras — está no feed, na
 * pesquisa, no perfil de quem a fez — e sem o selo não haveria nada a dizer
 * porque é que ela existe. Vai a todo o lado onde uma receita aparece, e não
 * só dentro do desafio, que é o sítio onde seria redundante.
 *
 * `compact` é a versão para cima da fotografia, nos cartões pequenos.
 */
export function ChallengeBadge({
  challenge,
  compact = false,
  className,
}: {
  challenge: { id: string; title: string };
  compact?: boolean;
  className?: string;
}) {
  const conteudo = (
    <>
      <Trophy className={compact ? "size-3 shrink-0" : "size-3.5 shrink-0"} />
      <span className="truncate">{challenge.title}</span>
    </>
  );

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full bg-black/55 px-2 py-1",
          "text-[10px] font-bold text-amber-200 backdrop-blur-sm",
          className,
        )}
      >
        {conteudo}
      </span>
    );
  }

  return (
    <Link
      to="/challenges"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-500/40",
        "bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700",
        "transition-colors hover:bg-amber-500/20 dark:text-amber-400",
        className,
      )}
    >
      {conteudo}
    </Link>
  );
}
