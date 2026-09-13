import { ChefXPLogo } from "@/components/ChefXPLogo";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <ChefXPLogo />
        {/* Havia aqui um botão de mensagens que nunca teve mensagens por
            baixo. Um botão que não faz nada é pior do que botão nenhum: ensina
            quem usa a app que carregar nas coisas não vale a pena. */}
        <NotificationBell />
      </div>
    </header>
  );
}
