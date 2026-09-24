import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, GraduationCap, Trophy } from "lucide-react";
import { ChallengesTab } from "@/components/learning/ChallengesTab";
import { LeaderboardTab } from "@/components/learning/LeaderboardTab";
import { LearningPathView } from "@/components/learning/LearningPath";
import { TrailSelector } from "@/components/learning/TrailSelector";
import { LessonPlayer } from "@/components/learning/LessonPlayer";
import { MissionRunScreen } from "@/components/missions/MissionRunScreen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChallenges } from "@/features/challenges/hooks/useChallenges";
import { useLearningPath } from "@/features/challenges/hooks/useLearningPath";
import { useLessonPlayer } from "@/features/challenges/hooks/useLessonPlayer";
import { useMissionRun } from "@/features/missions/hooks/useMissionRun";
import type { Skill } from "@/types/learning";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * O trilho escolhido sobrevive a um recarregamento. Sem isto, trocar para a
 * cozinha italiana e voltar à página punha a pessoa outra vez nos
 * fundamentos, sem nada no ecrã a explicar porquê.
 */
const TRAIL_STORAGE_KEY = "chefxp.trail";

function trilhoGuardado() {
  try {
    return localStorage.getItem(TRAIL_STORAGE_KEY) ?? "main-course";
  } catch {
    return "main-course";
  }
}

/** Os separadores que o endereço pode abrir: `/challenges?tab=challenges`. */
const TABS = ["learn", "challenges", "ranking"];

export function ChallengesPage() {
  const [trailId, setTrailId] = useState(trilhoGuardado);

  /**
   * Quem acaba de publicar uma participação volta para aqui — e tem de cair
   * nos desafios, não no percurso de lições. O separador vem do endereço para
   * que esse regresso possa apontar para o sítio certo.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const pedido = searchParams.get("tab");
  const tab = TABS.includes(pedido ?? "") ? (pedido as string) : "learn";

  const { data: path, isLoading: pathLoading } = useLearningPath(trailId);
  useChallenges();

  const player = useLessonPlayer(trailId);
  const mission = useMissionRun();

  function escolherTrilho(id: string) {
    setTrailId(id);
    try {
      localStorage.setItem(TRAIL_STORAGE_KEY, id);
    } catch {
      /* modo privado: a escolha vale só para esta sessão */
    }
  }

  const skillsById = useMemo(
    () => new Map<string, Skill>((path?.skills ?? []).map((skill) => [skill.id, skill])),
    [path?.skills],
  );

  return (
    <section className="relative space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("Learn to cook")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("A path of skills that always ends in the kitchen.")}
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(valor) => setSearchParams(valor === "learn" ? {} : { tab: valor })}
        className="w-full"
      >
        {/* Controlo segmentado: o separador ativo é um cartão branco por cima
            do fundo cinzento. Antes só o "Aprender" tinha estado ativo
            desenhado, e o outro parecia desligado. */}
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-muted p-1">
          <TabsTrigger
            value="learn"
            className="gap-1.5 rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm"
          >
            <GraduationCap className="size-4" />
            {t("Path")}
          </TabsTrigger>
          <TabsTrigger
            value="challenges"
            className="gap-1.5 rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-orange-600 data-[state=active]:shadow-sm"
          >
            <Trophy className="size-4" />
            {t("Challenges")}
          </TabsTrigger>
          <TabsTrigger
            value="ranking"
            className="gap-1.5 rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-amber-600 data-[state=active]:shadow-sm"
          >
            <BarChart3 className="size-4" />
            {t("Leaderboard")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <LeaderboardTab />
        </TabsContent>

        <TabsContent value="challenges" className="mt-4">
          <ChallengesTab />
        </TabsContent>

        <TabsContent value="learn" className="mt-4 space-y-4">
          <TrailSelector currentTrailId={trailId} onSelect={escolherTrilho} />
          <LearningPathView
            path={path}
            isLoading={pathLoading}
            onLessonClick={(id) => player.openLesson(id)}
            onStartMission={(id) => mission.open(id)}
          />
        </TabsContent>
      </Tabs>

      {mission.isOpen && (
        <div
          className={cn(
            "fixed inset-0 z-[110] flex flex-col bg-background",
            "animate-in slide-in-from-bottom duration-300",
          )}
          style={{ maxWidth: "32rem", margin: "0 auto", left: 0, right: 0 }}
        >
          <MissionRunScreen run={mission} skills={skillsById} />
        </div>
      )}

      {player.isOpen && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex flex-col bg-background",
            "animate-in slide-in-from-bottom duration-300",
          )}
          style={{ maxWidth: "32rem", margin: "0 auto", left: 0, right: 0 }}
        >
          <LessonPlayer
            lesson={player.lesson}
            phase={player.phase}
            currentQuestion={player.currentQuestion}
            currentPrepStep={player.currentPrepStep}
            prepStepIndex={player.prepStepIndex}
            prepStepCount={player.prepStepCount}
            questionIndex={player.questionIndex}
            hearts={player.hearts}
            maxHearts={player.maxHearts}
            progress={player.progress}
            selectedAnswer={player.selectedAnswer}
            showFeedback={player.showFeedback}
            isCorrect={player.isCorrect}
            semCorrecao={player.semCorrecao}
            porEnviar={player.porEnviar}
            correctAnswer={player.correctAnswer}
            explainWrong={player.explainWrong}
            explanation={player.explanation}
            isChecking={player.isChecking}
            xpEarned={player.xpEarned}
            onClose={player.closeLesson}
            onStartPreparation={player.startPreparation}
            onNextPrepStep={player.nextPrepStep}
            onPrevPrepStep={player.prevPrepStep}
            onSubmit={player.submitAnswer}
            onNextQuestion={player.nextQuestion}
            onRetry={player.retryLesson}
            onContinue={player.closeLesson}
          />
        </div>
      )}
    </section>
  );
}
