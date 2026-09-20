import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  CloudUpload,
  Lightbulb,
  ListChecks,
  Undo2,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { AnswerValue, Lesson, LessonPlayerPhase, Question } from "@/types/learning";
import type { PrepItem } from "@/features/challenges/hooks/useLessonPlayer";
import { LessonComplete } from "./LessonComplete";
import { ChefMascot, ChefSpeech } from "@/components/ChefMascot";
import {
  chefFailedLine,
  chefFeedbackLine,
  chefGreeting,
  chefPrepLine,
  chefQuizLine,
} from "@/lib/chefLines";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const difficultyLabel = (nivel: string) =>
  ({ facil: t("Easy"), medio: t("Medium"), dificil: t("Hard") })[nivel] ?? nivel;

export function LessonPlayer({
  lesson,
  phase,
  currentQuestion,
  currentPrepStep,
  prepStepIndex,
  prepStepCount,
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
  semCorrecao,
  porEnviar,
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
  currentPrepStep: PrepItem | null;
  prepStepIndex: number;
  /** Passos de preparação mais dicas do Chef. */
  prepStepCount: number;
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
  /** A resposta atual ficou por corrigir — não havia rede. */
  semCorrecao: boolean;
  /** A lição terminou sem rede e está na caixa de saída. */
  porEnviar: boolean;
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
        <LessonComplete
          xpEarned={xpEarned}
          lessonTitle={lesson.dishName}
          porEnviar={porEnviar}
          onContinue={onContinue}
        />
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <ChefMascot size="xl" mood="triste" className="ring-4 ring-rose-100" />
        <h2 className="mt-4 text-xl font-bold">{t("Out of lives!")}</h2>
        <ChefSpeech
          tone="errado"
          size="xs"
          mood="triste"
          className="mt-4 w-full max-w-xs text-left"
        >
          {chefFailedLine(lesson.dishName)}
        </ChefSpeech>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
          <Button className="rounded-full bg-emerald-500 hover:bg-emerald-600" onClick={onRetry}>
            <RotateCcw className="mr-2 size-4" />
            {t("Try again")}
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={onClose}>
            {t("Back to the path")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 w-full flex-col overflow-hidden">
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
          totalSteps={prepStepCount}
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
          semCorrecao={semCorrecao}
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
  const tipCount = lesson.tips?.length ?? 0;

  return (
    <div
      className="flex flex-1 flex-col min-h-0 px-4 pb-6 pt-4"
      style={{
        overflowY: "scroll",
        WebkitOverflowScrolling: "touch",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Badge className="mb-2 w-fit rounded-full border-0 bg-emerald-100 text-emerald-800">
        {lesson.type === "chest"
          ? t("Bonus")
          : lesson.type === "boss"
            ? t("Review")
            : t("Day {day}", { day: lesson.dayNumber })}
      </Badge>
      <h2 className="text-2xl font-bold leading-tight">{lesson.dishName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{lesson.description}</p>

      <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
          <Clock className="size-3" /> {lesson.cookTimeMin} min
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">
          {difficultyLabel(lesson.difficulty)}
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
          +{lesson.xpReward} XP
        </span>
      </div>

      <ChefSpeech className="mt-4" size="sm">
        {chefGreeting(lesson.dishName)}
      </ChefSpeech>

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
          {t("Ingredients")}
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
        {[
          t("{count} prep steps", { count: lesson.preparationSteps.length }),
          tipCount > 0 &&
            t(tipCount === 1 ? "{count} Chef tip" : "{count} Chef tips", { count: tipCount }),
          t("{count} questions", { count: lesson.questions.length }),
        ]
          .filter(Boolean)
          .join(" + ")}
      </p>

      <Button
        className="mt-6 w-full rounded-full bg-emerald-500 py-6 text-base font-semibold hover:bg-emerald-600"
        onClick={onStart}
      >
        {t("Start prep")}
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
  step: PrepItem;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
}) {
  const isLast = stepIndex >= totalSteps - 1;
  const stepCount = lesson.preparationSteps.length;

  return (
    <div className="flex flex-1 flex-col px-4 pb-6 pt-4">
      {step.isTip ? (
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-amber-600">
          <Lightbulb className="size-3.5" />
          Dica do Chef · {stepIndex - stepCount + 1} de {totalSteps - stepCount}
        </p>
      ) : (
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
          {t("Prep · Step {step} of {total}", { step: stepIndex + 1, total: stepCount })}
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">{lesson.dishName}</p>

      <div className="mt-6 flex flex-1 flex-col justify-center">
        {/* O passo é o chef a dizê-lo, não um cartão de texto: é a mesma
            informação, mas com alguém a ensiná-la. */}
        {/* As dicas são para guardar, não para responder: não há pergunta nem
            corações atrás delas. */}
        <ChefSpeech tone={step.isTip ? "neutro" : "certo"} size="lg" title={step.title}>
          <p>{step.description}</p>
          {!step.isTip && (
            <p className="mt-2 text-xs italic opacity-70">
              {chefPrepLine(lesson.dishName, stepIndex)}
            </p>
          )}
        </ChefSpeech>

        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === stepIndex
                  ? i >= stepCount
                    ? "w-6 bg-amber-500"
                    : "w-6 bg-emerald-500"
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
          {stepIndex === 0 ? t("Back") : t("Previous")}
        </Button>
        <Button
          className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600"
          onClick={onNext}
        >
          {isLast ? (
            <>
              {t("Test what you know")}
              <Check className="ml-2 size-4" />
            </>
          ) : (
            <>
              {t("Next")}
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
            {t("Tap the steps in the right order")}
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
            {t("Start over")}
          </Button>
          <Button
            className="flex-1 rounded-full bg-emerald-500 hover:bg-emerald-600"
            disabled={!complete || isChecking}
            onClick={() => onSubmit(picked)}
          >
            {t("Confirm order")}
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
          {t("Anything within ±{tolerance} {unit} counts. Estimate, don't memorise.", {
            tolerance: question.tolerance ?? 0,
            unit: question.unit ?? "",
          })}
        </p>
      )}

      {!showFeedback && (
        <Button
          className="rounded-full bg-emerald-500 hover:bg-emerald-600"
          disabled={!valid || isChecking}
          onClick={() => onSubmit(parsed)}
        >
          {t("Confirm")}
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
  semCorrecao,
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
  semCorrecao: boolean;
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
        {t("Quiz · {dish}", { dish: dishName })}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t("Question {number} of {total}", { number: questionIndex + 1, total: totalQuestions })}
      </p>

      {/* Quem pergunta é o chef. O enunciado continua a ser o cabeçalho da
          pergunta para quem ouve a página — só mudou quem o diz. */}
      <ChefSpeech className="mt-3" size="sm" title={chefQuizLine(dishName, questionIndex)}>
        <h2 className="text-lg font-bold leading-snug">{question.prompt}</h2>
      </ChefSpeech>

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

      {showFeedback && semCorrecao && (
        <div className="mt-4">
          {/* Nem "certo" nem "errado": quem corrige é o servidor, e ele não
              está ao alcance. Inventar um dos dois seria pior do que esperar. */}
          <ChefSpeech
            tone="calmo"
            size="sm"
            title={
              <span className="flex items-center gap-2">
                <CloudUpload className="size-4" />
                {t("Answer saved")}
              </span>
            }
          >
            {t(
              "With no connection, marking waits until you're back online. Carry on with the lesson — this costs you no lives.",
            )}
          </ChefSpeech>
          <Button
            className="mt-3 w-full rounded-full bg-emerald-500 hover:bg-emerald-600"
            onClick={onNext}
          >
            {t("Continue")}
          </Button>
        </div>
      )}

      {showFeedback && !semCorrecao && (
        <div className="mt-4">
          <ChefSpeech
            tone={isCorrect ? "certo" : "errado"}
            mood={isCorrect ? "aprovar" : "erro"}
            size="sm"
            title={chefFeedbackLine(isCorrect, `${dishName}!${questionIndex}`)}
          >
            {/* Quando se erra, o que aparece primeiro é o porquê do erro — não
                a resposta certa. É a diferença entre ensinar e avaliar. */}
            {!isCorrect && explainWrong && <p className="font-medium">{explainWrong}</p>}

            {showCorrectInFeedback && (
              <p className="mt-2 rounded-xl bg-white/60 px-3 py-2">
                <span className="font-semibold">{t("Correct answer:")}</span>
                {formatAnswer(correctAnswer, question.unit)}
              </p>
            )}

            <p className="mt-2">{explanation}</p>
          </ChefSpeech>

          <Button
            className="mt-3 w-full rounded-full bg-emerald-500 hover:bg-emerald-600"
            onClick={onNext}
            disabled={!isCorrect && hearts <= 0}
          >
            {t("Continue")}
          </Button>
        </div>
      )}
    </div>
  );
}
