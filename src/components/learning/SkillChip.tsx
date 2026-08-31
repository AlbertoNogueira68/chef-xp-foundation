import type { Skill, SkillCategory } from "@/types/learning";
import { cn } from "@/lib/utils";

/**
 * Cada categoria tem a sua cor. Não é decoração: ao fim de duas unidades a
 * cor diz de relance se a lição é de faca, de calor ou de tempero.
 */
const CATEGORY_STYLE: Record<SkillCategory, string> = {
  faca: "bg-slate-100 text-slate-700 ring-slate-200",
  calor: "bg-orange-50 text-orange-700 ring-orange-200",
  tempero: "bg-violet-50 text-violet-700 ring-violet-200",
  ponto: "bg-amber-50 text-amber-800 ring-amber-200",
  seguranca: "bg-rose-50 text-rose-700 ring-rose-200",
  organizacao: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function SkillChip({
  skill,
  learned = false,
  muted = false,
}: {
  skill: Skill;
  learned?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      title={skill.description}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        muted ? "bg-muted text-muted-foreground ring-border" : CATEGORY_STYLE[skill.category],
        learned && "ring-2",
      )}
    >
      {skill.name}
    </span>
  );
}

export function SkillChips({
  ids,
  skills,
  learnedIds,
  muted,
  max = 3,
}: {
  ids: string[];
  skills: Map<string, Skill>;
  learnedIds?: Set<string>;
  muted?: boolean;
  max?: number;
}) {
  const resolved = ids.map((id) => skills.get(id)).filter((s): s is Skill => Boolean(s));
  if (resolved.length === 0) return null;

  const shown = resolved.slice(0, max);
  const hidden = resolved.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((skill) => (
        <SkillChip key={skill.id} skill={skill} muted={muted} learned={learnedIds?.has(skill.id)} />
      ))}
      {hidden > 0 && <span className="text-[10px] text-muted-foreground">+{hidden}</span>}
    </div>
  );
}
