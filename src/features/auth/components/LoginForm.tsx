import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignIn } from "../hooks/useSignIn";
import { loginSchema, type LoginInput } from "../schemas";

export function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const signIn = useSignIn();
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
        <Input id="login-email" type="email" autoComplete="email" className="rounded-xl" {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Palavra-passe</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="rounded-xl"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
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
