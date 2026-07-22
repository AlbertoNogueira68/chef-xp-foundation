import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignUp } from "../hooks/useSignUp";
import { registerSchema, type RegisterInput } from "../schemas";

export function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const signUp = useSignUp();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    signUp.mutate(values, {
      onSuccess: (result) => {
        if (result.needsEmailConfirmation) {
          toast.success("Conta criada. Verifica o teu email para confirmares.");
        } else {
          toast.success("Bem-vindo ao ChefXP!");
        }
        onSuccess?.();
      },
      onError: (error) => toast.error(error.message),
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-username">Nome de utilizador</Label>
        <Input id="register-username" autoComplete="username" className="rounded-xl" {...register("username")} />
        {errors.username && (
          <p className="text-xs text-destructive">{errors.username.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input id="register-email" type="email" autoComplete="email" className="rounded-xl" {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Palavra-passe</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
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
        disabled={signUp.isPending}
      >
        {signUp.isPending ? "A criar conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
