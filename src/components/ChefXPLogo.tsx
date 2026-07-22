import { cn } from "@/lib/utils";

export function ChefXPLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-xl font-bold tracking-tight text-transparent",
        className,
      )}
    >
      ChefXP
    </span>
  );
}
