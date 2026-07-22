import { LEARNING_CURRICULUM } from "@/constants/learningCurriculum";
import { delay } from "@/constants/demo";
import type {
  LearningPath,
  LearningProgress,
  LearningUnitWithStatus,
  Lesson,
  LessonStatus,
  LessonWithStatus,
} from "@/types/learning";

const STORAGE_KEY = "chef-xp:learning-progress";

const DEFAULT_PROGRESS: LearningProgress = {
  completedLessonIds: [],
  dailyXp: 0,
  dailyXpGoal: 50,
  streak: 3,
  lastActiveDate: new Date().toISOString().slice(0, 10),
};

function loadProgress(): LearningProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as LearningProgress;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const streak =
        parsed.lastActiveDate === yesterdayStr ? parsed.streak + 1 : parsed.lastActiveDate ? 1 : 1;
      return { ...parsed, dailyXp: 0, streak, lastActiveDate: today };
    }
    return { ...DEFAULT_PROGRESS, ...parsed };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

function saveProgress(progress: LearningProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function getAllLessons(): Lesson[] {
  return LEARNING_CURRICULUM.flatMap((u) => u.lessons);
}

function computeStatuses(completedIds: string[]): Map<string, LessonStatus> {
  const statuses = new Map<string, LessonStatus>();
  const all = getAllLessons();
  let foundCurrent = false;

  for (const lesson of all) {
    if (completedIds.includes(lesson.id)) {
      statuses.set(lesson.id, "completed");
    } else if (!foundCurrent) {
      statuses.set(lesson.id, "current");
      foundCurrent = true;
    } else {
      statuses.set(lesson.id, "locked");
    }
  }

  if (!foundCurrent && all.length > 0) {
    const last = all[all.length - 1];
    statuses.set(last.id, "completed");
  }

  return statuses;
}

function buildPath(progress: LearningProgress): LearningPath {
  const statuses = computeStatuses(progress.completedLessonIds);

  const units: LearningUnitWithStatus[] = LEARNING_CURRICULUM.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map(
      (lesson): LessonWithStatus => ({
        ...lesson,
        status: statuses.get(lesson.id) ?? "locked",
      }),
    ),
  }));

  return { units, progress };
}

export const learningService = {
  async getPath(): Promise<LearningPath> {
    await delay(200);
    return buildPath(loadProgress());
  },

  async getLesson(id: string): Promise<Lesson | null> {
    await delay(100);
    return getAllLessons().find((l) => l.id === id) ?? null;
  },

  async completeLesson(id: string, xpEarned: number): Promise<LearningPath> {
    await delay(150);
    const progress = loadProgress();
    if (!progress.completedLessonIds.includes(id)) {
      progress.completedLessonIds = [...progress.completedLessonIds, id];
      progress.dailyXp = Math.min(progress.dailyXp + xpEarned, progress.dailyXpGoal + 50);
      progress.lastActiveDate = new Date().toISOString().slice(0, 10);
      saveProgress(progress);
    }
    return buildPath(progress);
  },

  getProgress(): LearningProgress {
    return loadProgress();
  },
};
