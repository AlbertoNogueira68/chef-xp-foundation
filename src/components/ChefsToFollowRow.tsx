import { UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuggestedChefs, useToggleFollow } from "@/features/profile/hooks/useUserStats";

/**
 * Substitui a fila de "stories" que era alimentada por dados fictícios.
 * Estes são utilizadores reais que ainda não segues — e o botão faz algo.
 */
export function ChefsToFollowRow() {
  const { data: chefs, isLoading } = useSuggestedChefs();
  const toggleFollow = useToggleFollow();

  if (isLoading) {
    return (
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="h-2 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!chefs || chefs.length === 0) return null;

  return (
    <section aria-label="Chefs a seguir">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Chefs a seguir
      </h2>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-1">
          {chefs.map((chef) => (
            <div key={chef.id} className="flex w-20 shrink-0 flex-col items-center gap-1.5">
              <div className="rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-[2px]">
                <Avatar className="size-14 border-2 border-background">
                  <AvatarImage src={chef.photoUrl ?? undefined} alt="" />
                  <AvatarFallback>{chef.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              <span className="max-w-20 truncate text-[10px] text-muted-foreground">
                {chef.username}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 rounded-full px-2 text-[10px]"
                disabled={toggleFollow.isPending}
                onClick={() => toggleFollow.mutate({ id: chef.id, following: false })}
              >
                <UserPlus className="mr-1 size-3" /> Seguir
              </Button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </section>
  );
}
