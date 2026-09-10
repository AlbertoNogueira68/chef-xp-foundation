/** ISO: 1 = segunda … 7 = domingo. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PlanDayStatus = "free" | "planned" | "done" | "missed";

export interface CookingPlan {
  /** Vazio = "n vezes por semana, quando calhar". */
  weekdays: Weekday[];
  targetWeek: number;
  /** O dia em que este compromisso passou a existir. Nada antes conta como falhado. */
  startedOn: string | null;
  updatedAt: string;
}

export interface PlanDay {
  date: string;
  weekday: Weekday;
  label: string;
  isToday: boolean;
  status: PlanDayStatus;
}

export interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  target: number;
  done: number;
  missed: number;
  remaining: number;
  complete: boolean;
  cookedToday: boolean;
  todayIsPlanned: boolean;
  nextDate: string | null;
  days: PlanDay[];
}

export interface PlanState {
  plan: CookingPlan | null;
  summary: WeekSummary | null;
  /** A frase da faixa. Decidida no servidor, onde vive a regra do compromisso. */
  message: string | null;
  today?: string;
}

export interface PlanInput {
  weekdays: Weekday[];
  targetWeek: number;
}
