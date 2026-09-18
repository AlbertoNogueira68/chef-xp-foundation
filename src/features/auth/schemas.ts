import { z } from "zod";
import { passwordSchema } from "./passwordPolicy";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e _"),
  email: z.string().email("Email inválido"),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Criar conta, primeiro passo: só o endereço. O nome e a password vêm depois,
 * do outro lado do link — quando já se sabe que aquela caixa de correio é
 * mesmo de quem se está a inscrever.
 */
export const signupStartSchema = z.object({
  email: z.string().email("Email inválido"),
});
export type SignupStartInput = z.infer<typeof signupStartSchema>;

/**
 * Segundo passo. A password é pedida duas vezes: uma escrita errada numa
 * password que ninguém vê enquanto escreve tranca a conta a quem a acabou de
 * criar, e o segundo campo apanha isso antes de haver estragos.
 */
export const signupCompleteSchema = z
  .object({
    token: z.string().min(16, "Link inválido"),
    username: registerSchema.shape.username,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "As passwords não coincidem",
    path: ["confirm"],
  });
export type SignupCompleteInput = z.infer<typeof signupCompleteSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * A password nova segue a mesma regra do registo — a porta das traseiras não
 * pode ser mais fraca do que a da frente. Estar em dois sítios (aqui e no
 * servidor) não é duplicação a mais: o cliente valida para dar erro sem ir à
 * rede, e o servidor valida porque é ele que decide.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(16, "Link inválido"),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "As passwords não coincidem",
    path: ["confirm"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
