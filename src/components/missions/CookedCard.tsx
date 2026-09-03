import { ChefHat, Clock, Lock } from "lucide-react";
import type { MissionPost } from "@/types/learning";

function timeAgo(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

/**
 * Um cozinhado no perfil.
 *
 * O que se destaca não é a foto — é a missão e o nível a que a pessoa estava
 * quando a fez. Um perfil de receitas mostra o que alguém sabe; isto mostra o
 * caminho que fez, e é essa a diferença que o projeto defende.
 */
export function CookedCard({ post }: { post: MissionPost }) {
  return (
    <article className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative">
        <img src={post.imageUrl} alt="" className="w-full object-cover" loading="lazy" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <ChefHat className="size-3" />
          Nível {post.levelAt}
        </span>
      </div>

      <div className="p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
          {post.missionTitle}
        </p>
        <p className="text-sm font-semibold leading-tight">{post.dishName}</p>

        {post.caption && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.caption}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Clock className="size-3" />
            {post.minutes} min
          </span>
          <span>·</span>
          <span>{timeAgo(post.createdAt)}</span>

          {/* Cozinhou mas não publicou: continua a contar para ele, só não
              aparece a mais ninguém. */}
          {!post.shared && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-px font-medium">
              <Lock className="size-2.5" />
              só para ti
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
