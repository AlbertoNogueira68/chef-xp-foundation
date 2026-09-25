import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUpdateRecipe } from "@/features/feed/hooks/useRecipes";
import { fileToResizedDataUrl } from "@/lib/image";
import { DIETARY_TAGS } from "@/constants/dietaryTags";
import type { DietaryTag, Recipe, RecipeDifficulty, RecipeUpdateInput } from "@/types/recipe";
import { t } from "@/i18n";

/**
 * Editar uma receita já publicada.
 *
 * Vai só o que mudou: um PATCH com tudo faria o servidor regravar a fotografia
 * a cada correção de uma vírgula no título.
 */
export function EditRecipeDialog({
  recipe,
  open,
  onOpenChange,
}: {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateRecipe(recipe.id);
  const fileInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description);
  const [ingredients, setIngredients] = useState(recipe.ingredients);
  const [cookTimeMin, setCookTimeMin] = useState(recipe.cookTimeMin);
  const [difficulty, setDifficulty] = useState<RecipeDifficulty>(recipe.difficulty);
  const [costInput, setCostInput] = useState(recipe.estimatedCostEur?.toString() ?? "");
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>(recipe.dietaryTags);
  const [image, setImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [processing, setProcessing] = useState(false);

  const toggleDietaryTag = (tag: DietaryTag) => {
    setDietaryTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  };

  // Reabrir mostra o que está guardado, não o rascunho da vez anterior.
  useEffect(() => {
    if (!open) return;
    setTitle(recipe.title);
    setDescription(recipe.description);
    setIngredients(recipe.ingredients);
    setCookTimeMin(recipe.cookTimeMin);
    setDifficulty(recipe.difficulty);
    setCostInput(recipe.estimatedCostEur?.toString() ?? "");
    setDietaryTags(recipe.dietaryTags);
    setImage(null);
    setRemoveImage(false);
  }, [open, recipe]);

  const pickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing(true);
    try {
      setImage(await fileToResizedDataUrl(file));
      setRemoveImage(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Couldn't use that image"));
    } finally {
      setProcessing(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const patch: RecipeUpdateInput = {};
    if (title.trim() !== recipe.title) patch.title = title.trim();
    if (description.trim() !== recipe.description) patch.description = description.trim();
    if (ingredients.trim() !== recipe.ingredients) patch.ingredients = ingredients.trim();
    if (cookTimeMin !== recipe.cookTimeMin) patch.cookTimeMin = cookTimeMin;
    if (difficulty !== recipe.difficulty) patch.difficulty = difficulty;

    const trimmedCost = costInput.trim();
    const nextCost = trimmedCost === "" ? null : Number(trimmedCost);
    if (nextCost !== recipe.estimatedCostEur) patch.estimatedCostEur = nextCost;

    const tagsChanged =
      JSON.stringify([...dietaryTags].sort()) !== JSON.stringify([...recipe.dietaryTags].sort());
    if (tagsChanged) patch.dietaryTags = dietaryTags;

    // `null` retira a fotografia; ausente mantém a que lá está.
    if (image) patch.imageDataUrl = image;
    else if (removeImage) patch.imageDataUrl = null;

    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }

    update.mutate(patch, { onSuccess: () => onOpenChange(false) });
  };

  const preview = image ?? (removeImage ? null : recipe.imageUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>{t("Edit recipe")}</DialogTitle>
          <DialogDescription>
            {t("XP already earned doesn't change when you edit.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("Photo")}</Label>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickImage}
            />
            {preview ? (
              <div className="relative overflow-hidden rounded-xl border border-border/60">
                <img src={preview} alt="" className="aspect-video w-full object-cover" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 size-8 rounded-full"
                  aria-label={t("Remove photo")}
                  onClick={() => {
                    setImage(null);
                    setRemoveImage(true);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                disabled={processing}
                onClick={() => fileInput.current?.click()}
              >
                {processing ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1.5 size-4" />
                )}
                Escolher fotografia
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-title">{t("Title")}</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={3}
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-description">{t("Description")}</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              minLength={10}
              maxLength={2000}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-ingredients">{t("Ingredients")}</Label>
            <Textarea
              id="edit-ingredients"
              value={ingredients}
              onChange={(event) => setIngredients(event.target.value)}
              rows={5}
              minLength={5}
              maxLength={4000}
              required
            />
            <p className="text-[11px] text-muted-foreground">{t("One per line.")}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-time">{t("Time (min)")}</Label>
              <Input
                id="edit-time"
                type="number"
                min={5}
                max={600}
                value={cookTimeMin}
                onChange={(event) => setCookTimeMin(Number(event.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-difficulty">{t("Difficulty")}</Label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as RecipeDifficulty)}
              >
                <SelectTrigger id="edit-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facil">{t("Easy")}</SelectItem>
                  <SelectItem value="medio">{t("Medium")}</SelectItem>
                  <SelectItem value="dificil">{t("Hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-cost">{t("Estimated cost (€)")}</Label>
            <Input
              id="edit-cost"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              placeholder={t("Optional")}
              value={costInput}
              onChange={(event) => setCostInput(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("Dietary preferences")}</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_TAGS.map((tag) => {
                const active = dietaryTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDietaryTag(tag.id)}
                    className="flex h-9 shrink-0 items-center"
                  >
                    <Badge
                      variant={active ? "default" : "secondary"}
                      className="rounded-full px-3 py-1.5 text-xs font-medium"
                    >
                      {t(tag.label)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={update.isPending}>
            {update.isPending ? t("Saving…") : t("Save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
