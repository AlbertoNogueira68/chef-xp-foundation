import { useNavigate } from "react-router-dom";
import { ChefXPLogo } from "@/components/ChefXPLogo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export function AuthPage() {
  const navigate = useNavigate();
  const goToApp = () => navigate("/feed", { replace: true });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/70 via-background to-background" />
      <img
        src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=1200&fit=crop"
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-[0.07]"
      />

      <div className="relative w-full max-w-md space-y-6">
        <div className="text-center">
          <ChefXPLogo className="text-3xl" />
          <p className="mt-2 text-sm text-muted-foreground">
            Entra na comunidade e começa a ganhar XP.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur-xl">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/80 p-1">
              <TabsTrigger value="login" className="rounded-full">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-full">
                Registar
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-5">
              <LoginForm onSuccess={goToApp} />
            </TabsContent>
            <TabsContent value="register" className="mt-5">
              <RegisterForm onSuccess={goToApp} />
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Demo: <span className="font-medium text-foreground">demo@chef-xp.local</span> / chef123
        </p>
      </div>
    </div>
  );
}
