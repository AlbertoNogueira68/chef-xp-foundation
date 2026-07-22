import { useCallback, useMemo, useState } from "react";
import type { Lesson, LessonPlayerPhase, Question } from "@/types/learning";
import { learningService } from "../services/learningService";
import { useInvalidateLearningPath } from "./useLearningPath";

const MAX_HEARTS = 3;

export function useLessonPlayer() {
  const invalidatePath = useInvalidateLearningPath();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [phase, setPhase] = useState<LessonPlayerPhase>("intro");
  const [prepStepIndex, setPrepStepIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  const currentQuestion: Question | null = lesson?.questions[questionIndex] ?? null;
  const currentPrepStep = lesson?.preparationSteps[prepStepIndex] ?? null;

  const totalSteps = useMemo(() => {
    if (!lesson) return 1;
    return 1 + lesson.preparationSteps.length + lesson.questions.length;
  }, [lesson]);

  const progress = useMemo(() => {
    if (!lesson) return 0;
    let done = 0;
    if (phase === "intro") return (1 / totalSteps) * 100;
    if (phase === "prep") done = 1 + prepStepIndex + 1;
    if (phase === "quiz") done = 1 + lesson.preparationSteps.length + questionIndex + (showFeedback ? 1 : 0);
    if (phase === "complete") return 100;
    return (done / totalSteps) * 100;
  }, [lesson, phase, prepStepIndex, questionIndex, showFeedback, totalSteps]);

  const resetSession = useCallback((loaded: Lesson) => {
    setLesson(loaded);
    setPhase("intro");
    setPrepStepIndex(0);
    setQuestionIndex(0);
    setHearts(MAX_HEARTS);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setXpEarned(0);
  }, []);

  const openLesson = useCallback(
    async (lessonId: string) => {
      const loaded = await learningService.getLesson(lessonId);
      if (!loaded) return;
      resetSession(loaded);
    },
    [resetSession],
  );

  const closeLesson = useCallback(() => {
    setLesson(null);
    setPhase("intro");
  }, []);

  const startPreparation = useCallback(() => {
    setPhase("prep");
    setPrepStepIndex(0);
  }, []);

  const nextPrepStep = useCallback(() => {
    if (!lesson) return;
    if (prepStepIndex >= lesson.preparationSteps.length - 1) {
      setPhase("quiz");
      setQuestionIndex(0);
      return;
    }
    setPrepStepIndex((i) => i + 1);
  }, [lesson, prepStepIndex]);

  const prevPrepStep = useCallback(() => {
    if (prepStepIndex <= 0) {
      setPhase("intro");
      return;
    }
    setPrepStepIndex((i) => i - 1);
  }, [prepStepIndex]);

  const submitAnswer = useCallback(
    (answer: string) => {
      if (!lesson || !currentQuestion || showFeedback || phase !== "quiz") return;

      const correct = answer === currentQuestion.correctAnswer;
      setSelectedAnswer(answer);
      setIsCorrect(correct);
      setShowFeedback(true);

      if (!correct) {
        const newHearts = hearts - 1;
        setHearts(newHearts);
        if (newHearts <= 0) {
          setTimeout(() => setPhase("failed"), 800);
        }
      }
    },
    [lesson, currentQuestion, showFeedback, phase, hearts],
  );

  const nextQuestion = useCallback(async () => {
    if (!lesson || phase !== "quiz") return;

    const isLast = questionIndex >= lesson.questions.length - 1;

    if (isLast) {
      if (hearts > 0) {
        setXpEarned(lesson.xpReward);
        await learningService.completeLesson(lesson.id, lesson.xpReward);
        invalidatePath();
        setPhase("complete");
      }
      return;
    }

    setQuestionIndex((i) => i + 1);
    setSelectedAnswer(null);
    setShowFeedback(false);
  }, [lesson, phase, questionIndex, hearts, invalidatePath]);

  const retryLesson = useCallback(() => {
    if (!lesson) return;
    resetSession(lesson);
  }, [lesson, resetSession]);

  return {
    lesson,
    phase,
    currentQuestion,
    currentPrepStep,
    prepStepIndex,
    questionIndex,
    hearts,
    maxHearts: MAX_HEARTS,
    selectedAnswer,
    showFeedback,
    isCorrect,
    progress,
    xpEarned,
    openLesson,
    closeLesson,
    startPreparation,
    nextPrepStep,
    prevPrepStep,
    submitAnswer,
    nextQuestion,
    retryLesson,
    isOpen: lesson !== null,
  };
}
