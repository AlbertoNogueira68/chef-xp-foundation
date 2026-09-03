import { Skeleton } from "@/components/ui/skeleton";
import { LearningHeader } from "./LearningHeader";
import { LessonRow } from "./LessonRow";
import { MissionCard } from "./MissionCard";
import { UnitBanner } from "./UnitBanner";
import type { LearningPath, Skill } from "@/types/learning";

export function LearningPathView({
  path,
  isLoading,
  onLessonClick,
  onStartMission,
}: {
  path?: LearningPath;
  isLoading: boolean;
  onLessonClick: (lessonId: string) => void;
  onStartMission?: (missionId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!path) return null;

  const skills: Map<string, Skill> = new Map(path.skills.map((skill) => [skill.id, skill]));
  const learnedIds = new Set(path.progress.learnedSkills);

  // Só contam as competências que alguma lição ensina. O catálogo tem também
  // as das unidades por escrever, e pô-las no denominador dava um contador
  // que nunca fechava.
  const teachableSkills = new Set(
    path.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.teaches ?? [])),
  );

  return (
    <div className="space-y-5 pb-8">
      <LearningHeader progress={path.progress} skillCount={teachableSkills.size} />

      {path.units.map((unit, unitIndex) => {
        // As competências da unidade são as que as suas lições ensinam — não
        // o catálogo inteiro, senão o contador nunca fechava.
        const unitSkills = [...new Set(unit.lessons.flatMap((lesson) => lesson.teaches ?? []))];
        const lessonsDone = unit.lessons.filter((l) => l.status === "completed").length;
        const lessonsLeft = unit.lessons.length - lessonsDone;

        return (
          <section key={unit.id} className="space-y-3">
            <UnitBanner
              index={unitIndex + 1}
              title={unit.title}
              subtitle={unit.subtitle}
              color={unit.color}
              lessonsDone={lessonsDone}
              lessonsTotal={unit.lessons.length}
              skillsDone={unitSkills.filter((id) => learnedIds.has(id)).length}
              skillsTotal={unitSkills.length}
            />

            <ol className="flex flex-col">
              {unit.lessons.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  skills={skills}
                  learnedIds={learnedIds}
                  isLast={index === unit.lessons.length - 1}
                  onClick={onLessonClick}
                />
              ))}
            </ol>

            {unit.mission && (
              <MissionCard
                mission={unit.mission}
                skills={skills}
                unlocked={lessonsLeft === 0}
                lessonsLeft={lessonsLeft}
                onStart={onStartMission}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
