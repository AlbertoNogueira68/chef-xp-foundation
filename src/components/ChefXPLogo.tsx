import { ChefMascot } from "@/components/ChefMascot";
import { cn } from "@/lib/utils";

/**
 * A marca: a cara do chef e o nome ao lado.
 *
 * O mascote é o mesmo desenho do ícone da app — quem instalou o ChefXP no
 * telemóvel reencontra no cabeçalho exatamente a cara em que carregou.
 */
export function ChefXPLogo({
  className,
  showMascot = true,
}: {
  className?: string;
  /** Desligado onde o nome já vai acompanhado de uma imagem maior do chef. */
  showMascot?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {showMascot && <ChefMascot size="xs" />}
      <span
        className={cn(
          "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-xl font-bold tracking-tight text-transparent",
          className,
        )}
      >
        ChefXP
      </span>
    </span>
  );
}
