import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { PasswordChecklist } from "@/features/auth/components/PasswordChecklist";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { useCompleteSignup, useSignupToken } from "@/features/auth/hooks/useSignUp";
import { signupCompleteSchema, type SignupCompleteInput } from "@/features/auth/schemas";
import { t } from "@/i18n";

/**
 * O segundo passo de criar conta, aberto a partir do link do email.
 *
 * O endereço já está provado quando se chega aqui — é por isso que é este o
 * ecrã que pede o nome de utilizador e a password, e é por isso que a conta
 * nasce já confirmada. Enquanto este formulário não for submetido não existe
 * conta nenhuma: só uma linha à espera, que expira sozinha.
 */
export function CreateAccountPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const link = useSignupToken(token);
  const criar = useCompleteSignup();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupCompleteInput>({
    resolver: zodResolver(signupCompleteSchema),
    mode: "onTouched",
    defaultValues: { token, username: "", password: "", confirm: "" },
  });

  const password = watch("password");

  useEffect(() => {
    if (!criar.isSuccess) return;
    toast.success(t("Account created. Welcome to ChefXP!"));
    navigate("/feed", { replace: true });
  }, [criar.isSuccess, navigate]);

  if (!token || link.isError) {
    return (
      <AuthCard
        titulo={t("Invalid or expired link")}
        descricao={t(
          "This link no longer works — it was used already, or it expired. Asking for another takes ten seconds.",
        )}
      >
        <Button asChild className="w-full rounded-full">
          <Link to="/auth">{t("Ask for another link")}</Link>
        </Button>
      </AuthCard>
    );
  }

  if (link.isPending) {
    return (
      <AuthCard titulo="A abrir o link…">
        <div className="h-32 animate-pulse rounded-xl bg-muted/50" aria-hidden />
      </AuthCard>
    );
  }

  const onSubmit = handleSubmit((values) => {
    criar.mutate(values, { onError: (error) => toast.error(error.message) });
  });

  return (
    <AuthCard
      titulo="Escolhe o nome e a password"
      descricao={
        <>
          {t("The address")}
          <strong className="text-foreground">{link.data?.email}</strong>
          {t("is confirmed. Now the rest.")}
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" {...register("token")} />

        <div className="space-y-2">
          <Label htmlFor="signup-username">{t("Username")}</Label>
          <Input
            id="signup-username"
            autoComplete="username"
            autoFocus
            className="rounded-xl"
            {...register("username")}
          />
          {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">{t("Password")}</Label>
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            aria-describedby="signup-password-requisitos"
            {...register("password")}
          />
          <div id="signup-password-requisitos">
            <PasswordChecklist value={password} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm">{t("Repeat the password")}</Label>
          <PasswordInput id="signup-confirm" autoComplete="new-password" {...register("confirm")} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>

        <Button
          type="submit"
          className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
          disabled={criar.isPending}
        >
          {criar.isPending ? "A criar a conta…" : t("Create account")}
        </Button>
      </form>
    </AuthCard>
  );
}
