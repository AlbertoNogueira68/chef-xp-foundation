import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, ShieldOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminUsers, useSetRole } from "@/features/admin/hooks/useAdmin";
import type { AdminUser } from "@/types/admin";

const FILTROS = [
  { id: "staff", label: "Com papel" },
  { id: "all", label: "Todas" },
  { id: "moderator", label: "Moderadores" },
  { id: "admin", label: "Administradores" },
];

/**
 * As contas, e o que decide uma promoção.
 *
 * Ao lado do nome estão as receitas publicadas, as denúncias recebidas e se o
 * email foi confirmado — promover alguém a olhar só para o nome é promover um
 * nome. O botão muda de sentido conforme o papel atual, e o meu próprio não
 * aparece: o servidor recusa, e um botão que vai falhar é pior do que botão
 * nenhum.
 */
export function StaffList({ meId }: { meId?: string }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("staff");
  const deferredQ = useDeferredValue(q);
  const contas = useAdminUsers(deferredQ, filtro);
  const setRole = useSetRole();

  const papel = (user: AdminUser) =>
    user.role === "admin" ? "Administrador" : user.role === "moderator" ? "Moderador" : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Nome ou email"
          className="rounded-full pl-10"
          aria-label="Procurar contas"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((item) => (
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
          Nenhuma conta com esses critérios.
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
                  Nv. {user.level} · {user.recipes} {user.recipes === 1 ? "receita" : "receitas"}
                  {user.reportsReceived > 0 && ` · ${user.reportsReceived} denúncias`}
                  {!user.emailVerified && " · email por confirmar"}
                </p>
              </div>
            </div>

            {/* O meu próprio papel não se muda por aqui, e um administrador não
                é despromovido a um clique por outro. */}
            {user.id !== meId && user.role !== "admin" && (
              <Button
                size="sm"
                variant={user.role === "moderator" ? "outline" : "secondary"}
                className="mt-2 h-9 w-full rounded-full text-xs"
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
                    <ShieldOff className="mr-1.5 size-3.5" /> Retirar moderação
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-1.5 size-3.5" /> Tornar moderador
                  </>
                )}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
