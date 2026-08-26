import { useState } from "react";
import { Grid3X3, LogOut, Settings, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipeMasonryCard } from "@/components/RecipeMasonryCard";
import { XpProgress } from "@/components/XpProgress";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { useRecipes } from "@/features/feed/hooks/useRecipes";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import { useUserStats } from "@/features/profile/hooks/useUserStats";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/50 py-2">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function ProfilePage() {
  const { data: user, isLoading } = useCurrentUser();
  const { data: stats, isLoading: statsLoading } = useUserStats(user?.id);
  const { recipes: myRecipes } = useRecipes({ authorId: user?.id, limit: 24 });
  const signOut = useSignOut();
  const [tab, setTab] = useState("recipes");

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between">
        <Avatar className="size-20 ring-4 ring-amber-500/20">
          <AvatarImage src={user?.photoUrl ?? undefined} />
          <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase() ?? "??"}</AvatarFallback>
        </Avatar>
        <div className="flex gap-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Partilhar perfil"
          >
            <Share2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Definições"
          >
            <Settings className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Terminar sessão"
            onClick={() => signOut.mutate()}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">{isLoading ? "…" : (user?.username ?? "chef")}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Todos estes números vêm de tabelas reais — antes eram constantes. */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {statsLoading || !stats ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </>
        ) : (
          <>
            <Stat label="Receitas" value={stats.recipes} />
            <Stat label="Seguidores" value={stats.followers} />
            <Stat label="A seguir" value={stats.following} />
            <Stat label="Streak" value={`${stats.streak}d`} />
          </>
        )}
      </div>

      {user && (
        <XpProgress
          xp={user.xpIntoLevel}
          nextLevelXp={user.xpForNextLevel}
          level={user.level}
          totalXp={user.xp}
          isMaxLevel={user.isMaxLevel}
        />
      )}

      {stats && stats.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stats.badges.map((badge) => (
            <Badge key={badge} variant="secondary" className="rounded-full text-[10px]">
              {badge}
            </Badge>
          ))}
        </div>
      )}

      {stats && stats.lessonsCompleted > 0 && (
        <p className="text-xs text-muted-foreground">
          {stats.lessonsCompleted}{" "}
          {stats.lessonsCompleted === 1 ? "lição concluída" : "lições concluídas"}
          {" · "}
          {stats.likesReceived} {stats.likesReceived === 1 ? "gosto recebido" : "gostos recebidos"}
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 rounded-full">
          <TabsTrigger value="recipes" className="rounded-full">
            <Grid3X3 className="mr-1.5 size-3.5" /> Receitas
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-full">
            Atividade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recipes" className="mt-4">
          {myRecipes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ainda não publicaste nenhuma receita.
            </p>
          ) : (
            <div className="columns-2 gap-3">
              {myRecipes.map((recipe) => (
                <RecipeMasonryCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">XP total</span>
            <span className="font-semibold tabular-nums">{user?.xp ?? 0}</span>
          </div>
          <div className="flex justify-between rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Lições concluídas</span>
            <span className="font-semibold tabular-nums">{stats?.lessonsCompleted ?? 0}</span>
          </div>
          <div className="flex justify-between rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Gostos recebidos</span>
            <span className="font-semibold tabular-nums">{stats?.likesReceived ?? 0}</span>
          </div>
          <div className="flex justify-between rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-muted-foreground">Dias seguidos</span>
            <span className="font-semibold tabular-nums">{stats?.streak ?? 0}</span>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
