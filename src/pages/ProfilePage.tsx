import { useState } from "react";
import { Grid3X3, Settings, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XpProgress } from "@/components/XpProgress";
import { DEMO_PROFILE_STATS } from "@/constants/demo";
import { useSignOut } from "@/features/auth/hooks/useSignOut";
import { useRecipes } from "@/features/feed/hooks/useRecipes";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";

export function ProfilePage() {
  const { data: user, isLoading } = useCurrentUser();
  const { data: recipes } = useRecipes();
  const signOut = useSignOut();
  const [tab, setTab] = useState("recipes");

  const myRecipes = recipes?.filter((r) => r.author.username === user?.username) ?? [];
  const stats = DEMO_PROFILE_STATS;
  const avatarUrl =
    user?.photoUrl ??
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop";

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between">
        <Avatar className="size-20 ring-4 ring-amber-500/20">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>{user?.username?.slice(0, 2).toUpperCase() ?? "??"}</AvatarFallback>
        </Avatar>
        <div className="flex gap-1 pt-1">
          <Button variant="ghost" size="icon" className="size-9 rounded-full">
            <Share2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-9 rounded-full">
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">{isLoading ? "…" : (user?.username ?? "chef")}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Receitas", value: stats.recipes },
          { label: "Seguidores", value: stats.followers },
          { label: "A seguir", value: stats.following },
          { label: "Streak", value: `${stats.streak}d` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-muted/50 py-2">
            <p className="text-base font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <XpProgress
        xp={user?.xp ?? 0}
        level={user?.level ?? 1}
        nextLevelXp={stats.nextLevelXp}
      />

      <div className="flex flex-wrap gap-1.5">
        {stats.badges.map((badge) => (
          <Badge key={badge} variant="secondary" className="rounded-full text-[10px]">
            {badge}
          </Badge>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 rounded-full">
          <TabsTrigger value="recipes" className="rounded-full">
            <Grid3X3 className="mr-1.5 size-3.5" /> Receitas
          </TabsTrigger>
          <TabsTrigger value="saved" className="rounded-full">
            Guardadas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="recipes" className="mt-3">
          <div className="grid grid-cols-3 gap-0.5">
            {(myRecipes.length > 0 ? myRecipes : recipes?.slice(0, 6) ?? []).map((recipe) => (
              <div key={recipe.id} className="relative aspect-square overflow-hidden bg-muted">
                {recipe.imageUrl && (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="saved" className="mt-3">
          <div className="grid grid-cols-3 gap-0.5">
            {recipes?.slice(2, 8).map((recipe) => (
              <div key={recipe.id} className="relative aspect-square overflow-hidden bg-muted">
                {recipe.imageUrl && (
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Button
        variant="outline"
        className="w-full rounded-full"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        {signOut.isPending ? "A sair…" : "Terminar sessão"}
      </Button>
    </section>
  );
}
