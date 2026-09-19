import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Camera, ImagePlus, Images, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CameraCapture } from "@/components/CameraCapture";
import { useCreateRecipe } from "@/features/feed/hooks/useRecipes";
import { useCamera } from "@/features/missions/hooks/useCamera";
import { fileToResizedDataUrl } from "@/lib/image";
import { t } from "@/i18n";

const schema = z.object({
  title: z.string().min(3, t("At least 3 characters")),
  description: z.string().min(10, t("Tell us a bit more about the recipe")),
  ingredients: z.string().min(5, t("List at least a few ingredients")),
  cookTimeMin: z.coerce.number().min(5).max(300),
  difficulty: z.enum(["facil", "medio", "dificil"]),
});

type FormValues = z.infer<typeof schema>;

export function PublishPage() {
  const navigate = useNavigate();
  const create = useCreateRecipe();
  const fileInput = useRef<HTMLInputElement>(null);
  /**
   * Um segundo input, com `capture`, para quando a câmara da app não está
   * disponível — num telemóvel em http (a app só a tem em HTTPS ou localhost)
   * este continua a abrir a câmara do sistema em vez da galeria.
   */
  const cameraInput = useRef<HTMLInputElement>(null);
  const camera = useCamera();

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
      toast.error(error instanceof Error ? error.message : t("Couldn't use that image"));
    } finally {
      setProcessingImage(false);
    }
  };

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { ...values, imageDataUrl: image },
      {
        onSuccess: ({ xpEarned }) => {
          toast.success(t("Recipe published! +{xp} XP", { xp: xpEarned }));
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
          <h1 className="text-xl font-bold">{t("New recipe")}</h1>
          <p className="text-xs text-muted-foreground">{t("Share it with the community")}</p>
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
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={pickImage}
      />

      {camera.active ? (
        <CameraCapture
          camera={camera}
          onCapture={setImage}
          captureLabel={t("Take photo")}
          className="border-amber-300"
          buttonClassName="bg-amber-500 hover:bg-amber-600"
        />
      ) : image ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/60">
          <img src={image} alt={t("Recipe preview")} className="aspect-[4/3] w-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 size-8 rounded-full"
            aria-label={t("Remove image")}
            onClick={() => setImage(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50 px-4 text-muted-foreground">
          <ImagePlus className="size-8 text-amber-500" />
          <span className="text-sm font-medium">
            {processingImage ? t("Preparing image…") : t("Add a photo")}
          </span>

          {/* Tirar a foto vem primeiro: a receita acabou de sair do fogão, e
              quem a publica tem o prato à frente e não na galeria. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              className="rounded-full bg-amber-500 hover:bg-amber-600"
              disabled={processingImage}
              onClick={() =>
                camera.supported ? void camera.start() : cameraInput.current?.click()
              }
            >
              <Camera className="size-4" />
              {t("Take photo")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-amber-300 bg-transparent"
              disabled={processingImage}
              onClick={() => fileInput.current?.click()}
            >
              <Images className="size-4" />
              {t("From gallery")}
            </Button>
          </div>

          {camera.error ? (
            <p className="text-center text-xs text-rose-600">{camera.error}</p>
          ) : (
            <span className="text-xs">{t("JPEG, PNG or WebP")}</span>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t("Title")}</Label>
          <Input
            id="title"
            {...register("title")}
            placeholder={t("e.g. Crispy chicken tacos")}
            className="rounded-xl"
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("Description")}</Label>
          <Textarea
            id="description"
            rows={2}
            placeholder={t("Tell the story behind this recipe…")}
            className="resize-none rounded-xl"
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ingredients">{t("Ingredients")}</Label>
          <Textarea
            id="ingredients"
            rows={3}
            placeholder={t("200g chicken\n1 onion\n…")}
            className="resize-none rounded-xl"
            {...register("ingredients")}
          />
          {errors.ingredients && (
            <p className="text-xs text-destructive">{errors.ingredients.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="cookTimeMin">{t("Time (min)")}</Label>
            <Input
              id="cookTimeMin"
              type="number"
              className="rounded-xl"
              {...register("cookTimeMin")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">{t("Difficulty")}</Label>
            <select
              id="difficulty"
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              {...register("difficulty")}
            >
              <option value="facil">{t("Easy")}</option>
              <option value="medio">{t("Medium")}</option>
              <option value="dificil">{t("Hard")}</option>
            </select>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold shadow-lg shadow-orange-500/20"
          disabled={create.isPending || processingImage}
        >
          {create.isPending ? t("Publishing…") : t("Publish recipe")}
        </Button>
      </form>
    </section>
  );
}
