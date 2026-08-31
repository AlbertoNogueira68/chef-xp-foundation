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
  getPath(): Promise<LearningPath> {
    return apiFetch<LearningPath>("/learning/path");
  },

  async getProgress() {
    const data = await apiFetch<{ progress: LearningPath["progress"] }>("/learning/progress");
    return data.progress;
  },

  async getLesson(id: string): Promise<{ lesson: Lesson; status: LessonStatus }> {
    return apiFetch<{ lesson: Lesson; status: LessonStatus }>(`/learning/lessons/${id}`);
  },

  /** Corrige uma resposta. Quem decide é o servidor. */
  checkAnswer(lessonId: string, questionId: string, answer: AnswerValue): Promise<AnswerResult> {
    return apiFetch<AnswerResult>(`/learning/lessons/${lessonId}/answer`, {
      method: "POST",
      body: JSON.stringify({ questionId, answer }),
    });
  },

  /** Fecha a lição. O servidor volta a corrigir tudo antes de pagar XP. */
  completeLesson(
    lessonId: string,
    answers: Array<{ questionId: string; answer: AnswerValue }>,
  ): Promise<LessonCompletion> {
    return apiFetch<LessonCompletion>(`/learning/lessons/${lessonId}/complete`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  },
};
