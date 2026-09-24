import { useRef, useState } from "react";
import { Camera, CalendarDays, ImagePlus, Plus, Trash2, Trophy, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChallenges,
  useCreateChallenge,
  useDeleteChallenge,
  useSettleChallenge,
} from "@/features/challenges/hooks/useChallenges";
import type { Challenge, ChallengeDraft } from "@/types/challenge";
import { fileToResizedDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * O rascunho começa no desafio que a maior parte das pessoas quer criar: uma
 * semana, uma foto, XP modesto por participar e um pódio que se nota. Quem
 * quiser outra coisa muda os números; quem não quiser pensar neles tem uma
 * resposta razoável já escrita.
 */
const DRAFT_INICIAL: ChallengeDraft = {
  title: "",
  description: "",
  xpReward: 100,
  maxEntriesPerUser: 1,
  durationDays: 7,
  firstPlaceXp: 300,
  secondPlaceXp: 200,
  thirdPlaceXp: 100,
};

function Numero({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    // As três colunas alinham pela caixa e não pelo topo do rótulo: "XP por
    // participar" ocupa duas linhas e "Dias" uma, e sem uma altura mínima
    // comum os campos ficavam em degraus.
    <div className="flex flex-col">
      <Label className="flex min-h-8 items-start text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9"
      />
      {hint && <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** O formulário de criação. Fechado por omissão: a lista é o que se vem ver. */
function Formulario({ onDone }: { onDone: () => void }) {
  const [draft, setDraft] = useState<ChallengeDraft>(DRAFT_INICIAL);
  const fileInput = useRef<HTMLInputElement>(null);
  const create = useCreateChallenge();

  const podeGravar = draft.title.trim().length >= 3 && draft.description.trim().length >= 10;

  function set<K extends keyof ChallengeDraft>(campo: K, valor: ChallengeDraft[K]) {
    setDraft((anterior) => ({ ...anterior, [campo]: valor }));
  }

  /**
   * A capa é redimensionada no browser antes de subir, como na publicação de
   * receitas: o cartão do desafio é quase todo imagem, e uma fotografia de
   * telemóvel em tamanho original são dez megabytes para mostrar 16:9.
   */
  async function escolherImagem(event: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = event.target.files?.[0];
    event.target.value = "";
    if (!ficheiro) return;

    try {
      set("imageDataUrl", await fileToResizedDataUrl(ficheiro));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Couldn't use that image"));
    }
  }

  async function gravar() {
    await create.mutateAsync(draft);
    setDraft(DRAFT_INICIAL);
    onDone();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">{t("Cover")}</Label>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={escolherImagem}
        />
        {draft.imageDataUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border/60">
            <img src={draft.imageDataUrl} alt="" className="aspect-video w-full object-cover" />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 size-8 rounded-full"
              aria-label={t("Remove photo")}
              onClick={() => set("imageDataUrl", null)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-20 w-full rounded-xl border-dashed text-xs text-muted-foreground"
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus className="mr-1.5 size-4" />
            {t("Add a cover")}
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="challenge-title" className="text-xs font-semibold">
          {t("Title")}
        </Label>
        <Input
          id="challenge-title"
          value={draft.title}
          maxLength={120}
          placeholder={t("A week of soups")}
          onChange={(event) => set("title", event.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="challenge-description" className="text-xs font-semibold">
          {t("Description")}
        </Label>
        <Textarea
          id="challenge-description"
          value={draft.description}
          maxLength={2000}
          rows={3}
          placeholder={t("What do people have to cook, and what counts as a good entry?")}
          onChange={(event) => set("description", event.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Numero
          label={t("XP to enter")}
          value={draft.xpReward}
          min={0}
          max={1000}
          onChange={(valor) => set("xpReward", valor)}
          hint={t("Paid once per person")}
        />
        <Numero
          label={t("Photos each")}
          value={draft.maxEntriesPerUser}
          min={1}
          max={10}
          onChange={(valor) => set("maxEntriesPerUser", valor)}
          hint={t("1 to 10")}
        />
        <Numero
          label={t("Days")}
          value={draft.durationDays}
          min={1}
          max={90}
          onChange={(valor) => set("durationDays", valor)}
          hint={t("1 to 90")}
        />
      </div>

      <div>
        <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold">
          <Trophy className="size-3.5 text-amber-500" />
          {t("Podium")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Numero
            label={t("1st")}
            value={draft.firstPlaceXp}
            min={0}
            max={5000}
            onChange={(valor) => set("firstPlaceXp", valor)}
          />
          <Numero
            label={t("2nd")}
            value={draft.secondPlaceXp}
            min={0}
            max={5000}
            onChange={(valor) => set("secondPlaceXp", valor)}
          />
          <Numero
            label={t("3rd")}
            value={draft.thirdPlaceXp}
            min={0}
            max={5000}
            onChange={(valor) => set("thirdPlaceXp", valor)}
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
          {t("At the end, whoever has the most likes wins. A tie pays the same to everyone tied.")}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t("Cancel")}
        </Button>
        <Button size="sm" disabled={!podeGravar || create.isPending} onClick={gravar}>
          {create.isPending ? t("Creating…") : t("Create challenge")}
        </Button>
      </div>
    </div>
  );
}

function Estado({ challenge }: { challenge: Challenge }) {
  if (challenge.active) {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        {t("Running")}
      </span>
    );
  }
  if (challenge.settledAt) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {t("Closed")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
      {t("To be counted")}
    </span>
  );
}

function Cartao({ challenge }: { challenge: Challenge }) {
  const settle = useSettleChallenge();
  const remove = useDeleteChallenge();

  // Terminado mas ainda por liquidar: o agendador chega lá sozinho, e este
  // botão é só para quem não quer esperar pela próxima passagem.
  const porFechar = !challenge.active && !challenge.settledAt;

  return (
    <article className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{challenge.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {challenge.description}
          </p>
        </div>
        <Estado challenge={challenge} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Zap className="size-3" />+{challenge.xpReward} XP
        </span>
        <span className="inline-flex items-center gap-1">
          <Camera className="size-3" />
          {challenge.maxEntriesPerUser}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3" />
          {t("{count}d", { count: challenge.durationDays })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" />
          {challenge.participantsCount}
        </span>
        <span className="inline-flex items-center gap-1 text-amber-600">
          <Trophy className="size-3" />
          {challenge.podiumXp.join(" · ")}
        </span>
      </div>

      <div className="mt-2.5 flex justify-end gap-2">
        {porFechar && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-xs"
            disabled={settle.isPending}
            onClick={() => settle.mutate(challenge.id)}
          >
            <Trophy className="mr-1.5 size-3.5" />
            {t("Close and pay")}
          </Button>
        )}
        {/* Apagar só aparece enquanto o desafio não é de ninguém: o servidor
            recusa-o a partir da primeira submissão, e um botão que responde
            sempre com um erro é pior do que botão nenhum. */}
        {challenge.participantsCount === 0 && !challenge.settledAt && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-full text-xs text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(challenge.id)}
          >
            <Trash2 className="mr-1.5 size-3.5" />
            {t("Delete")}
          </Button>
        )}
      </div>
    </article>
  );
}

/**
 * Os desafios, do lado de quem os cria.
 *
 * Moderadores e administradores: um desafio é conteúdo da comunidade, da
 * mesma família do que o moderador já trata. A lista é a mesma que toda a
 * gente vê — não há uma lista de administração à parte para manter a par.
 */
export function ChallengeManager() {
  const { data: challenges, isLoading, isError } = useChallenges();
  const [aCriar, setACriar] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{t("Challenges")}</p>
          <p className="text-xs text-muted-foreground">
            {t("You set the XP, the photos per person and how many days it runs.")}
          </p>
        </div>
        {!aCriar && (
          <Button size="sm" className="rounded-full" onClick={() => setACriar(true)}>
            <Plus className="mr-1.5 size-4" />
            {t("New")}
          </Button>
        )}
      </div>

      {aCriar && <Formulario onDone={() => setACriar(false)} />}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("Couldn't load the challenges.")}
        </p>
      )}

      {!isLoading && challenges?.length === 0 && (
        <p
          className={cn(
            "rounded-xl border border-dashed border-border",
            "px-4 py-8 text-center text-sm text-muted-foreground",
          )}
        >
          {t("No challenges yet. Create the first one.")}
        </p>
      )}

      <div className="space-y-2">
        {challenges?.map((challenge) => (
          <Cartao key={challenge.id} challenge={challenge} />
        ))}
      </div>
    </div>
  );
}
