import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Camera, ImagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRecipe } from "@/features/feed/hooks/useRecipes";

const schema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres"),
  description: z.string().min(10, "Conta um pouco mais sobre a receita"),
  ingredients: z.string().min(5, "Lista pelo menos alguns ingredientes"),
  cookTimeMin: z.coerce.number().min(5).max(300),
  difficulty: z.enum(["facil", "medio", "dificil"]),
});

type FormValues = z.infer<typeof schema>;

const PREVIEW =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop";

export function PublishPage() {
  const navigate = useNavigate();
  const create = useCreateRecipe();
  const [preview] = useState(PREVIEW);
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

  const onSubmit = handleSubmit((values) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Receita publicada! +25 XP");
        navigate("/feed");
      },
      onError: (error) => toast.error(error.message),
    });
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

      <div className="relative overflow-hidden rounded-2xl border border-dashed border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50">
        <img src={preview} alt="" className="aspect-[4/3] w-full object-cover opacity-90" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/20">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" className="rounded-full">
              <Camera className="mr-1 size-4" /> Foto
            </Button>
            <Button type="button" size="sm" variant="secondary" className="rounded-full">
              <ImagePlus className="mr-1 size-4" /> Galeria
            </Button>
          </div>
          <p className="text-xs text-white/90">Toque para adicionar imagem</p>
        </div>
      </div>

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
            className="rounded-xl resize-none"
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
            className="rounded-xl resize-none"
            {...register("ingredients")}
          />
          {errors.ingredients && (
            <p className="text-xs text-destructive">{errors.ingredients.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cookTimeMin">Tempo (min)</Label>
            <Input id="cookTimeMin" type="number" className="rounded-xl" {...register("cookTimeMin")} />
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
          disabled={create.isPending}
        >
          {create.isPending ? "A publicar…" : "Publicar receita"}
        </Button>
      </form>
    </section>
  );
}
