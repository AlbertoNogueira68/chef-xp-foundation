import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { PasswordChecklist } from "@/features/auth/components/PasswordChecklist";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { useResetPassword } from "@/features/auth/hooks/usePasswordRecovery";
import { resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schemas";

/**
 * Escolher a password nova, com o token que veio no link do email.
 *
 * O token fica num campo escondido do formulário e nunca é mostrado: não há
 * nada a ganhar em pô-lo no ecrã, e um link partilhado por engano num
 * screenshot dava acesso à conta enquanto não expirasse.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const redefinir = useResetPassword();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { token, password: "", confirm: "" },
  });

  const password = watch("password");

  // Entrar com a password nova é o passo seguinte, e este ecrã não abre
  // sessão: quem redefiniu provou que lê aquele email, não que é a pessoa.
  useEffect(() => {
    if (!redefinir.isSuccess) return;
    toast.success("Password alterada. Entra com a nova.");
    navigate("/auth", { replace: true });
  }, [redefinir.isSuccess, navigate]);

  if (!token) {
    return (
      <AuthCard
        titulo="Link incompleto"
        descricao="Este endereço não traz nenhum token. Abre o link tal como veio no email, ou pede outro."
      >
        <Button asChild className="w-full rounded-full">
          <Link to="/forgot-password">Pedir outro link</Link>
        </Button>
      </AuthCard>
    );
  }

  const onSubmit = handleSubmit((values) => redefinir.mutate(values));

  return (
    <AuthCard
      titulo="Escolher password nova"
      descricao="A password nova tem de cumprir os mesmos requisitos do registo. Depois de guardares, entras com ela."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" {...register("token")} />

        <div className="space-y-2">
          <Label htmlFor="reset-password">Password nova</Label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            autoFocus
            aria-describedby="reset-password-requisitos"
            {...register("password")}
          />
          <div id="reset-password-requisitos">
            <PasswordChecklist value={password} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Repetir a password</Label>
          <PasswordInput id="reset-confirm" autoComplete="new-password" {...register("confirm")} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>

        {redefinir.isError && (
          <div className="space-y-2">
            <p className="text-xs text-destructive">
              {redefinir.error instanceof Error ? redefinir.error.message : "O pedido falhou"}
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex min-h-8 items-center text-xs text-muted-foreground underline underline-offset-4"
            >
              Pedir um link novo
            </Link>
          </div>
        )}

        <Button
          type="submit"
          className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
          disabled={redefinir.isPending}
        >
          {redefinir.isPending ? "A guardar…" : "Guardar a password"}
        </Button>
      </form>
    </AuthCard>
  );
}
