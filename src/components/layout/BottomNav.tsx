import { Link } from "@tanstack/react-router";
import { Home, Search, PlusSquare, Trophy, User } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type NavItem = {
  to: "/feed" | "/search" | "/publish" | "/challenges" | "/profile";
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const items: NavItem[] = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/search", label: "Pesquisa", icon: Search },
  { to: "/publish", label: "Publicar", icon: PlusSquare },
  { to: "/challenges", label: "Desafios", icon: Trophy },
  { to: "/profile", label: "Perfil", icon: User },
];

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="size-5" aria-hidden />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
