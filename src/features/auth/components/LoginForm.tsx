import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthProviders } from "../hooks/useAuthProviders";
import { useSignIn } from "../hooks/useSignIn";
import { loginSchema, type LoginInput } from "../schemas";

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const signIn = useSignIn();
  const { data: providers } = useAuthProviders();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    signIn.mutate(values, {
      onSuccess: () => onSuccess?.(),
      onError: (error) => toast.error(error.message),
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          className="rounded-xl"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="login-password">Palavra-passe</Label>
          {/*
            Só aparece se o servidor tiver SMTP: sem ele, o link levava a um
            formulário que nunca enviava email nenhum.
          */}
          {providers?.passwordRecovery && (
            <Link
              to="/forgot-password"
              className="inline-flex min-h-8 items-center px-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Esqueceste-te?
            </Link>
          )}
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="rounded-xl"
          {...register("password")}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button
        type="submit"
        className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
        disabled={signIn.isPending}
      >
        {signIn.isPending ? "A entrar…" : "Entrar"}
      </Button>
    </form>
  );
}
