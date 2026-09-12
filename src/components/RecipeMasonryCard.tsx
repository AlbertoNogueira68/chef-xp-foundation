import { Link } from "react-router-dom";
import { Clock, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Recipe } from "@/types/recipe";

export function RecipeMasonryCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="group mb-3 block break-inside-avoid overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative overflow-hidden">
        {recipe.imageUrl && (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between opacity-0 transition-opacity group-hover:opacity-100">
          <p className="text-sm font-semibold text-white drop-shadow">{recipe.title}</p>
          <Badge className="border-0 bg-white/20 text-white backdrop-blur-sm">
            +{recipe.xpReward} XP
          </Badge>
        </div>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{recipe.title}</p>
        <p className="text-xs text-muted-foreground">@{recipe.author.username}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3" /> {recipe.likesCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {recipe.cookTimeMin}m
          </span>
        </div>
      </div>
    </Link>
  );
}
