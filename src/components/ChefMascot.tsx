import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * O Chef Sapo — a cara da app.
 *
 * É o mesmo desenho do ícone, recortado ao círculo (ver
 * `scripts/generate-icons.mjs`). Aparece de propósito nos mesmos sítios em que
 * a app ensina alguma coisa: quem está a aprender a cozinhar ouve melhor
 * alguém a falar do que uma caixa de texto.
 *
 * Duas imagens, não uma: 96 px chegam para os avatares pequenos e pesam um
 * sexto — num telemóvel com rede fraca isso conta, e o chef aparece em todos
 * os ecrãs de lição.
 */

const TAMANHOS = {
  xs: "size-8",
  sm: "size-10",
  md: "size-14",
  lg: "size-20",
  xl: "size-28",
} as const;

export type ChefMascotSize = keyof typeof TAMANHOS;

export function ChefMascot({
  size = "md",
  className,
  alt = "",
}: {
  size?: ChefMascotSize;
  className?: string;
  /** Vazio (por omissão) quando é decorativo: há sempre texto ao lado. */
  alt?: string;
}) {
  const grande = size === "lg" || size === "xl";

  return (
    <img
      src={grande ? "/mascot/chef-frog-avatar.png" : "/mascot/chef-frog-avatar-96.png"}
      width={grande ? 256 : 96}
      height={grande ? 256 : 96}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      draggable={false}
      className={cn("shrink-0 select-none rounded-full object-cover", TAMANHOS[size], className)}
    />
  );
}

const TONS = {
  neutro: "border-amber-200/70 bg-amber-50 text-amber-950",
  certo: "border-emerald-300/70 bg-emerald-50 text-emerald-900",
  errado: "border-rose-300/70 bg-rose-50 text-rose-900",
  calmo: "border-stone-200 bg-stone-100 text-stone-800",
} as const;

export type ChefTone = keyof typeof TONS;

/**
 * O chef a dizer alguma coisa: avatar à esquerda, balão à direita com o bico
 * virado para ele. É o formato de toda a app — quando o chef fala, fala
 * sempre assim, para que se perceba de relance que aquilo é ele e não um
 * aviso do sistema.
 */
export function ChefSpeech({
  children,
  tone = "neutro",
  size = "md",
  title,
  className,
}: {
  children: ReactNode;
  tone?: ChefTone;
  size?: ChefMascotSize;
  /** Uma linha em destaque por cima do resto — o "Correto!", o nome do passo. */
  title?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <ChefMascot size={size} className="mt-1" />

      <div className="relative min-w-0 flex-1">
        {/* O bico do balão: um quadrado rodado, com a mesma borda e o mesmo
            fundo, tapado à direita pelo próprio balão. */}
        <span
          aria-hidden
          className={cn(
            "absolute left-[-5px] top-4 size-2.5 rotate-45 border-b-0 border-r-0 border",
            TONS[tone],
          )}
        />
        <div className={cn("relative rounded-2xl border px-4 py-3", TONS[tone])}>
          {title && <p className="text-sm font-bold leading-snug">{title}</p>}
          <div className={cn("text-sm leading-relaxed", title && "mt-1 opacity-90")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
