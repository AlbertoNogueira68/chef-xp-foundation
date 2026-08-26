import { GraduationCap, Trophy } from "lucide-react";
import { ChallengesTab } from "@/components/learning/ChallengesTab";
import { LearningPathView } from "@/components/learning/LearningPath";
import { LessonPlayer } from "@/components/learning/LessonPlayer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChallenges } from "@/features/challenges/hooks/useChallenges";
import { useLearningPath } from "@/features/challenges/hooks/useLearningPath";
import { useLessonPlayer } from "@/features/challenges/hooks/useLessonPlayer";
import { cn } from "@/lib/utils";

export function ChallengesPage() {
  const { data: path, isLoading: pathLoading } = useLearningPath();
  useChallenges();

  const player = useLessonPlayer();

  return (
    <section className="relative space-y-4">
      <div>
        <h1 className="text-xl font-bold">Desafios & Aprender</h1>
        <p className="text-xs text-muted-foreground">
          Missões da comunidade e plano diário de receitas
        </p>
      </div>

      <Tabs defaultValue="learn" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/80 p-1">
          <TabsTrigger value="challenges" className="gap-1.5 rounded-full text-xs">
            <Trophy className="size-3.5" />
            Desafios
          </TabsTrigger>
          <TabsTrigger
            value="learn"
            className="gap-1.5 rounded-full text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
          >
            <GraduationCap className="size-3.5" />
            Aprender
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
          />
        </TabsContent>
      </Tabs>

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
