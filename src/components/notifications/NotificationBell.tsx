import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllRead,
  useNotifications,
  useUnreadCount,
} from "@/features/notifications/hooks/useNotifications";
import type { AppNotification, NotificationKind } from "@/types/notification";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationKind, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
};

const COLORS: Record<NotificationKind, string> = {
  like: "text-rose-500",
  comment: "text-sky-500",
  follow: "text-amber-500",
};

function timeAgo(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

/**
 * A frase é montada aqui, e não guardada na base de dados: assim acompanha
 * quem mudou de nome, em vez de repetir para sempre o nome de quando a ação
 * aconteceu.
 */
function describe(notification: AppNotification) {
  const quem = notification.actor.username;
  switch (notification.kind) {
    case "like":
      return `${quem} gostou de ${notification.recipe?.title ?? "uma receita tua"}`;
    case "comment":
      return `${quem} comentou em ${notification.recipe?.title ?? "uma receita tua"}`;
    case "follow":
      return `${quem} começou a seguir-te`;
  }
}

function destino(notification: AppNotification) {
  if (notification.recipe) return `/recipe/${notification.recipe.id}`;
  return `/chef/${notification.actor.id}`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = useUnreadCount();
  const { data, isLoading } = useNotifications(open);
  const markAllRead = useMarkAllRead();

  const abrir = (aberto: boolean) => {
    setOpen(aberto);
    // Abrir a caixa é ver o que lá está dentro.
    if (aberto && unread > 0) markAllRead.mutate();
  };

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-full"
          aria-label={unread > 0 ? `Notificações (${unread} por ler)` : "Notificações"}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="text-sm font-semibold">Notificações</p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && data?.notifications.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto size-5 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Ainda não há nada por aqui.</p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                Gostos, comentários e seguidores novos aparecem aqui.
              </p>
            </div>
          )}

          <ul>
            {data?.notifications.map((notification) => {
              const Icon = ICONS[notification.kind];
              return (
                <li key={notification.id}>
                  <Link
                    to={destino(notification)}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/60",
                      !notification.read && "bg-amber-500/5",
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="size-9">
                        <AvatarImage src={notification.actor.photoUrl ?? undefined} />
                        <AvatarFallback>
                          {notification.actor.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Icon
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-background p-0.5",
                          COLORS[notification.kind],
                        )}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{describe(notification)}</p>
                      {notification.commentBody && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          “{notification.commentBody}”
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>

                    {notification.recipe?.imageUrl && (
                      <img
                        src={notification.recipe.imageUrl}
                        alt=""
                        className="size-10 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
