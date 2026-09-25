import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminUsers, useDeleteUser, useSetRole } from "@/features/admin/hooks/useAdmin";
import type { AdminUser } from "@/types/admin";
import { t } from "@/i18n";

const filtros = () => [
  { id: "staff", label: t("With a role") },
  { id: "all", label: t("All") },
  { id: "moderator", label: t("Moderators") },
  { id: "admin", label: t("Admins") },
];

/**
 * As contas, e o que decide uma promoção.
 *
 * Ao lado do nome estão as receitas publicadas, as denúncias recebidas e se o
 * email foi confirmado — promover alguém a olhar só para o nome é promover um
 * nome. O botão muda de sentido conforme o papel atual, e o meu próprio não
 * aparece: o servidor recusa, e um botão que vai falhar é pior do que botão
 * nenhum.
 *
 * Apagar segue a mesma regra: aparece em quem não é admin, e nunca em mim —
 * a minha conta apaga-se no perfil. Pede o nome escrito à mão, como o perfil
 * pede ao próprio, porque não há volta atrás.
 */
export function StaffList({ meId }: { meId?: string }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("staff");
  const deferredQ = useDeferredValue(q);
  const contas = useAdminUsers(deferredQ, filtro);
  const setRole = useSetRole();
  const deleteUser = useDeleteUser();
  const [aApagar, setAApagar] = useState<AdminUser | null>(null);
  const [nomeEscrito, setNomeEscrito] = useState("");
  const nomeCoincide = aApagar !== null && nomeEscrito.trim().toLowerCase() === aApagar.username;

  const confirmarApagar = () => {
    if (!aApagar || !nomeCoincide) return;
    deleteUser.mutate(
      { id: aApagar.id, confirmUsername: aApagar.username },
      { onSuccess: () => setAApagar(null) },
    );
  };

  const papel = (user: AdminUser) =>
    user.role === "admin" ? t("Admin") : user.role === "moderator" ? t("Moderator") : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("Name or email")}
          className="rounded-full pl-10"
          aria-label={t("Search accounts")}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filtros().map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filtro === item.id}
            onClick={() => setFiltro(item.id)}
            className="flex h-9 items-center"
          >
            <Badge
              variant={filtro === item.id ? "default" : "secondary"}
              className="rounded-full px-3 py-1.5 text-xs"
            >
              {item.label}
            </Badge>
          </button>
        ))}
      </div>

      {contas.isLoading && <Skeleton className="h-20 w-full rounded-xl" />}

      {contas.data?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("No account matches that.")}
        </p>
      )}

      <ul className="space-y-2">
        {contas.data?.map((user) => (
          <li key={user.id} className="rounded-xl border border-border/60 bg-card p-3">
            <div className="flex items-center gap-2.5">
              <Link to={`/chef/${user.id}`} className="shrink-0">
                <Avatar className="size-10">
                  <AvatarImage src={user.photoUrl ?? undefined} />
                  <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {user.username}
                  {papel(user) && (
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {papel(user)}
                    </Badge>
                  )}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t("Lv. {level} · {recipes} {recipesWord}", {
                    level: user.level,
                    recipes: user.recipes,
                    recipesWord: t(user.recipes === 1 ? "recipe" : "recipes"),
                  })}
                  {user.reportsReceived > 0 &&
                    t(" · {count} reports", { count: user.reportsReceived })}
                  {!user.emailVerified && " · email unconfirmed"}
                </p>
              </div>
            </div>

            {/* O meu próprio papel não se muda por aqui, e um administrador não
                é despromovido a um clique por outro. */}
            {user.id !== meId && user.role !== "admin" && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant={user.role === "moderator" ? "outline" : "secondary"}
                  className="h-9 flex-1 rounded-full text-xs"
                  disabled={setRole.isPending}
                  onClick={() =>
                    setRole.mutate({
                      id: user.id,
                      role: user.role === "moderator" ? "user" : "moderator",
                    })
                  }
                >
                  {user.role === "moderator" ? (
                    <>
                      <ShieldOff className="mr-1.5 size-3.5" />
                      {t("Remove moderator")}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-1.5 size-3.5" />
                      {t("Make moderator")}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setNomeEscrito("");
                    setAApagar(user);
                  }}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  {t("Delete account")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog open={aApagar !== null} onOpenChange={(aberto) => !aberto && setAApagar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a conta de @{aApagar?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Everything of theirs goes: recipes, comments, likes, missions, progress and XP. There's no undo. It's logged that you did it.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="admin-confirm-name">
              {t("Type")} <span className="font-mono font-semibold">{aApagar?.username}</span>
              {t("to confirm")}
            </Label>
            <Input
              id="admin-confirm-name"
              value={nomeEscrito}
              autoComplete="off"
              onChange={(event) => setNomeEscrito(event.target.value)}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <button
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              disabled={!nomeCoincide || deleteUser.isPending}
              onClick={confirmarApagar}
            >
              {deleteUser.isPending ? t("Deleting…") : t("Delete for good")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
