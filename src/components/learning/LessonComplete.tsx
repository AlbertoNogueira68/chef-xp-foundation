import { CloudUpload, Sparkles, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChefMascot, ChefSpeech } from "@/components/ChefMascot";
import { chefCompleteLine } from "@/lib/chefLines";

export function LessonComplete({
  xpEarned,
  lessonTitle,
  porEnviar = false,
  onContinue,
}: {
  xpEarned: number;
  lessonTitle: string;
  /** A lição acabou sem rede: está guardada, à espera de ser enviada. */
  porEnviar?: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      {/* Quem dá os parabéns é o chef que deu a lição — a taça fica ao lado,
          como um crachá, e não no lugar dele. */}
      <div className="relative mb-6">
        {/* Sem rede ainda não há XP para festejar: o chef só celebra quando o
            servidor confirmou. */}
        <ChefMascot
          size="xl"
          mood={porEnviar ? "aprovar" : "celebrar"}
          className="shadow-lg shadow-amber-500/20 ring-4 ring-amber-100"
        />
        <div className="absolute -bottom-1 -right-1 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-md">
          <Trophy className="size-5 text-white" />
        </div>
        <Sparkles className="absolute -right-2 -top-2 size-8 text-amber-400" />
        <Sparkles className="absolute -bottom-1 -left-3 size-6 text-orange-400" />
      </div>

      <h2 className="text-2xl font-bold">Lição concluída!</h2>
      <p className="mt-1 text-sm text-muted-foreground">{lessonTitle}</p>

      <ChefSpeech className="mt-5 w-full max-w-xs text-left" size="xs">
        {chefCompleteLine(lessonTitle)}
      </ChefSpeech>

      {/* Sem rede não se anuncia XP nenhum: quem corrige é o servidor, e ele
          ainda não viu as respostas. Prometer um número aqui era arriscar
          desmenti-lo dali a cinco minutos. */}
      {porEnviar ? (
        <div className="mt-6 max-w-xs space-y-2 rounded-2xl bg-stone-100 px-5 py-3 text-stone-700">
          <p className="flex items-center justify-center gap-2 font-semibold">
            <CloudUpload className="size-5" />
            Guardado neste dispositivo
          </p>
          <p className="text-sm">
            As tuas respostas vão para o servidor assim que houver rede. É aí que a correção e o XP
            aparecem — mesmo que feches a app.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2.5 text-amber-800">
          <Zap className="size-5" />
          <span className="text-lg font-bold">+{xpEarned} XP</span>
        </div>
      )}

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
