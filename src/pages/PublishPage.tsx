import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRecipe } from "@/features/feed/hooks/useRecipes";
import { fileToResizedDataUrl } from "@/lib/image";

const schema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().min(10, "Conta um pouco mais sobre a receita"),
  ingredients: z.string().min(5, "Lista pelo menos alguns ingredientes"),
  cookTimeMin: z.coerce.number().min(5).max(300),
  difficulty: z.enum(["facil", "medio", "dificil"]),
});

type FormValues = z.infer<typeof schema>;

export function PublishPage() {
  const navigate = useNavigate();
  const create = useCreateRecipe();
  const fileInput = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      ingredients: "",
      cookTimeMin: 30,
      difficulty: "medio",
    },
  });

  const pickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessingImage(true);
    try {
      // Reduzida no browser antes de sair: o servidor recebe ~300 KB em vez
      // dos 8 MP originais da câmara.
      setImage(await fileToResizedDataUrl(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível usar essa imagem");
    } finally {
      setProcessingImage(false);
    }
  };

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { ...values, imageDataUrl: image },
      {
        onSuccess: ({ xpEarned }) => {
          toast.success(`Receita publicada! +${xpEarned} XP`);
          navigate("/feed");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  });

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Nova receita</h1>
          <p className="text-xs text-muted-foreground">Partilha com a comunidade</p>
        </div>
        <Badge className="rounded-full border-0 bg-amber-500/15 text-amber-700">
          <Sparkles className="mr-1 size-3" /> +25 XP
        </Badge>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={pickImage}
      />

      {image ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/60">
          <img
            src={image}
            alt="Pré-visualização da receita"
            className="aspect-[4/3] w-full object-cover"
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 size-8 rounded-full"
            aria-label="Remover imagem"
            onClick={() => setImage(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={processingImage}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50 text-muted-foreground transition-colors hover:border-amber-400"
        >
          <ImagePlus className="size-8 text-amber-500" />
          <span className="text-sm font-medium">
            {processingImage ? "A preparar imagem…" : "Adicionar fotografia"}
          </span>
          <span className="text-xs">JPEG, PNG ou WebP</span>
        </button>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            {...register("title")}
            placeholder="Ex: Tacos de frango crocante"
            className="rounded-xl"
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            rows={2}
            placeholder="Conta a história desta receita…"
            className="resize-none rounded-xl"
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ingredients">Ingredientes</Label>
          <Textarea
            id="ingredients"
            rows={3}
            placeholder={"200g frango\n1 cebola\n…"}
            className="resize-none rounded-xl"
            {...register("ingredients")}
          />
          {errors.ingredients && (
            <p className="text-xs text-destructive">{errors.ingredients.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cookTimeMin">Tempo (min)</Label>
            <Input
              id="cookTimeMin"
              type="number"
              className="rounded-xl"
              {...register("cookTimeMin")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Dificuldade</Label>
            <select
              id="difficulty"
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              {...register("difficulty")}
            >
              <option value="facil">Fácil</option>
              <option value="medio">Médio</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold shadow-lg shadow-orange-500/20"
          disabled={create.isPending || processingImage}
        >
          {create.isPending ? "A publicar…" : "Publicar receita"}
        </Button>
      </form>
    </section>
  );
}
