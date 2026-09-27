import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Home, Plus, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChefMascot, type ChefMood } from "@/components/ChefMascot";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import {
  marcarTutorialVisto,
  tutorialVisto,
  usePedidosDeTutorial,
} from "@/features/onboarding/tourStore";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * A visita guiada de quem entra pela primeira vez.
 *
 * Quem chega à app encontra cinco botões em baixo e um percurso de lições que
 * não se parece com nada que já tenha usado — e nada no ecrã a dizer por onde
 * começar. Isto é essa explicação: quatro ecrãs curtos, contados pelo chef,
 * com o ícone de cada separador ao lado do que ele faz, para que o passo do
 * tutorial e o botão da barra se reconheçam um ao outro.
 *
 * Aparece uma vez por pessoa (ver `tourStore`) e acaba a levar quem o viu à
 * primeira lição — um tutorial que termina num ecrã vazio não ensinou nada.
 */

type Passo = {
  /** O ícone da barra de baixo a que este passo se refere; o primeiro é o chef. */
  icon?: LucideIcon;
  mood: ChefMood;
  title: string;
  body: string;
};

// Como no `BottomNav`: uma função e não uma constante, porque o texto é
// traduzido no momento em que se desenha, e a língua pode mudar antes disso.
const passos = (nome: string): Passo[] => [
  {
    mood: "celebrar",
    title: t("Welcome, chef {name}!", { name: nome }),
    body: t(
      "Here you learn to cook the way a game is played: short lessons, real dishes, and XP for everything you cook.",
    ),
  },
  {
    icon: GraduationCap,
    mood: "normal",
    title: t("Learn one skill at a time"),
    body: t(
      "Under the trophy is the trail of lessons. Each skill ends in a mission: a dish to cook in your own kitchen, with the chef guiding you step by step.",
    ),
  },
  {
    icon: Plus,
    mood: "aprovar",
    title: t("Cooked it? Publish it"),
    body: t(
      "The orange button is where the dish goes up. A photo, the ingredients, and the XP is yours — with or without a connection, it's sent when the network comes back.",
    ),
  },
  {
    icon: Home,
    mood: "normal",
    title: t("The feed is the kitchen next door"),
    body: t(
      "Follow other chefs, see what they cooked today, and enter the week's challenges to appear on the leaderboard.",
    ),
  },
  {
    icon: User,
    mood: "aprovar",
    title: t("Your progress lives in the profile"),
    body: t(
      "Level, XP, day streak and the daily goal — change it whenever the week asks for less, or for more.",
    ),
  },
];

export function WelcomeTour() {
  const { data: user } = useCurrentUser();
  const pedidos = usePedidosDeTutorial();
  const navigate = useNavigate();

  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);

  // Só depois de saber quem é: a marca de "já viu" é por pessoa, e abrir antes
  // de a sessão responder mostrava o tutorial a quem já o tinha dispensado.
  useEffect(() => {
    if (!user || tutorialVisto(user.id)) return;
    setPasso(0);
    setAberto(true);
  }, [user]);

  // O botão das definições. O primeiro valor do contador não é um pedido — é
  // o estado inicial de quem acaba de ouvir.
  useEffect(() => {
    if (pedidos === 0) return;
    setPasso(0);
    setAberto(true);
  }, [pedidos]);

  if (!user) return null;

  const ecras = passos(user.username);
  const actual = ecras[passo];
  const ultimo = passo === ecras.length - 1;
  const Icon = actual.icon;

  /** Fechar é ter visto: quem salta a meio não quer isto outra vez amanhã. */
  function fechar() {
    setAberto(false);
    if (user) marcarTutorialVisto(user.id);
  }

  function terminar() {
    fechar();
    // Acabar no percurso de lições e não onde calhou: o passo seguinte
    // natural é a primeira lição, e é a um toque de distância.
    navigate("/challenges");
  }

  return (
    <Dialog open={aberto} onOpenChange={(estado) => (estado ? setAberto(true) : fechar())}>
      <DialogContent
        className="max-w-sm gap-5 rounded-2xl"
        aria-label={t("Welcome tour")}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
      >
        <div className="flex flex-col items-center text-center">
          {Icon ? (
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/25">
              <Icon className="size-7" strokeWidth={2.25} />
            </span>
          ) : (
            <ChefMascot size="lg" mood={actual.mood} />
          )}

          <DialogTitle className="mt-4 text-xl font-bold">{actual.title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed">
            {actual.body}
          </DialogDescription>
        </div>

        {/* Onde se vai: sem isto, "Seguinte" é uma porta sem fim à vista. */}
        <ol
          className="flex items-center justify-center gap-1.5"
          aria-label={t("Step {current} of {total}", { current: passo + 1, total: ecras.length })}
        >
          {ecras.map((ecra, i) => (
            <li
              key={ecra.title}
              aria-hidden
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === passo ? "w-6 bg-amber-500" : "w-1.5 bg-muted-foreground/25",
              )}
            />
          ))}
        </ol>

        <div className="flex items-center gap-2">
          {passo > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => setPasso((n) => n - 1)}
            >
              {t("Back")}
            </Button>
          )}

          {!ultimo && (
            <Button type="button" variant="ghost" className="rounded-full" onClick={fechar}>
              {t("Skip")}
            </Button>
          )}

          <Button
            type="button"
            className="ml-auto rounded-full"
            onClick={() => (ultimo ? terminar() : setPasso((n) => n + 1))}
          >
            {ultimo ? t("Start the first lesson") : t("Next")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
