import type { UserRole } from "./user";

/** Os números da plataforma, todos somados na hora sobre as tabelas reais. */
export interface PlatformMetrics {
  contas: number;
  contasUltimos7Dias: number;
  contasConfirmadas: number;
  equipa: number;
  ativosUltimos7Dias: number;
  receitas: number;
  receitasUltimos7Dias: number;
  comentarios: number;
  gostos: number;
  licoesConcluidas: number;
  missoesConcluidas: number;
  desafiosAtivos: number;
  denunciasAbertas: number;
  denunciasTotal: number;
  bloqueios: number;
  xpDistribuido: number;
}

/** Uma conta vista pela administração — com o que decide uma promoção ao lado. */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  photoUrl: string | null;
  level: number;
  xp: number;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  recipes: number;
  reportsReceived: number;
}

export type ReportStatus = "open" | "resolved" | "dismissed";

/** O conteúdo denunciado, quando ainda existe. */
export type ReportSubject =
  | { kind: "recipe"; title: string; imageUrl: string | null; author: string }
  | { kind: "comment"; body: string; author: string }
  | { kind: "user"; username: string };

export interface ModerationReport {
  id: string;
  subjectType: "recipe" | "comment" | "user";
  subjectId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolution: "removido" | "arquivado" | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reportedBy: string;
  /** Quantas denúncias existem sobre o mesmo alvo — uma decisão fecha-as todas. */
  reportsOnSubject: number;
  /** `null` quando o conteúdo já foi apagado: a denúncia sobrevive-lhe. */
  subject: ReportSubject | null;
}
