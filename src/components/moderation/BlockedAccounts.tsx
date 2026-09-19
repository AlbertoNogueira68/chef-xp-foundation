import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlockedUsers, useToggleBlock } from "@/features/moderation/hooks/useModeration";
import { t } from "@/i18n";

/**
 * As contas que bloqueei, dentro das definições.
 *
 * Sem esta lista, bloquear era uma porta sem maçaneta do lado de dentro: a
 * pessoa desaparece do feed, da pesquisa e das sugestões — ou seja, de todos
 * os sítios onde se poderia lá voltar para desfazer o bloqueio.
 */
export function BlockedAccounts() {
  const blocked = useBlockedUsers();
  const toggleBlock = useToggleBlock();

  return (
    <section className="space-y-2 border-t border-border/60 pt-4">
      <h3 className="text-sm font-semibold">{t("Blocked accounts")}</h3>

      {blocked.isLoading && <Skeleton className="h-12 w-full rounded-xl" />}

      {blocked.data?.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          {t("You haven't blocked anyone. Blocking hides what they post, both ways.")}
        </p>
      )}

      <ul className="space-y-2">
        {blocked.data?.map((user) => (
          <li
            key={user.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-2"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-9">
                <AvatarImage src={user.photoUrl ?? undefined} />
                <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">{user.username}</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 rounded-full text-xs"
              disabled={toggleBlock.isPending}
              onClick={() => toggleBlock.mutate({ id: user.id, blocked: true })}
            >
              {t("Unblock")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
