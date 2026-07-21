import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import { useSignOut } from "@/features/auth/hooks/useSignOut";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Perfil · ChefXP" },
      { name: "description", content: "O teu perfil, nível e XP no ChefXP." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: user, isLoading } = useCurrentUser();
  const signOut = useSignOut();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <Card>
        <CardHeader>
          <CardTitle>{isLoading ? "A carregar…" : (user?.username ?? "Sem perfil")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">{user?.email}</p>
          <div className="flex gap-4">
            <span>Nível: <strong>{user?.level ?? 1}</strong></span>
            <span>XP: <strong>{user?.xp ?? 0}</strong></span>
          </div>
        </CardContent>
      </Card>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        {signOut.isPending ? "A sair…" : "Terminar sessão"}
      </Button>
    </section>
  );
}
