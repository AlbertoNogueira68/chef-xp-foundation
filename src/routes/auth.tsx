import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { useSignInWithGoogle } from "@/features/auth/hooks/useSignInWithGoogle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · ChefXP" },
      {
        name: "description",
        content: "Entra ou cria a tua conta ChefXP para cozinhar, ganhar XP e evoluir.",
      },
      { property: "og:title", content: "Entrar · ChefXP" },
      {
        property: "og:description",
        content: "Entra ou cria a tua conta ChefXP para cozinhar, ganhar XP e evoluir.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const google = useSignInWithGoogle();

  const goToApp = () => navigate({ to: "/feed", replace: true });

  const handleGoogle = () => {
    google.mutate(undefined, {
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">ChefXP</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cozinha, ganha XP, sobe de nível.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Registar</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="pt-4">
              <LoginForm onSuccess={goToApp} />
            </TabsContent>
            <TabsContent value="register" className="pt-4">
              <RegisterForm onSuccess={goToApp} />
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={google.isPending}
          >
            {google.isPending ? "A ligar…" : "Continuar com Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
