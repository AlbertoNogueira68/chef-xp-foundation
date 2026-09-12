import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateProfile } from "@/features/profile/hooks/useUpdateProfile";
import { fileToResizedDataUrl } from "@/lib/image";
import type { User, UserUpdate } from "@/types/user";

/**
 * Os fusos que fazem sentido para quem usa a app. O streak é calculado neste
 * fuso, portanto escolher mal aqui parte a contagem de dias — daí ser uma
 * escolha explícita e não algo adivinhado em silêncio.
 */
const TIME_ZONES = [
  "Europe/Lisbon",
  "Atlantic/Madeira",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "America/Sao_Paulo",
  "UTC",
];

const GOALS = [
  { value: 20, label: "Tranquilo · 20 XP por dia" },
  { value: 50, label: "Normal · 50 XP por dia" },
  { value: 100, label: "Sério · 100 XP por dia" },
  { value: 200, label: "Intenso · 200 XP por dia" },
];

export function SettingsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateProfile(user.id);
  const fileInput = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user.username);
  const [photo, setPhoto] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState(user.timeZone ?? "Europe/Lisbon");
  const [goal, setGoal] = useState(user.dailyXpGoal ?? 50);
  const [processing, setProcessing] = useState(false);

  // Reabrir o diálogo depois de guardar tem de mostrar o que está guardado,
  // não o rascunho da vez anterior.
  useEffect(() => {
    if (!open) return;
    setUsername(user.username);
    setPhoto(null);
    setTimeZone(user.timeZone ?? "Europe/Lisbon");
    setGoal(user.dailyXpGoal ?? 50);
  }, [open, user]);

  const pickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProcessing(true);
    try {
      setPhoto(await fileToResizedDataUrl(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível usar essa imagem");
    } finally {
      setProcessing(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    // Só vai o que mudou: um PATCH com tudo faria o servidor reescrever a
    // fotografia a cada gravação, mesmo quando ninguém lhe tocou.
    const patch: UserUpdate = {};
    if (username.trim() !== user.username) patch.username = username.trim();
    if (photo) patch.photoUrl = photo;
    if (timeZone !== (user.timeZone ?? "Europe/Lisbon")) patch.timeZone = timeZone;
    if (goal !== (user.dailyXpGoal ?? 50)) patch.dailyXpGoal = goal;

    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }

    update.mutate(patch, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Definições</DialogTitle>
          <DialogDescription>O teu perfil e o ritmo a que queres aprender.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-16 ring-2 ring-amber-500/20">
              <AvatarImage src={photo ?? user.photoUrl ?? undefined} />
              <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickPhoto}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={processing}
                onClick={() => fileInput.current?.click()}
              >
                {processing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1.5 size-3.5" />
                )}
                Mudar fotografia
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Reduzida no browser antes de sair do telemóvel.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Nome de utilizador</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9_.]+"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Só letras minúsculas, números, ponto e underscore.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone">Fuso horário</Label>
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              É neste fuso que o dia muda, e é o dia que decide o streak.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal">Meta diária</Label>
            <Select value={String(goal)} onValueChange={(value) => setGoal(Number(value))}>
              <SelectTrigger id="goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOALS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={update.isPending}>
            {update.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
