import { Sparkles, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LessonComplete({
  xpEarned,
  lessonTitle,
  onContinue,
}: {
  xpEarned: number;
  lessonTitle: string;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-6">
        <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/30">
          <Trophy className="size-12 text-white" />
        </div>
        <Sparkles className="absolute -right-2 -top-2 size-8 text-amber-400" />
        <Sparkles className="absolute -bottom-1 -left-3 size-6 text-orange-400" />
      </div>

      <h2 className="text-2xl font-bold">Lição concluída!</h2>
      <p className="mt-1 text-sm text-muted-foreground">{lessonTitle}</p>

      <div className="mt-6 flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2.5 text-amber-800">
        <Zap className="size-5" />
        <span className="text-lg font-bold">+{xpEarned} XP</span>
      </div>

      <Button
        className="mt-10 w-full max-w-xs rounded-full bg-emerald-500 font-semibold hover:bg-emerald-600"
        size="lg"
        onClick={onContinue}
      >
        Continuar
      </Button>
    </div>
  );
}
