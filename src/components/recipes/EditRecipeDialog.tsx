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
import { useUpdateRecipe } from "@/features/feed/hooks/useRecipes";
import { fileToResizedDataUrl } from "@/lib/image";
import type { Recipe, RecipeDifficulty, RecipeUpdateInput } from "@/types/recipe";

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
  const [image, setImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Reabrir mostra o que está guardado, não o rascunho da vez anterior.
  useEffect(() => {
    if (!open) return;
    setTitle(recipe.title);
    setDescription(recipe.description);
    setIngredients(recipe.ingredients);
    setCookTimeMin(recipe.cookTimeMin);
    setDifficulty(recipe.difficulty);
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
      toast.error(error instanceof Error ? error.message : "Não foi possível usar essa imagem");
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
          <DialogTitle>Editar receita</DialogTitle>
          <DialogDescription>O XP já ganho não muda com as correções.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fotografia</Label>
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
                  aria-label="Retirar fotografia"
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
            <Label htmlFor="edit-title">Título</Label>
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
            <Label htmlFor="edit-description">Descrição</Label>
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
            <Label htmlFor="edit-ingredients">Ingredientes</Label>
            <Textarea
              id="edit-ingredients"
              value={ingredients}
              onChange={(event) => setIngredients(event.target.value)}
              rows={5}
              minLength={5}
              maxLength={4000}
              required
            />
            <p className="text-[11px] text-muted-foreground">Um por linha.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-time">Tempo (min)</Label>
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
              <Label htmlFor="edit-difficulty">Dificuldade</Label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as RecipeDifficulty)}
              >
                <SelectTrigger id="edit-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facil">Fácil</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="dificil">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={update.isPending}>
            {update.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
