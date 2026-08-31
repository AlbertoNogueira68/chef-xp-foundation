import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  HeartCrack,
  ListChecks,
  Undo2,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { AnswerValue, Lesson, LessonPlayerPhase, Question } from "@/types/learning";
import { LessonComplete } from "./LessonComplete";
import { cn } from "@/lib/utils";

const DIFFICULTY: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

export function LessonPlayer({
  lesson,
  phase,
  currentQuestion,
  currentPrepStep,
  prepStepIndex,
  questionIndex,
  hearts,
  maxHearts,
  progress,
  selectedAnswer,
  showFeedback,
  isCorrect,
  correctAnswer,
  explainWrong,
  explanation,
  isChecking,
  xpEarned,
  onClose,
  onStartPreparation,
  onNextPrepStep,
  onPrevPrepStep,
  onSubmit,
  onNextQuestion,
  onRetry,
  onContinue,
}: {
  lesson: Lesson | null;
  phase: LessonPlayerPhase;
  currentQuestion: Question | null;
  currentPrepStep: { title: string; description: string } | null;
  prepStepIndex: number;
  questionIndex: number;
  hearts: number;
  maxHearts: number;
  progress: number;
  selectedAnswer: AnswerValue | null;
  showFeedback: boolean;
  isCorrect: boolean;
  /**
   * A resposta certa e a explicação só existem depois de o servidor corrigir.
   * Não vêm dentro da lição — se viessem, estariam no bundle do browser.
   */
  correctAnswer: AnswerValue | null;
  explainWrong: string | null;
  explanation: string | null;
  isChecking: boolean;
  xpEarned: number;
  onClose: () => void;
  onStartPreparation: () => void;
  onNextPrepStep: () => void;
  onPrevPrepStep: () => void;
  onSubmit: (answer: AnswerValue) => void;
  onNextQuestion: () => void;
  onRetry: () => void;
  onContinue: () => void;
}) {
  if (!lesson) return null;

  if (phase === "complete") {
    return (
      <div className="flex flex-1 flex-col">
        <LessonComplete xpEarned={xpEarned} lessonTitle={lesson.dishName} onContinue={onContinue} />
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <HeartCrack className="size-16 text-rose-400" />
        <h2 className="mt-4 text-xl font-bold">Sem corações!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Repete a lição de <strong>{lesson.dishName}</strong> e acerta nas perguntas.
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
          <Button className="rounded-full bg-emerald-500 hover:bg-emerald-600" onClick={onRetry}>
            <RotateCcw className="mr-2 size-4" />
            Tentar novamente
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={onClose}>
            Voltar ao trilho
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <PlayerTopBar
        progress={progress}
        hearts={hearts}
        maxHearts={maxHearts}
        showHearts={phase === "quiz"}
        onClose={onClose}
      />

      {phase === "intro" && <LessonIntro lesson={lesson} onStart={onStartPreparation} />}

      {phase === "prep" && currentPrepStep && (
        <LessonPrep
          lesson={lesson}
          step={currentPrepStep}
          stepIndex={prepStepIndex}
          totalSteps={lesson.preparationSteps.length}
          onNext={onNextPrepStep}
          onPrev={onPrevPrepStep}
        />
      )}

      {phase === "quiz" && currentQuestion && (
        <LessonQuiz
          dishName={lesson.dishName}
          question={currentQuestion}
          questionIndex={questionIndex}
          totalQuestions={lesson.questions.length}
          selectedAnswer={selectedAnswer}
          showFeedback={showFeedback}
          isCorrect={isCorrect}
          correctAnswer={correctAnswer}
          explainWrong={explainWrong}
          explanation={explanation}
          isChecking={isChecking}
          hearts={hearts}
          onSubmit={onSubmit}
          onNext={onNextQuestion}
        />
      )}
    </div>
  );
}

function PlayerTopBar({
  progress,
  hearts,
  maxHearts,
  showHearts,
  onClose,
}: {
  progress: number;
  hearts: number;
  maxHearts: number;
  showHearts: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
      <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted">
        <X className="size-5" />
      </button>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {showHearts ? (
        <div className="flex gap-0.5 text-sm">
          {Array.from({ length: maxHearts }).map((_, i) => (
            <span key={i} className={i < hearts ? "text-rose-500" : "text-muted-foreground/30"}>
              ♥
            </span>
          ))}
        </div>
      ) : (
        <div className="w-10" />
      )}
    </div>
  );
}

function LessonIntro({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-6 pt-4">
      <Badge className="mb-2 w-fit rounded-full border-0 bg-emerald-100 text-emerald-800">
        {lesson.type === "chest"
          ? "Bónus"
          : lesson.type === "boss"
            ? "Revisão"
            : `Dia ${lesson.dayNumber}`}
      </Badge>
      <h2 className="text-2xl font-bold leading-tight">{lesson.dishName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{lesson.description}</p>

      <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
          <Clock className="size-3" /> {lesson.cookTimeMin} min
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">{DIFFICULTY[lesson.difficulty]}</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
          +{lesson.xpReward} XP
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl">
        <img
          src={lesson.imageUrl}
          alt={lesson.dishName}
          className="aspect-video w-full object-cover"
        />
      </div>

      <div className="mt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4 text-emerald-600" />
          Ingredientes
        </h3>
        <ul className="mt-2 space-y-1.5">
          {lesson.ingredients.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {lesson.preparationSteps.length} passos de preparação + {lesson.questions.length} perguntas
      </p>

      <Button
        className="mt-6 w-full rounded-full bg-emerald-500 py-6 text-base font-semibold hover:bg-emerald-600"
        onClick={onStart}
      >
        Começar preparação
        <ArrowRight className="ml-2 size-5" />
      </Button>
    </div>
  );
}

function LessonPrep({
  lesson,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
}: {
  lesson: Lesson;
  step: { title: string; description: string };
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const isLast = stepIndex >= totalSteps - 1;

  return (
    <div className="flex flex-1 flex-col px-4 pb-6 pt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
        Preparação · Passo {stepIndex + 1} de {totalSteps}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{lesson.dishName}</p>

      <div className="mt-6 flex flex-1 flex-col justify-center">
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-5">
          <h3 className="text-lg font-bold text-emerald-900">{step.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-emerald-900/80">{step.description}</p>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === stepIndex
                  ? "w-6 bg-emerald-500"
                  : i < stepIndex
                    ? "w-1.5 bg-emerald-300"
                    : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" className="rounded-full" onClick={onPrev}>
          <ArrowLeft className="mr-1 size-4" />
          {stepIndex === 0 ? "Voltar" : "Anterior"}
        </Button>
        <Button
          className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600"
          onClick={onNext}
        >
          {isLast ? (
            <>
              Testar conhecimentos
              <Check className="ml-2 size-4" />
            </>
          ) : (
            <>
              Seguinte
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function optionVariant(
  selected: boolean,
  isAnswer: boolean,
  showFeedback: boolean,
  isCorrect: boolean,
) {
  if (showFeedback && selected && isCorrect) return "border-emerald-500 bg-emerald-50";
  if (showFeedback && selected && !isCorrect) return "border-rose-500 bg-rose-50";
  if (showFeedback && !selected && isAnswer) return "border-emerald-400 bg-emerald-50/50";
  return "border-border bg-card hover:border-emerald-300";
}

/** `choice` e `judge`: a diferença é só a imagem por cima das opções. */
function ChoiceExercise({
  question,
  selectedAnswer,
  showFeedback,
  isCorrect,
  correctAnswer,
  isChecking,
  onSubmit,
}: {
  question: Question;
  selectedAnswer: AnswerValue | null;
  showFeedback: boolean;
  isCorrect: boolean;
  correctAnswer: AnswerValue | null;
  isChecking: boolean;
  onSubmit: (answer: AnswerValue) => void;
}) {
  return (
    <>
      {question.type === "judge" && question.imageUrl && (
        <img src={question.imageUrl} alt="" className="mb-4 h-44 w-full rounded-2xl object-cover" />
      )}

      {question.options?.map((option) => (
        <button
          key={option}
          type="button"
          disabled={showFeedback || isChecking}
          onClick={() => onSubmit(option)}
          className={cn(
            "rounded-2xl border-2 px-4 py-4 text-left text-sm font-medium transition-colors",
            optionVariant(
              selectedAnswer === option,
              option === correctAnswer,
              showFeedback,
              isCorrect,
            ),
          )}
        >
          {option}
        </button>
      ))}
    </>
  );
}

/**
 * `order`: toca-se nos passos pela ordem certa. Nada de arrastar — num
 * telemóvel, com uma mão, arrastar falha mais do que acerta.
 */
function OrderExercise({
  question,
  showFeedback,
  isChecking,
  onSubmit,
}: {
  question: Question;
  showFeedback: boolean;
  isChecking: boolean;
  onSubmit: (answer: AnswerValue) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const items = question.items ?? [];

  // Mudar de pergunta limpa a escolha; sem isto a ordem do exercício
  // anterior aparecia já preenchida no seguinte.
  useEffect(() => setPicked([]), [question.id]);

  const remaining = items.filter((item) => !picked.includes(item));
  const complete = picked.length === items.length && items.length > 0;

  return (
    <>
      <div className="rounded-2xl border-2 border-dashed border-border p-3">
        {picked.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Toca nos passos pela ordem certa
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {picked.map((item, index) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {remaining.map((item) => (
          <button
            key={item}
            type="button"
            disabled={showFeedback || isChecking}
            onClick={() => setPicked((current) => [...current, item])}
            className="rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-emerald-300"
          >
            {item}
          </button>
        ))}
      </div>

      {picked.length > 0 && !showFeedback && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setPicked([])}
            disabled={isChecking}
          >
            <Undo2 className="size-4" />
            Recomeçar
          </Button>
          <Button
            className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600"
            disabled={!complete || isChecking}
            onClick={() => onSubmit(picked)}
          >
            Confirmar ordem
          </Button>
        </div>
      )}
    </>
  );
}

/** `estimate`: um número dentro de uma margem. Não se pede exatidão. */
function EstimateExercise({
  question,
  showFeedback,
  isChecking,
  onSubmit,
}: {
  question: Question;
  showFeedback: boolean;
  isChecking: boolean;
  onSubmit: (answer: AnswerValue) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => setValue(""), [question.id]);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed);

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          disabled={showFeedback || isChecking}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-2xl font-bold outline-none"
        />
        <span className="shrink-0 text-sm font-medium text-muted-foreground">{question.unit}</span>
      </div>

      {question.tolerance !== undefined && (
        <p className="text-xs text-muted-foreground">
          Aceita-se uma margem de ±{question.tolerance} {question.unit}. Estima, não decores.
        </p>
      )}

      {!showFeedback && (
        <Button
          className="rounded-full bg-emerald-500 hover:bg-emerald-600"
          disabled={!valid || isChecking}
          onClick={() => onSubmit(parsed)}
        >
          Confirmar
        </Button>
      )}
    </>
  );
}

function formatAnswer(answer: AnswerValue | null, unit?: string) {
  if (answer === null) return "";
  if (Array.isArray(answer)) return answer.map((step, i) => `${i + 1}. ${step}`).join("  ·  ");
  if (typeof answer === "number") return unit ? `${answer} ${unit}` : String(answer);
  return answer;
}

function LessonQuiz({
  dishName,
  question,
  questionIndex,
  totalQuestions,
  selectedAnswer,
  showFeedback,
  isCorrect,
  correctAnswer,
  explainWrong,
  explanation,
  isChecking,
  hearts,
  onSubmit,
  onNext,
}: {
  dishName: string;
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selectedAnswer: AnswerValue | null;
  showFeedback: boolean;
  isCorrect: boolean;
  correctAnswer: AnswerValue | null;
  explainWrong: string | null;
  explanation: string | null;
  isChecking: boolean;
  hearts: number;
  onSubmit: (answer: AnswerValue) => void;
  onNext: () => void;
}) {
  // Nos tipos em que a resposta não é uma das opções visíveis, mostrar qual
  // era a certa só faz sentido no painel de feedback.
  const showCorrectInFeedback =
    showFeedback && !isCorrect && (question.type === "order" || question.type === "estimate");

  return (
    <div className="flex flex-1 flex-col px-4 pb-6 pt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
        Quiz · {dishName}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Pergunta {questionIndex + 1} de {totalQuestions}
      </p>
      <h2 className="mt-3 text-xl font-bold leading-snug">{question.prompt}</h2>

      <div className="mt-6 flex flex-1 flex-col gap-3">
        {(question.type === "choice" || question.type === "judge") && (
          <ChoiceExercise
            question={question}
            selectedAnswer={selectedAnswer}
            showFeedback={showFeedback}
            isCorrect={isCorrect}
            correctAnswer={correctAnswer}
            isChecking={isChecking}
            onSubmit={onSubmit}
          />
        )}

        {question.type === "order" && (
          <OrderExercise
            question={question}
            showFeedback={showFeedback}
            isChecking={isChecking}
            onSubmit={onSubmit}
          />
        )}

        {question.type === "estimate" && (
          <EstimateExercise
            question={question}
            showFeedback={showFeedback}
            isChecking={isChecking}
            onSubmit={onSubmit}
          />
        )}
      </div>

      {showFeedback && (
        <div
          className={cn(
            "mt-4 rounded-2xl p-4",
            isCorrect ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900",
          )}
        >
          <p className="font-semibold">{isCorrect ? "Correto!" : "Ups…"}</p>

          {/* Quando se erra, o que aparece primeiro é o porquê do erro — não a
              resposta certa. É a diferença entre ensinar e avaliar. */}
          {!isCorrect && explainWrong && <p className="mt-1 text-sm font-medium">{explainWrong}</p>}

          {showCorrectInFeedback && (
            <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-sm">
              <span className="font-semibold">Resposta certa: </span>
              {formatAnswer(correctAnswer, question.unit)}
            </p>
          )}

          <p className="mt-2 text-sm opacity-90">{explanation}</p>

          <Button
            className="mt-3 w-full rounded-full bg-emerald-500 hover:bg-emerald-600"
            onClick={onNext}
            disabled={!isCorrect && hearts <= 0}
          >
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
}
