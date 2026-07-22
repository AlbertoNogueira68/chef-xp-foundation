import { NavLink } from "react-router-dom";
import { Home, Plus, Search, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/feed", icon: Home, label: "Feed" },
  { to: "/search", icon: Search, label: "Explorar" },
  { to: "/publish", icon: Plus, label: "Publicar", accent: true },
  { to: "/challenges", icon: Trophy, label: "Desafios" },
  { to: "/profile", icon: User, label: "Perfil" },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-xl"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {items.map(({ to, icon: Icon, label, accent }) => (
          <li key={to}>
            <NavLink
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-center rounded-full transition-colors",
                  accent
                    ? "mx-1 size-11 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/25"
                    : "size-10",
                  !accent && isActive && "text-amber-600",
                  !accent && !isActive && "text-muted-foreground",
                )
              }
            >
              <Icon className={cn("size-5", accent && "size-6")} strokeWidth={accent ? 2.5 : 2} />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
