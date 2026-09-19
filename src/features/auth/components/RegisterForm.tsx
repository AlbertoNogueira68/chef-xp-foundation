import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthProviders } from "../hooks/useAuthProviders";
import { useSignUp, useStartSignup } from "../hooks/useSignUp";
import {
  registerSchema,
  signupStartSchema,
  type RegisterInput,
  type SignupStartInput,
} from "../schemas";
import { PasswordChecklist } from "./PasswordChecklist";
import { PasswordInput } from "./PasswordInput";
import { t } from "@/i18n";

/**
 * Criar conta.
 *
 * São dois formulários, e qual deles aparece é o servidor que decide: com
 * email a funcionar, pede-se o endereço e a conta só nasce do outro lado do
 * link; sem email configurado não há como confirmar nada, e fica o formulário
 * de uma vez só. Perguntar em vez de assumir evita o pior dos casos — um
 * formulário que promete um email que nunca há de sair.
 */
export function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const { data: providers, isPending } = useAuthProviders();

  if (isPending) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted/50" aria-hidden />;
  }

  return providers?.signupFlow === "direct" ? (
    <RegistoDiretoForm onSuccess={onSuccess} />
  ) : (
    <PedirLinkForm />
  );
}

/** Passo um: o endereço, e mais nada. */
function PedirLinkForm() {
  const pedir = useStartSignup();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SignupStartInput>({
    resolver: zodResolver(signupStartSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    pedir.mutate(values.email, {
      onError: (error) => toast.error(error.message),
    });
  });

  // A mesma mensagem para um endereço livre e para um que já tem conta: o
  // servidor responde o mesmo aos dois, e dizer aqui "esse email já existe"
  // desfazia isso — bastava o formulário de registo para saber quem tem conta.
  if (pedir.isSuccess) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
          <MailCheck className="size-5 shrink-0" aria-hidden />
          <p>An email is on its way to {getValues("email")}.</p>
        </div>
        <p className="leading-relaxed text-muted-foreground">
          {t(
            "Open the link inside to choose your username and password. If you already have an account with this address, the email says so — and how to recover the password.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("Nothing arrived? Check your spam, or try again in a minute.")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          className="rounded-xl"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(
          "We confirm the address before creating the account. You choose the password next, in the link we send you.",
        )}
      </p>
      <Button
        type="submit"
        className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
        disabled={pedir.isPending}
      >
        {pedir.isPending ? t("Sending…") : t("Send sign-up link")}
      </Button>
    </form>
  );
}

/** Sem SMTP no servidor: nome, email e password de uma só vez. */
function RegistoDiretoForm({ onSuccess }: { onSuccess?: () => void }) {
  const signUp = useSignUp();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { username: "", email: "", password: "" },
  });

  const password = watch("password");

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values, {
      onSuccess: () => {
        toast.success(t("Welcome to ChefXP!"));
        onSuccess?.();
      },
      onError: (error) => toast.error(error.message),
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-username">{t("Username")}</Label>
        <Input
          id="register-username"
          autoComplete="username"
          className="rounded-xl"
          {...register("username")}
        />
        {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          className="rounded-xl"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">{t("Password")}</Label>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          aria-describedby="register-password-requisitos"
          {...register("password")}
        />
        <div id="register-password-requisitos">
          <PasswordChecklist value={password} />
        </div>
      </div>
      <Button
        type="submit"
        className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
        disabled={signUp.isPending}
      >
        {signUp.isPending ? "A criar conta…" : t("Create account")}
      </Button>
    </form>
  );
}
