import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserCheck, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useFollowList, type FollowListKind } from "@/features/profile/hooks/useFollowList";
import { useToggleFollow } from "@/features/profile/hooks/useUserStats";
import { cn } from "@/lib/utils";

const TITLES: Record<FollowListKind, { title: string; empty: string }> = {
  followers: { title: "Seguidores", empty: "Ainda ninguém segue este perfil." },
  following: { title: "A seguir", empty: "Ainda não segue ninguém." },
};

const TABS: FollowListKind[] = ["followers", "following"];

/**
 * Os contadores do perfil já existiam; o que faltava era poder abri-los.
 *
 * O `isFollowing` de cada linha é sempre o meu estado em relação àquela
 * pessoa — não o estado de quem estou a visitar. Ver a lista de outra pessoa
 * não me diz quem ela segue de volta, diz-me quem eu sigo.
 */
export function FollowListDialog({
  userId,
  kind,
  onClose,
}: {
  userId: string | undefined;
  /** Qual das listas abrir. `null` mantém o diálogo fechado. */
  kind: FollowListKind | null;
  onClose: () => void;
}) {
  const open = Boolean(kind && userId);
  const [active, setActive] = useState<FollowListKind>(kind ?? "followers");

  // O contador em que se clicou escolhe a lista que abre; lá dentro trocam-se
  // as duas sem fechar nada.
  useEffect(() => {
    if (kind) setActive(kind);
  }, [kind]);

  const { data, isLoading } = useFollowList(active, userId, open);
  const toggleFollow = useToggleFollow();

  const copy = TITLES[active];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {data ? `${data.length} ${data.length === 1 ? "pessoa" : "pessoas"}` : "A carregar…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={active === tab}
              onClick={() => setActive(tab)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                active === tab
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {TITLES[tab].title}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <div className="py-8 text-center">
            <Users className="mx-auto size-5 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">{copy.empty}</p>
          </div>
        )}

        <ul className="space-y-1">
          {data?.map((person) => (
            <li key={person.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <Link
                to={person.isMe ? "/profile" : `/chef/${person.id}`}
                onClick={onClose}
                className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80"
              >
                <Avatar className="size-9">
                  <AvatarImage src={person.photoUrl ?? undefined} />
                  <AvatarFallback>{person.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {person.username}
                    {person.isMe && <span className="ml-1.5 text-xs text-amber-600">tu</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Nível {person.level}</span>
                </span>
              </Link>

              {!person.isMe && (
                <Button
                  size="sm"
                  variant={person.isFollowing ? "outline" : "default"}
                  className="shrink-0 rounded-full text-xs"
                  disabled={toggleFollow.isPending}
                  onClick={() =>
                    toggleFollow.mutate({ id: person.id, following: person.isFollowing })
                  }
                >
                  {person.isFollowing ? (
                    <>
                      <UserCheck className="mr-1 size-3" /> A seguir
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1 size-3" /> Seguir
                    </>
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
