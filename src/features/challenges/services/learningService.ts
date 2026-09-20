import { apiFetch } from "@/services/api";
import type {
  AnswerResult,
  AnswerValue,
  LearningPath,
  Lesson,
  LessonCompletion,
  LessonStatus,
} from "@/types/learning";

/**
 * Todo o percurso passou a viver no servidor.
 *
 * Antes isto era um módulo que lia e escrevia em `localStorage`: o progresso
 * não sincronizava entre dispositivos, era editável pela consola do browser e
 * não dava para construir rankings. Agora o localStorage não é usado de todo.
 */
export const learningService = {
  getPath(trailId?: string): Promise<LearningPath> {
    const url = trailId
      ? `/learning/path?trailId=${encodeURIComponent(trailId)}`
      : "/learning/path";
    return apiFetch<LearningPath>(url);
  },

  async getProgress(trailId?: string) {
    const url = trailId
      ? `/learning/progress?trailId=${encodeURIComponent(trailId)}`
      : "/learning/progress";
    const data = await apiFetch<{ progress: LearningPath["progress"] }>(url);
    return data.progress;
  },

  async getLesson(id: string, trailId?: string): Promise<{ lesson: Lesson; status: LessonStatus }> {
    const url = trailId
      ? `/learning/lessons/${id}?trailId=${encodeURIComponent(trailId)}`
      : `/learning/lessons/${id}`;
    return apiFetch<{ lesson: Lesson; status: LessonStatus }>(url);
  },

  /** Corrige uma resposta. Quem decide é o servidor. */
  checkAnswer(
    lessonId: string,
    questionId: string,
    answer: AnswerValue,
    trailId?: string,
  ): Promise<AnswerResult> {
    const url = trailId
      ? `/learning/lessons/${lessonId}/answer?trailId=${encodeURIComponent(trailId)}`
      : `/learning/lessons/${lessonId}/answer`;
    return apiFetch<AnswerResult>(url, {
      method: "POST",
      body: JSON.stringify({ questionId, answer }),
    });
  },

  /** Fecha a lição. O servidor volta a corrigir tudo antes de pagar XP. */
  completeLesson(
    lessonId: string,
    answers: Array<{ questionId: string; answer: AnswerValue }>,
    trailId?: string,
  ): Promise<LessonCompletion> {
    const url = trailId
      ? `/learning/lessons/${lessonId}/complete?trailId=${encodeURIComponent(trailId)}`
      : `/learning/lessons/${lessonId}/complete`;
    return apiFetch<LessonCompletion>(url, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  },
};
