import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, FileWarning, Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdminTrails,
  useCreateTrail,
  useDeleteTrail,
  usePublishTrail,
  useTrailDetail,
  useUnpublishTrail,
  useUpdateTrail,
} from "@/features/admin/hooks/useAdminTrails";
import {
  TrailValidationError,
  type AdminTrail,
  type TrailDifficulty,
} from "@/features/admin/services/trailAdminService";
import { t } from "@/i18n";

const DIFFICULTIES: TrailDifficulty[] = ["beginner", "intermediate", "advanced"];

/** Chaves literais, para o dicionário as encontrar na leitura do código. */
function rotulo(dificuldade: TrailDifficulty) {
  if (dificuldade === "beginner") return t("Beginner");
  if (dificuldade === "intermediate") return t("Intermediate");
  return t("Advanced");
}

const CURRICULUM_PLACEHOLDER = `{
  "skills": [ … ],
  "units": [ { "id": "…", "lessons": [ … ], "missionId": "…" } ],
  "missions": [ … ]
}`;

function Estado({ trail }: { trail: AdminTrail }) {
  if (!trail.loaded) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
        <FileWarning className="size-3" />
        {t("Curriculum failed to load")}
      </span>
    );
  }
  if (trail.published_at) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        <Eye className="size-3" />
        {t("Published")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
      <EyeOff className="size-3" />
      {t("Draft")}
    </span>
  );
}

