import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChefHat, Grid3X3, UserCheck, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CookedCard } from "@/components/missions/CookedCard";
import { RecipeMasonryCard } from "@/components/RecipeMasonryCard";
import { XpProgress } from "@/components/XpProgress";
import { useRecipes } from "@/features/feed/hooks/useRecipes";
import { useMissionPosts } from "@/features/missions/hooks/useMissionPosts";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import { useUserProfile } from "@/features/profile/hooks/useUserProfile";
import { useUserStats, useToggleFollow } from "@/features/profile/hooks/useUserStats";
import { ChefActionsMenu } from "@/components/moderation/ChefActionsMenu";
import { FollowListDialog } from "@/components/profile/FollowListDialog";
import type { FollowListKind } from "@/features/profile/hooks/useFollowList";

function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </>
  );

  if (!onClick) return <div className="rounded-xl bg-muted/50 py-2">{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-muted/50 py-2 transition-colors hover:bg-muted"
    >
      {content}
    </button>
  );
}

/**
 * O perfil de outra pessoa.
 *
 * Mostra o mesmo que o perfil próprio, menos o que é privado (email, definições,
 * terminar sessão) e mais o botão de seguir. O próprio utilizador é reencaminhado
 * para `/profile`: ter duas páginas para a mesma pessoa era ter duas verdades.
 */
export function ChefPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const { data: chef, isLoading, isError } = useUserProfile(id);
  const { data: stats } = useUserStats(id);
  const { recipes } = useRecipes({ authorId: id, limit: 24 });
  const { data: cooked = [] } = useMissionPosts(id);
  const toggleFollow = useToggleFollow();
  const [followList, setFollowList] = useState<FollowListKind | null>(null);

  if (id && me?.id === id) return <Navigate to="/profile" replace />;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !chef) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">This chef doesn't exist.</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("/search")}>
          Search chefs
        </Button>
      </div>
    );
  }

  const following = stats?.isFollowing ?? false;
  const blocked = stats?.isBlocked ?? false;

  return (
    <section className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 rounded-full text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-1.5 size-4" /> Back
      </Button>

      <div className="flex items-start justify-between">
        <Avatar className="size-20 ring-4 ring-amber-500/20">
          <AvatarImage src={chef.photoUrl ?? undefined} />
          <AvatarFallback>{chef.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1">
          {/* Seguir não se oferece a quem está bloqueado: o servidor recusa, e
              desbloquear é que é o caminho. */}
          {!blocked && (
            <Button
              size="sm"
              variant={following ? "outline" : "default"}
              className="rounded-full"
              disabled={toggleFollow.isPending || !stats}
              onClick={() => toggleFollow.mutate({ id: chef.id, following })}
            >
              {following ? (
                <>
                  <UserCheck className="mr-1.5 size-3.5" /> Following
                </>
              ) : (
                <>
                  <UserPlus className="mr-1.5 size-3.5" /> Follow
                </>
              )}
            </Button>
          )}
          <ChefActionsMenu userId={chef.id} username={chef.username} isBlocked={blocked} />
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">{chef.username}</h1>
        <p className="text-sm text-muted-foreground">Level {chef.level}</p>
      </div>

      {/* Sem isto, um perfil bloqueado parecia um perfil vazio: as listas vêm
          filtradas do servidor e não havia nada a dizer porquê. */}
      {blocked && (
        <p className="rounded-xl border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground">
          You blocked this person. Their posts don't reach you, and they can't see yours. Unblock
          from the menu above or in settings.
        </p>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        {!stats ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)
        ) : (
          <>
            <Stat label="Cozinhados" value={stats.cooked} />
            <Stat label="Recipes" value={stats.recipes} />
            <Stat
              label="Seguidores"
              value={stats.followers}
              onClick={() => setFollowList("followers")}
            />
            <Stat label="Streak" value={`${stats.streak}d`} />
          </>
        )}
      </div>

      <XpProgress
        xp={chef.xpIntoLevel}
        nextLevelXp={chef.xpForNextLevel}
        level={chef.level}
        totalXp={chef.xp}
        isMaxLevel={chef.isMaxLevel}
      />

      {stats && stats.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stats.badges.map((badge) => (
            <Badge key={badge} variant="secondary" className="rounded-full text-[10px]">
              {badge}
            </Badge>
          ))}
        </div>
      )}

      <Tabs defaultValue="cooked">
        <TabsList className="grid w-full grid-cols-2 rounded-full">
          <TabsTrigger value="cooked" className="rounded-full text-xs">
            <ChefHat className="mr-1.5 size-3.5" /> Cozinhados
          </TabsTrigger>
          <TabsTrigger value="recipes" className="rounded-full text-xs">
            <Grid3X3 className="mr-1.5 size-3.5" /> Recipes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cooked" className="mt-4">
          {cooked.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Hasn't cooked a mission in public yet.
            </p>
          ) : (
            <div className="columns-2 gap-3">
              {cooked.map((post) => (
                <CookedCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recipes" className="mt-4">
          {recipes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Hasn't published a recipe yet.
            </p>
          ) : (
            <div className="columns-2 gap-3">
              {recipes.map((recipe) => (
                <RecipeMasonryCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FollowListDialog userId={id} kind={followList} onClose={() => setFollowList(null)} />
    </section>
  );
}
