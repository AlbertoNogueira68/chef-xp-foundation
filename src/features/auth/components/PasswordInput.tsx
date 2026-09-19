import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de password com o olho para ver o que se escreveu.
 *
 * Escrever uma password às escuras e depois repeti-la às escuras é a receita
 * para duas escritas erradas iguais — ou para desistir a meio. O botão só
 * troca o `type` do campo: nada é guardado nem enviado por causa disto.
 *
 * Começa sempre escondido a cada montagem. Manter a escolha entre ecrãs era
 * arriscar deixar a password de alguém à vista num sítio onde ninguém pediu.
 */
export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visivel, setVisivel] = useState(false);
    const descricaoId = useId();

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visivel ? "text" : "password"}
          className={cn("rounded-xl pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          // `aria-pressed` porque isto é um interruptor, não uma ação: quem
          // usa leitor de ecrã fica a saber em que estado está, e não só o
          // que o botão faz a seguir.
          aria-pressed={visivel}
          aria-label={visivel ? "Hide password" : "Show password"}
          aria-describedby={descricaoId}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <span id={descricaoId} className="sr-only">
          Your password stays visible on screen while this button is on.
        </span>
      </div>
    );
  },
);
