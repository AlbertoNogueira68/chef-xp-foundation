export type LessonStatus = "locked" | "available" | "current" | "completed";
export type LessonNodeType = "lesson" | "chest" | "boss";
export type QuestionType = "multiple_choice" | "true_false";
export type LessonPlayerPhase = "intro" | "prep" | "quiz" | "failed" | "complete";

/**
 * `correctAnswer` e `explanation` são opcionais porque a API NÃO os envia
 * quando entrega a lição: o currículo vive em `shared/curriculum.json`, que só
 * o servidor lê. Só aparecem preenchidos na resposta a
 * `POST /learning/lessons/:id/answer`, ou seja, depois de o utilizador já ter
 * respondido.
 */
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
}

export interface PreparationStep {
  title: string;
  description: string;
}

export interface Lesson {
  id: string;
  dayNumber: number;
  title: string;
  dishName: string;
  description: string;
  type: LessonNodeType;
  xpReward: number;
  icon: string;
  imageUrl: string;
  cookTimeMin: number;
  difficulty: "facil" | "medio" | "dificil";
  ingredients: string[];
  preparationSteps: PreparationStep[];
  questions: Question[];
}

export interface LessonWithStatus extends Lesson {
  status: LessonStatus;
}

export interface LearningUnit {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  lessons: Lesson[];
}

export interface LearningUnitWithStatus {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  lessons: LessonWithStatus[];
}

export interface LearningProgress {
  completedLessonIds: string[];
  dailyXp: number;
  dailyXpGoal: number;
  streak: number;
  lastActiveDate: string | null;
}

export interface LearningPath {
  units: LearningUnitWithStatus[];
  progress: LearningProgress;
}

/** Resultado da correção de uma resposta, devolvido pelo servidor. */
export interface AnswerResult {
  questionId: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
}

/** Resultado de concluir uma lição. */
export interface LessonCompletion {
  passed: boolean;
  alreadyCompleted?: boolean;
  heartsLeft: number;
  xpEarned: number;
  streakBonus?: number;
  streak?: number;
  totalXp?: number;
  level?: number;
  path?: LearningPath;
}
