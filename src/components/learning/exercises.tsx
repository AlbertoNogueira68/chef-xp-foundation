import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnswerValue, Question } from "@/types/learning";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Os exercícios, e nada mais.
 *
 * Saíram do `LessonPlayer` quando a revisão espaçada apareceu: a sessão de
 * revisão faz exactamente as mesmas perguntas que a lição, e duplicar
 * duzentas linhas de interface de exercícios era garantir que as duas cópias
 * divergiam na primeira correção que alguém fizesse a uma delas.
 *
 * Não têm estado de lição nenhum — recebem uma pergunta e devolvem uma
 * resposta. Quem sabe se é uma lição ou uma revisão é quem os usa.
 */

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
export function ChoiceExercise({
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
export function OrderExercise({
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
        // Com muitos passos a lista empurra os botões para fora do ecrã;
        // colados ao fundo da área que rola, continuam a apanhar o toque.
        <div className="sticky bottom-0 z-10 flex gap-2 bg-background py-2">
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
export function EstimateExercise({
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
