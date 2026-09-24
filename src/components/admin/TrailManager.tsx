import { toast } from "sonner";
import { Eye, EyeOff, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminTrails,
  usePublishTrail,
  useUnpublishTrail,
} from "@/features/admin/hooks/useAdminTrails";
import { type AdminTrail, type TrailDifficulty } from "@/features/admin/services/trailAdminService";
import { t } from "@/i18n";

/** Chaves literais, para o dicionário as encontrar na leitura do código. */
function rotulo(dificuldade: TrailDifficulty) {
  if (dificuldade === "beginner") return t("Beginner");
  if (dificuldade === "intermediate") return t("Intermediate");
  return t("Advanced");
}

function Estado({ trail }: { trail: AdminTrail }) {
  if (!trail.loaded) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
        <FileWarning className="size-3" />
        {t("Curriculum failed to load")}
      </span>
    );
  }
  if (trail.published_at) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        <Eye className="size-3" />
        {t("Published")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      <EyeOff className="size-3" />
      {t("Draft")}
    </span>
  );
}

/**
 * Um trilho é código: currículo em `shared/trails/<id>.json`, com deploy. O
 * que fica por aqui é só publicar ou despublicar — o que decide quem o vê.
 */
function Cartao({ trail }: { trail: AdminTrail }) {
  const publish = usePublishTrail();
  const unpublish = useUnpublishTrail();

  const ocupado = publish.isPending || unpublish.isPending;

  async function corre(accao: () => Promise<unknown>, sucesso: string) {
    try {
      await accao();
      toast.success(sucesso);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("That didn't work"));
    }
  }

  return (
    <li className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">{trail.icon ?? "📘"}</span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{trail.name}</p>
          <p className="truncate text-xs text-muted-foreground">{trail.description}</p>
          <div className="mt-1 flex items-center gap-3">
            <Estado trail={trail} />
            <span className="text-[11px] text-muted-foreground">{rotulo(trail.difficulty)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {trail.published_at ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full text-xs"
            disabled={ocupado}
            onClick={() =>
              corre(
                () => unpublish.mutateAsync(trail.id),
                t("{name} is a draft again", { name: trail.name }),
              )
            }
          >
            {t("Unpublish")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-full text-xs"
            // Publicar um trilho cujo currículo não carregou punha um cartão
            // no ecrã que dava erro ao ser aberto.
            disabled={ocupado || !trail.loaded}
            onClick={() =>
              corre(() => publish.mutateAsync(trail.id), t("{name} is live", { name: trail.name }))
            }
          >
            {t("Publish")}
          </Button>
        )}
      </div>
    </li>
  );
}

export function TrailManager() {
  const { data: trails, isLoading } = useAdminTrails();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("A trail is only visible to learners once it's published.")}
      </p>

      <ul className="space-y-2">
        {trails?.map((trail) => (
          <Cartao key={trail.id} trail={trail} />
        ))}
      </ul>
    </div>
  );
}
