import { Link } from "react-router-dom";
import { ChefHat, Flame, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChefXPLogo } from "@/components/ChefXPLogo";

const PREVIEW_IMAGES = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=400&fit=crop",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=400&fit=crop",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=400&fit=crop",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=400&fit=crop",
];

const features = [
  { icon: Flame, label: "Ganha XP ao cozinhar" },
  { icon: Users, label: "Comunidade ativa" },
  { icon: ChefHat, label: "Receitas de chefs" },
  { icon: Sparkles, label: "Desafios semanais" },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/80 via-background to-background" />
      <div className="pointer-events-none absolute -right-20 top-20 size-72 rounded-full bg-orange-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-32 size-64 rounded-full bg-rose-200/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-5 py-10">
        <ChefXPLogo className="text-2xl" />

        <div className="mt-10 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
            Projeto Final de Licenciatura
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] tracking-tight">
            Cozinha.
            <br />
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Partilha. Evolui.
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            A rede social gamificada para quem ama cozinhar — inspirada no melhor do Instagram,
            TikTok e Pinterest.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-xs font-medium backdrop-blur-sm"
              >
                <Icon className="size-4 shrink-0 text-amber-500" />
                {label}
              </div>
            ))}
          </div>

          <div className="mt-8 columns-2 gap-2 space-y-2">
            {PREVIEW_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className="w-full rounded-xl object-cover shadow-sm"
                style={{ marginTop: i % 2 === 1 ? "1rem" : 0 }}
              />
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 -mx-5 border-t border-border/60 bg-background/80 px-5 py-4 backdrop-blur-xl">
          <Button
            asChild
            size="lg"
            className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-base font-semibold shadow-lg shadow-orange-500/25"
          >
            <Link to="/auth">Começar agora</Link>
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Grátis · Sem cartão · Demo com dados mock
          </p>
        </div>
      </div>
    </div>
  );
}
