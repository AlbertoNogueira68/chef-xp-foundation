export type LessonStatus = "locked" | "available" | "current" | "completed";
export type LessonNodeType = "lesson" | "chest" | "boss";
export type QuestionType = "multiple_choice" | "true_false";
export type LessonPlayerPhase = "intro" | "prep" | "quiz" | "failed" | "complete";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
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