function Cartao({ trail, onEdit }: { trail: AdminTrail; onEdit: () => void }) {
  const publish = usePublishTrail();
  const unpublish = useUnpublishTrail();
  const remove = useDeleteTrail();
  const [aConfirmar, setAConfirmar] = useState(false);

  const ocupado = publish.isPending || unpublish.isPending || remove.isPending;

  async function corre(accao: () => Promise<unknown>, sucesso: string) {
    try {
      await accao();
      toast.success(sucesso);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("That didn't work"));
    }
  }

  return (
    <li className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">{trail.icon ?? "📘"}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{trail.name}</p>
            {!trail.admin_authored && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                title={t("This trail's curriculum lives in the repository")}
              >
                <Lock className="size-3" />
                {t("In code")}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{trail.description}</p>
          <div className="mt-1 flex items-center gap-3">
            <Estado trail={trail} />
            <span className="text-[11px] text-muted-foreground">{rotulo(trail.difficulty)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {trail.published_at ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full text-xs"
            disabled={ocupado}
            onClick={() =>
              corre(
                () => unpublish.mutateAsync(trail.id),
                t("{name} is a draft again", { name: trail.name }),
              )
            }
          >
            {t("Unpublish")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-full text-xs"
            // Publicar um trilho cujo currículo não carregou punha um cartão
            // no ecrã que dava erro ao ser aberto.
            disabled={ocupado || !trail.loaded}
            onClick={() =>
              corre(() => publish.mutateAsync(trail.id), t("{name} is live", { name: trail.name }))
            }
          >
            {t("Publish")}
          </Button>
        )}

        {trail.admin_authored && !aConfirmar && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-xs"
            disabled={ocupado}
            onClick={onEdit}
          >
            <Pencil className="mr-1 size-3" />
            {t("Edit")}
          </Button>
        )}

        {trail.admin_authored &&
          (aConfirmar ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-full text-xs"
                disabled={ocupado}
                onClick={() =>
                  corre(
                    () => remove.mutateAsync(trail.id),
                    t("{name} deleted", { name: trail.name }),
                  )
                }
              >
                {t("Really delete")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-xs"
                onClick={() => setAConfirmar(false)}
              >
                {t("Cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-xs text-muted-foreground"
              disabled={ocupado}
              onClick={() => setAConfirmar(true)}
            >
              <Trash2 className="mr-1 size-3" />
              {t("Delete")}
            </Button>
          ))}
      </div>
    </li>
  );
}

/**
 * Criar um trilho sem tocar no código.
 *
 * Os metadados são um formulário; o currículo entra em JSON. Não é um editor
 * visual — as perguntas têm quatro tipos e as missões têm passos com socorros,
 * e um construtor a sério para isso é outro trabalho. O que esta caixa dá, e
 * um ficheiro no repositório não dava, é a validação inteira do servidor de
 * volta no ecrã, antes de gravar e sem deploy nenhum.
 */
function Formulario({ editar, onDone }: { editar?: AdminTrail; onDone: () => void }) {
  const criar = useCreateTrail();
  const actualizar = useUpdateTrail();
  const existente = useTrailDetail(editar?.id ?? null);

  const [erros, setErros] = useState<string[]>([]);
  const [campos, setCampos] = useState({
    id: editar?.id ?? "",
    name: editar?.name ?? "",
    description: editar?.description ?? "",
    icon: editar?.icon ?? "",
    difficulty: editar?.difficulty ?? ("beginner" as TrailDifficulty),
    curriculum: "",
  });
  // O currículo chega depois do resto do formulário; enchê-lo à chegada
  // evita um segundo estado só para saber se já veio.
  const [curriculumCarregado, setCurriculumCarregado] = useState(!editar);

  if (!curriculumCarregado && existente.data) {
    setCurriculumCarregado(true);
    if (existente.data.curriculum) {
      setCampos((anterior) => ({
        ...anterior,
        curriculum: JSON.stringify(existente.data.curriculum, null, 2),
      }));
    }
  }

  const set = (chave: keyof typeof campos) => (valor: string) =>
    setCampos((anterior) => ({ ...anterior, [chave]: valor }));

  const aGravar = criar.isPending || actualizar.isPending;

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setErros([]);

    let curriculum: unknown;
    if (campos.curriculum.trim()) {
      try {
        curriculum = JSON.parse(campos.curriculum);
      } catch (error) {
        setErros([
          t("The curriculum isn't valid JSON: {reason}", { reason: (error as Error).message }),
        ]);
        return;
      }
    }

    try {
      if (editar) {
        await actualizar.mutateAsync({
          id: editar.id,
          patch: {
            name: campos.name.trim(),
            description: campos.description.trim() || undefined,
            icon: campos.icon.trim() || undefined,
            difficulty: campos.difficulty,
            curriculum,
          },
        });
        toast.success(t("{name} saved", { name: campos.name }));
      } else {
        await criar.mutateAsync({
          id: campos.id.trim(),
          name: campos.name.trim(),
          description: campos.description.trim() || undefined,
          icon: campos.icon.trim() || undefined,
          difficulty: campos.difficulty,
          curriculum,
        });
        toast.success(t("{name} created as a draft", { name: campos.name }));
      }
      onDone();
    } catch (error) {
      // A lista do validador é o que diz *o que* corrigir. Um toast só cabia
      // a primeira linha.
      if (error instanceof TrailValidationError) setErros(error.errors);
      else setErros([error instanceof Error ? error.message : t("That didn't work")]);
    }
  }

  return (
    <form onSubmit={submeter} className="space-y-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="trail-id" className="text-xs">
            {t("Identifier")}
          </Label>
          <Input
            id="trail-id"
            required
            // Mudar o id depois de criado órfãos o progresso de quem lá anda.
            disabled={Boolean(editar)}
            value={campos.id}
            onChange={(e) => set("id")(e.target.value)}
            placeholder="japanese-cooking"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title={t("Lowercase words joined by hyphens")}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="trail-name" className="text-xs">
            {t("Name")}
          </Label>
          <Input
            id="trail-name"
            required
            value={campos.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Japanese Cooking"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="trail-icon" className="text-xs">
            {t("Icon")}
          </Label>
          <Input
            id="trail-icon"
            value={campos.icon}
            onChange={(e) => set("icon")(e.target.value)}
            placeholder="🍱"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="trail-difficulty" className="text-xs">
            {t("Difficulty")}
          </Label>
          <Select
            value={campos.difficulty}
            onValueChange={(valor) => set("difficulty")(valor as TrailDifficulty)}
          >
            <SelectTrigger id="trail-difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((nivel) => (
                <SelectItem key={nivel} value={nivel}>
                  {rotulo(nivel)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="trail-description" className="text-xs">
          {t("Description")}
        </Label>
        <Input
          id="trail-description"
          value={campos.description}
          onChange={(e) => set("description")(e.target.value)}
          placeholder={t("One line on what this trail teaches")}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="trail-curriculum" className="text-xs">
          {t("Curriculum (JSON)")}
        </Label>
        <Textarea
          id="trail-curriculum"
          rows={10}
          spellCheck={false}
          className="font-mono text-xs"
          value={campos.curriculum}
          onChange={(e) => set("curriculum")(e.target.value)}
          placeholder={CURRICULUM_PLACEHOLDER}
        />
        <p className="text-[11px] text-muted-foreground">
          {t(
            "Leave it empty to save the metadata now and add the curriculum later. A trail can only be published once its curriculum loads.",
          )}
        </p>
      </div>

      {erros.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-2">
          {erros.map((erro) => (
            <li key={erro} className="text-[11px] text-destructive">
              {erro}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="rounded-full" disabled={aGravar}>
          {aGravar ? t("Saving…") : editar ? t("Save") : t("Create draft")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={onDone}
          disabled={aGravar}
        >
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}

type FormularioAberto = { modo: "criar" } | { modo: "editar"; trail: AdminTrail };

export function TrailManager() {
  const { data: trails, isLoading } = useAdminTrails();
  const [aberto, setAberto] = useState<FormularioAberto | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("A trail is only visible to learners once it's published.")}
        </p>
        {!aberto && (
          <Button
            size="sm"
            className="shrink-0 rounded-full text-xs"
            onClick={() => setAberto({ modo: "criar" })}
          >
            <Plus className="mr-1 size-3" />
            {t("New trail")}
          </Button>
        )}
      </div>

      {aberto && (
        // A `key` força um formulário novo ao trocar de trilho: sem ela, os
        // campos do anterior ficavam no ecrã.
        <Formulario
          key={aberto.modo === "editar" ? aberto.trail.id : "novo"}
          editar={aberto.modo === "editar" ? aberto.trail : undefined}
          onDone={() => setAberto(null)}
        />
      )}

      <ul className="space-y-2">
        {trails?.map((trail) => (
          <Cartao
            key={trail.id}
            trail={trail}
            onEdit={() => setAberto({ modo: "editar", trail })}
          />
        ))}
      </ul>
    </div>
  );
}
