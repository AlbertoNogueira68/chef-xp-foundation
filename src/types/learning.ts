export type LessonStatus = "locked" | "available" | "current" | "completed";
export type LessonNodeType = "lesson" | "chest" | "boss";
export type QuestionType = "choice" | "order" | "judge" | "estimate";

/**
 * O que o utilizador entrega como resposta. `choice` e `judge` mandam texto,
 * `order` manda a sequência de passos, `estimate` manda um número.
 */
export type AnswerValue = string | number | string[];
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
  /** Competências que este exercício exercita. */
  skills?: string[];

  /** `choice` e `judge`. */
  options?: string[];
  /** `judge`: a imagem que se está a avaliar. */
  imageUrl?: string;
  /** `order`: os passos, já baralhados pelo servidor. */
  items?: string[];
  /** `estimate`: a unidade que se pede e a margem aceite. */
  unit?: string;
  tolerance?: number;

  correctAnswer?: AnswerValue;
  explanation?: string;
  explainWrong?: string;
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
  /** Competências que a lição ensina e que exige (ids). */
  teaches?: string[];
  requires?: string[];
}

export interface LessonWithStatus extends Lesson {
  status: LessonStatus;
}

export type SkillCategory = "faca" | "calor" | "tempero" | "ponto" | "seguranca" | "organizacao";

/** Uma competência do currículo, já com nome legível. */
export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
}

export type RescueKind = "queimei" | "cola" | "falta" | "pronto";

export const RESCUE_LABELS: Record<RescueKind, string> = {
  queimei: "Queimei",
  cola: "Está a colar",
  falta: "Não tenho isto",
  pronto: "Não sei se está pronto",
};

/**
 * Um passo da missão. As respostas de socorro não vêm aqui — só os tipos,
 * para o painel saber que botões desenhar. O texto vem do servidor quando se
 * carrega no botão, e é isso que faz o pedido ficar registado.
 */
export interface MissionStep {
  id: string;
  index: number;
  title: string;
  description: string;
  durationSec?: number;
  checkpoint?: boolean;
  rescues: Array<{ kind: RescueKind }>;
}

/** A missão que fecha uma unidade: é onde se cozinha a sério. */
export interface Mission {
  id: string;
  unitId: string;
  title: string;
  dishName: string;
  cookTimeMin: number;
  summary: string;
  practices: string[];
  xpReward?: number;
  ingredients?: string[];
  steps?: MissionStep[];
}

export interface MissionRun {
  id: number;
  missionId: string;
  status: "in_progress" | "completed" | "abandoned";
  currentStep: number;
  startedAt: string;
  completedAt: string | null;
  resultImage: string | null;
  shared: boolean;
}

export interface MissionCheckpoint {
  stepIndex: number;
  imageUrl: string;
  feedback: string | null;
}

export interface MissionRunState {
  run: MissionRun;
  mission: Mission & { steps: MissionStep[]; ingredients: string[]; xpReward: number };
  checkpoints: MissionCheckpoint[];
  resumed?: boolean;
}

export interface MissionCompletion {
  completed: boolean;
  resultImage: string;
  xpEarned: number;
  streakBonus: number;
  streak: number;
  totalXp: number;
  level: number;
  practisedSkills: Array<{ skillId: string; times: number }>;
  post: { id: number; imageUrl: string } | null;
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
  mission: Mission | null;
  lessons: LessonWithStatus[];
}

export interface LearningProgress {
  completedLessonIds: string[];
  /** Competências ensinadas pelas lições já concluídas. */
  learnedSkills: string[];
  dailyXp: number;
  dailyXpGoal: number;
  streak: number;
  lastActiveDate: string | null;
}

export interface LearningPath {
  units: LearningUnitWithStatus[];
  skills: Skill[];
  progress: LearningProgress;
}

/** Resultado da correção de uma resposta, devolvido pelo servidor. */
export interface AnswerResult {
  questionId: string;
  correct: boolean;
  correctAnswer: AnswerValue;
  explanation: string;
  /** Porque é que a resposta dada está errada. `null` quando se acertou. */
  explainWrong: string | null;
  skills?: string[];
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

