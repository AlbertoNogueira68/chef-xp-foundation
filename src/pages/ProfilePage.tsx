import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChefHat, Grid3X3, LogOut, Settings, Share2, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CookedCard } from "@/components/missions/CookedCard";
import { SettingsDialog } from "@/components/profile/SettingsDialog";
import { FollowListDialog } from "@/components/profile/FollowListDialog";
import type { FollowListKind } from "@/features/profile/hooks/useFollowList";
import { RecipeMasonryCard } from "@/components/RecipeMasonryCard";
import { XpProgress } from "@/components/XpProgress";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { useRecipes } from "@/features/feed/hooks/useRecipes";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import { useUserStats } from "@/features/profile/hooks/useUserStats";
import { useMissionPosts } from "@/features/missions/hooks/useMissionPosts";
import { shareLink } from "@/lib/share";

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

  // Só os contadores que abrem alguma coisa é que são botões. Um número que
  // não leva a lado nenhum não deve parecer clicável.
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

export function ProfilePage() {
  const { data: user, isLoading } = useCurrentUser();
  const { data: stats, isLoading: statsLoading } = useUserStats(user?.id);
  const { recipes: myRecipes } = useRecipes({ authorId: user?.id, limit: 24 });
  const { data: cooked = [], isLoading: cookedLoading } = useMissionPosts(user?.id);
  const signOut = useSignOut();
  const [tab, setTab] = useState("cooked");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const [followList, setFollowList] = useState<FollowListKind | null>(null);

  const shareProfile = () =>
    user &&
    shareLink({
      path: `/chef/${user.id}`,
      title: `${user.username} no ChefXP`,
      copiedMessage: "Profile link copied",
    });

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
            aria-label="Share profile"
            onClick={shareProfile}
          >
            <Share2 className="size-4" />
          </Button>
          {/* Só aparece a quem tem papel. O servidor recusa a rota aos outros;
              isto evita oferecer uma porta fechada. */}
          {(user?.role === "admin" || user?.role === "moderator") && (
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full"
              aria-label={user.role === "admin" ? "Admin" : "Moderation"}
              onClick={() => navigate("/admin")}
            >
              <Shield className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Sign out"
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
          {stats.lessonsCompleted === 1 ? "lesson completed" : "lessons completed"}
          {" · "}
          {stats.likesReceived} {stats.likesReceived === 1 ? "gosto recebido" : "gostos recebidos"}
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 rounded-full">
          <TabsTrigger value="cooked" className="rounded-full text-xs">
            <ChefHat className="mr-1.5 size-3.5" /> Cozinhados
          </TabsTrigger>
          <TabsTrigger value="recipes" className="rounded-full text-xs">
            <Grid3X3 className="mr-1.5 size-3.5" /> Recipes
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-full text-xs">
            Atividade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cooked" className="mt-4">
          {cookedLoading ? (
            <div className="columns-2 gap-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="mb-3 h-40 rounded-xl" />
              ))}
            </div>
          ) : cooked.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <ChefHat className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                You haven't cooked a mission yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Photos from the missions you finish show up here.
              </p>
            </div>
          ) : (
            <div className="columns-2 gap-3">
              {cooked.map((post) => (
                <CookedCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recipes" className="mt-4">
          {myRecipes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              You haven't published a recipe yet.
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
            <span className="text-muted-foreground">Lessons completed</span>
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

      {user && <SettingsDialog user={user} open={settingsOpen} onOpenChange={setSettingsOpen} />}

      <FollowListDialog userId={user?.id} kind={followList} onClose={() => setFollowList(null)} />
    </section>
  );
}
