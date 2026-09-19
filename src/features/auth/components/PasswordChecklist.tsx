import { Check, X } from "lucide-react";
import { checkPassword } from "../passwordPolicy";
import { t } from "@/i18n";

/**
 * A lista de requisitos por baixo do campo da password, a ficar verde
 * enquanto se escreve.
 *
 * `aria-live="polite"` porque quem usa leitor de ecrã também tem de saber
 * quando um requisito passa a cumprido — a cor sozinha não o diz. Antes de se
 * escrever a primeira letra a lista aparece neutra: quatro cruzes vermelhas
 * num campo ainda vazio é uma repreensão por nada.
 */
export function PasswordChecklist({ value }: { value: string }) {
  const rules = checkPassword(value);
  const iniciou = value.length > 0;

  return (
    <ul className="space-y-1" aria-live="polite">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={
            "flex items-center gap-2 text-xs " +
            (rule.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : iniciou
                ? "text-destructive"
                : "text-muted-foreground")
          }
        >
          <span
            aria-hidden
            className={
              "flex size-4 shrink-0 items-center justify-center rounded-[4px] border " +
              (rule.ok ? "border-current bg-current/10" : "border-current/40")
            }
          >
            {rule.ok ? <Check className="size-3" /> : iniciou ? <X className="size-3" /> : null}
          </span>
          <span>{rule.label}</span>
          <span className="sr-only">{rule.ok ? " — done" : t(" — missing")}</span>
        </li>
      ))}
    </ul>
  );
}
