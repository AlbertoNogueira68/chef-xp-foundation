import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChefMascot, ChefSpeech } from "@/components/ChefMascot";
import { chefFeedbackLine } from "@/lib/chefLines";
import type { useReview } from "@/features/challenges/hooks/useReview";
import { ChoiceExercise, EstimateExercise, OrderExercise } from "./exercises";
import { formatAnswer } from "@/lib/answers";
import { t } from "@/i18n";

type Review = ReturnType<typeof useReview>;

/**
 * A sessão de revisão.
 *
 * É a lição sem o que a lição tem de primeira vez: não há apresentação, não há
 * preparação, não há corações. Só as perguntas, uma a uma, e a explicação de
 * cada uma no fim — que é a parte que interessa numa revisão.
 *
 * Os exercícios são os mesmos de `exercises.tsx`, os mesmos que a lição usa.
 * Se um dia o exercício de ordenar mudar, muda nos dois sítios de uma vez.
 */
export function ReviewSession({ review }: { review: Review }) {
  if (review.completion) return <ReviewComplete review={review} />;

  const item = review.item;
  if (!item) return null;

  const { question } = item;

  // Nos tipos em que a resposta certa não é uma das opções visíveis, mostrá-la
  // só faz sentido no painel de explicação.
  const mostrarCerta =
    review.showFeedback &&
    !review.isCorrect &&
    (question.type === "order" || question.type === "estimate");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={review.close}
          aria-label={t("Leave the review")}
          className="rounded-full p-1 hover:bg-muted"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t("Review progress")}
          aria-valuenow={Math.round(review.progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${review.progress}%` }}
          />
        </div>
        {/* Onde a lição tem corações, a revisão tem a contagem: aqui não há
            nada a perder, e mostrar vidas dava a entender o contrário. */}
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {review.index + 1}/{review.total}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-sky-600">{t("Review")}</p>
        {item.lessonTitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("From: {lesson}", { lesson: item.lessonTitle })}
          </p>
        )}

        <ChefSpeech className="mt-3" size="sm" title={t("Still know this one?")}>
          <h2 className="text-lg font-bold leading-snug">{question.prompt}</h2>
        </ChefSpeech>

        <div className="mt-6 flex flex-col gap-3">
          {(question.type === "choice" || question.type === "judge") && (
            <ChoiceExercise
              question={question}
              selectedAnswer={review.selectedAnswer}
              showFeedback={review.showFeedback}
              isCorrect={review.isCorrect}
              correctAnswer={review.correctAnswer}
              isChecking={review.isChecking}
              onSubmit={review.submitAnswer}
            />
          )}

          {question.type === "order" && (
            <OrderExercise
              question={question}
              showFeedback={review.showFeedback}
              isChecking={review.isChecking}
              onSubmit={review.submitAnswer}
            />
          )}

          {question.type === "estimate" && (
            <EstimateExercise
              question={question}
              showFeedback={review.showFeedback}
              isChecking={review.isChecking}
              onSubmit={review.submitAnswer}
            />
          )}
        </div>

        {review.showFeedback && (
          /* `aria-live`: a correção aparece sem que nada mude de foco, e quem
             ouve a página não tem como saber que ela apareceu. */
          <div className="mt-4" role="status" aria-live="polite">
            <ChefSpeech
              tone={review.isCorrect ? "certo" : "errado"}
              mood={review.isCorrect ? "aprovar" : "erro"}
              size="sm"
              title={chefFeedbackLine(review.isCorrect, `${question.id}!${review.index}`)}
            >
              {!review.isCorrect && review.explainWrong && (
                <p className="font-medium">{review.explainWrong}</p>
              )}

              {mostrarCerta && (
                <p className="mt-2 rounded-xl bg-white/60 px-3 py-2">
                  <span className="font-semibold">{t("Correct answer:")} </span>
                  {formatAnswer(review.correctAnswer, question.unit)}
                </p>
              )}

              <p className="mt-2">{review.explanation}</p>
            </ChefSpeech>
          </div>
        )}
      </div>

      {review.showFeedback && (
        <div className="shrink-0 border-t border-border/60 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <Button
            className="w-full rounded-full bg-sky-500 hover:bg-sky-600"
            onClick={review.next}
            disabled={review.isFinishing}
          >
            {review.index + 1 < review.total ? t("Continue") : t("Finish review")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** O fim da sessão: o que se acertou, e o que isso valeu. */
function ReviewComplete({ review }: { review: Review }) {
  const { completion } = review;
  if (!completion) return null;

  const tudoCerto = completion.correct === completion.total;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <ChefMascot
        size="xl"
        mood={tudoCerto ? "celebrar" : "aprovar"}
        className="ring-4 ring-sky-100"
      />

      <h2 className="mt-4 text-xl font-bold">{t("Review done")}</h2>

      <p className="mt-2 text-sm text-muted-foreground">
        {t("{correct} of {total} right", {
          correct: completion.correct,
          total: completion.total,
        })}
      </p>

      {completion.paid ? (
        <p className="mt-4 flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">
          <Sparkles className="size-4" aria-hidden="true" />
          {t("+{xp} XP", { xp: completion.xpEarned })}
        </p>
      ) : (
        /* Sem isto, uma segunda revisão no mesmo dia mostrava "+0 XP" e
           parecia que o trabalho se tinha perdido. Perdeu-se o XP, não o
           trabalho: as perguntas foram todas para mais longe no calendário. */
        <p className="mt-4 max-w-xs rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          {t(
            "Today's review XP was already paid — but these answers still count towards what comes back, and when.",
          )}
        </p>
      )}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <Button
          className="rounded-full bg-sky-500 hover:bg-sky-600"
          onClick={review.close}
          autoFocus
        >
          <Check className="mr-2 size-4" aria-hidden="true" />
          {t("Back to the path")}
        </Button>
        {review.due > review.total && (
          <Button variant="ghost" className="rounded-full" onClick={review.open}>
            <RotateCcw className="mr-2 size-4" aria-hidden="true" />
            {t("Review {count} more", { count: review.due - review.total })}
          </Button>
        )}
      </div>
    </div>
  );
}
