import { useEffect, useState } from "react";
import { useTrails, useUserTrails, useStartTrail } from "@/hooks/useTrails";
import type { Trail, UserTrail } from "@/hooks/useTrails";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Play, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/i18n";

const DIFFICULTY_COLORS = {
  beginner: "emerald",
  intermediate: "amber",
  advanced: "rose",
} as const;

const DIFFICULTY_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
} as const;

interface TrailCardProps {
  trail: Trail;
  userTrail?: UserTrail;
  isSelected: boolean;
  isEnrolled: boolean;
  onSelect: (trailId: string) => void;
}

function TrailCard({ trail, userTrail, isSelected, isEnrolled, onSelect }: TrailCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const startTrail = useStartTrail();

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      await startTrail.mutateAsync(trail.id);
      toast.success(t("Welcome to {name}!", { name: trail.name }));
      onSelect(trail.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to start trail"));
    } finally {
      setIsLoading(false);
    }
  };

  const getBackgroundColor = () => {
    if (isSelected) return "bg-blue-50 dark:bg-blue-950 border-2 border-blue-500";
    if (isEnrolled) return "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700";
    return "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-60";
  };

  return (
    <button
      onClick={() => isEnrolled && onSelect(trail.id)}
      disabled={!isEnrolled && !isSelected}
      className={`relative w-full p-4 rounded-xl transition-all text-left ${getBackgroundColor()} ${
        isEnrolled && !isSelected ? "hover:shadow-md cursor-pointer" : ""
      } ${!isEnrolled && !isSelected ? "cursor-not-allowed" : ""}`}
    >
      {/* Header com ícone e título */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl">{trail.icon || "🏛️"}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm sm:text-base">{trail.name}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {DIFFICULTY_LABELS[trail.difficulty]}
            </p>
          </div>
        </div>

        {/* Status icon */}
        {!isEnrolled && !isSelected && <Lock className="w-4 h-4 text-slate-400" />}
        {isSelected && <ChevronRight className="w-5 h-5 text-blue-500" />}
      </div>

      {/* Description */}
      {trail.description && (
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
          {trail.description}
        </p>
      )}

      {/* CTA Button */}
      {!isEnrolled ? (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleStart}
          disabled={isLoading}
        >
          {isLoading ? t("Starting...") : t("Start")}
        </Button>
      ) : isSelected ? (
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
          {t("Active trail")}
        </span>
      ) : (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => onSelect(trail.id)}>
          <Play className="w-3 h-3 mr-1" />
          {t("Switch")}
        </Button>
      )}
    </button>
  );
}

interface TrailSelectorProps {
  onSelect?: (trailId: string) => void;
  currentTrailId?: string;
}

export function TrailSelector({ onSelect, currentTrailId = "main-course" }: TrailSelectorProps) {
  const { data: trails, isLoading: trailsLoading } = useTrails();
  const { data: userTrails, isLoading: userTrailsLoading } = useUserTrails();
  const [selectedTrailId, setSelectedTrailId] = useState(currentTrailId);

  useEffect(() => {
    setSelectedTrailId(currentTrailId);
  }, [currentTrailId]);

  const handleSelect = (trailId: string) => {
    setSelectedTrailId(trailId);
    onSelect?.(trailId);
  };

  if (trailsLoading || userTrailsLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!trails || trails.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-600 dark:text-slate-400">{t("No trails available yet")}</p>
      </div>
    );
  }

  const userTrailIds = new Set(userTrails?.map((t) => t.id) ?? []);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {trails.map((trail) => (
          <TrailCard
            key={trail.id}
            trail={trail}
            userTrail={userTrails?.find((ut) => ut.id === trail.id)}
            isSelected={selectedTrailId === trail.id}
            isEnrolled={userTrailIds.has(trail.id)}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
