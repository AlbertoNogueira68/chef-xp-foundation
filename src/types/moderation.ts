/** O que se pode denunciar, e porquê. A mesma lista que o servidor aceita. */
export type ReportSubjectType = "recipe" | "comment" | "user";

export type ReportReason = "spam" | "ofensivo" | "perigoso" | "copia" | "outro";

export interface ReportInput {
  subjectType: ReportSubjectType;
  subjectId: string;
  reason: ReportReason;
  details?: string | null;
}

/** Uma linha da lista de contas bloqueadas — só o meu lado do bloqueio. */
export interface BlockedUser {
  id: string;
  username: string;
  photoUrl: string | null;
  level: number;
  blockedAt: string;
}
