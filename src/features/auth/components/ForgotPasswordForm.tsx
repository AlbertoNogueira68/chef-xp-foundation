import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeInput } from "@/components/account/CodeInput";
import { useForgotPassword, useResetPassword } from "@/features/auth/hooks/useAccount";

/**
 * Recuperar a password, em dois passos no mesmo ecrã.
 *
 * O primeiro passo diz sempre a mesma coisa, exista ou não conta com aquele
 * email: se a mensagem mudasse, esta página passava a ser um verificador de
 * endereços registados.
 */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const pedirCodigo = (event: React.FormEvent) => {
    event.preventDefault();
    forgot.mutate(email.trim().toLowerCase(), {
      onSuccess: () => setStep("code"),
      onError: (error) => toast.error(error.message),
    });
  };

  const definirPassword = (event: React.FormEvent) => {
    event.preventDefault();
    reset.mutate(
      { email: email.trim().toLowerCase(), code, password },
      {
        onSuccess: () => {
          // Não se inicia sessão automaticamente: entrar com a password nova é
          // o que confirma que ficou decorada e não só escrita neste ecrã.
          toast.success("Password alterada. Entra com a nova.");
          onBack();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Voltar a entrar
      </button>

      {step === "email" ? (
        <form onSubmit={pedirCodigo} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="recuperar-email">Email da conta</Label>
            <Input
              id="recuperar-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@exemplo.pt"
              required
            />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={forgot.isPending}>
            {forgot.isPending ? "A enviar…" : "Enviar código"}
          </Button>
        </form>
      ) : (
        <form onSubmit={definirPassword} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Se existir uma conta com <span className="font-medium">{email}</span>, enviámos um
            código de seis dígitos. Expira daqui a 15 minutos.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="recuperar-codigo">Código</Label>
            <CodeInput id="recuperar-codigo" value={code} onChange={setCode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recuperar-password">Password nova</Label>
            <Input
              id="recuperar-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Pelo menos 8 caracteres"
              minLength={8}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={code.length !== 6 || password.length < 8 || reset.isPending}
          >
            {reset.isPending ? "A guardar…" : "Definir password"}
          </Button>

          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setStep("email")}
          >
            Escrevi o email errado
          </button>
        </form>
      )}
    </div>
  );
}
