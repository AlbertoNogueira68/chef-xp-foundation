import { Bell, MessageCircle } from "lucide-react";
import { ChefXPLogo } from "@/components/ChefXPLogo";
import { Button } from "@/components/ui/button";

export function TopHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <ChefXPLogo />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Notificações"
          >
            <Bell className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Mensagens"
          >
            <MessageCircle className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
