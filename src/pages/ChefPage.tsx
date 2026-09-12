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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/50 py-2">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
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
        <p className="text-sm text-muted-foreground">Este chef não existe.</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("/search")}>
          Procurar chefs
        </Button>
      </div>
    );
  }

  const following = stats?.isFollowing ?? false;

  return (
    <section className="space-y-5">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 rounded-full text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-1.5 size-4" /> Voltar
      </Button>

      <div className="flex items-start justify-between">
        <Avatar className="size-20 ring-4 ring-amber-500/20">
          <AvatarImage src={chef.photoUrl ?? undefined} />
          <AvatarFallback>{chef.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Button
          size="sm"
          variant={following ? "outline" : "default"}
          className="rounded-full"
          disabled={toggleFollow.isPending || !stats}
          onClick={() => toggleFollow.mutate({ id: chef.id, following })}
        >
          {following ? (
            <>
              <UserCheck className="mr-1.5 size-3.5" /> A seguir
            </>
          ) : (
            <>
              <UserPlus className="mr-1.5 size-3.5" /> Seguir
            </>
          )}
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold">{chef.username}</h1>
        <p className="text-sm text-muted-foreground">Nível {chef.level}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {!stats ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)
        ) : (
          <>
            <Stat label="Cozinhados" value={stats.cooked} />
            <Stat label="Receitas" value={stats.recipes} />
            <Stat label="Seguidores" value={stats.followers} />
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
            <Grid3X3 className="mr-1.5 size-3.5" /> Receitas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cooked" className="mt-4">
          {cooked.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ainda não cozinhou nenhuma missão em público.
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
              Ainda não publicou nenhuma receita.
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
    </section>
  );
}
