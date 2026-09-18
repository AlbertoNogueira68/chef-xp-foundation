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
          <p>Vai um email para {getValues("email")}.</p>
        </div>
        <p className="leading-relaxed text-muted-foreground">
          Abre o link que lá está para escolheres o nome de utilizador e a password. Se já tiveres
          conta com este endereço, o email diz-te isso — e como recuperar a password.
        </p>
        <p className="text-xs text-muted-foreground">
          Não chegou? Vê o spam, ou tenta daqui a um minuto.
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
        Confirmamos o endereço antes de criar a conta. A password escolhe-se a seguir, no link que
        te enviamos.
      </p>
      <Button
        type="submit"
        className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
        disabled={pedir.isPending}
      >
        {pedir.isPending ? "A enviar…" : "Enviar link de criação"}
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
        toast.success("Bem-vindo ao ChefXP!");
        onSuccess?.();
      },
      onError: (error) => toast.error(error.message),
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-username">Nome de utilizador</Label>
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
        <Label htmlFor="register-password">Palavra-passe</Label>
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
        {signUp.isPending ? "A criar conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
