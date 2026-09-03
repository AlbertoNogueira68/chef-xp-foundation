import { useMemo } from "react";
import { GraduationCap, Trophy } from "lucide-react";
import { ChallengesTab } from "@/components/learning/ChallengesTab";
import { LearningPathView } from "@/components/learning/LearningPath";
import { LessonPlayer } from "@/components/learning/LessonPlayer";
import { MissionRunScreen } from "@/components/missions/MissionRunScreen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChallenges } from "@/features/challenges/hooks/useChallenges";
import { useLearningPath } from "@/features/challenges/hooks/useLearningPath";
import { useLessonPlayer } from "@/features/challenges/hooks/useLessonPlayer";
import { useMissionRun } from "@/features/missions/hooks/useMissionRun";
import type { Skill } from "@/types/learning";
import { cn } from "@/lib/utils";

export function ChallengesPage() {
  const { data: path, isLoading: pathLoading } = useLearningPath();
  useChallenges();

  const player = useLessonPlayer();
  const mission = useMissionRun();

  const skillsById = useMemo(
    () => new Map<string, Skill>((path?.skills ?? []).map((skill) => [skill.id, skill])),
    [path?.skills],
  );

  return (
    <section className="relative space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Aprender a cozinhar</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Um percurso de competências que acaba sempre na cozinha.
        </p>
      </header>

      <Tabs defaultValue="learn" className="w-full">
        {/* Controlo segmentado: o separador ativo é um cartão branco por cima
            do fundo cinzento. Antes só o "Aprender" tinha estado ativo
            desenhado, e o outro parecia desligado. */}
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted p-1">
          <TabsTrigger
            value="learn"
            className="gap-1.5 rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm"
          >
            <GraduationCap className="size-4" />
            Percurso
          </TabsTrigger>
          <TabsTrigger
            value="challenges"
            className="gap-1.5 rounded-lg py-2 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-orange-600 data-[state=active]:shadow-sm"
          >
            <Trophy className="size-4" />
            Desafios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="challenges" className="mt-4">
          <ChallengesTab />
        </TabsContent>

        <TabsContent value="learn" className="mt-4">
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
            questionIndex={player.questionIndex}
            hearts={player.hearts}
            maxHearts={player.maxHearts}
            progress={player.progress}
            selectedAnswer={player.selectedAnswer}
            showFeedback={player.showFeedback}
            isCorrect={player.isCorrect}
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
