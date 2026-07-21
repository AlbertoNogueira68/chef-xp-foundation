/**
 * Container do data layer.
 *
 * Este é o único ficheiro que a app importa para obter repositórios. Trocar
 * o provider (Lovable Cloud → REST/Fastify) faz-se substituindo apenas as
 * linhas abaixo — nenhum componente, hook ou service precisa mudar.
 */
import { LovableAuthRepository } from "./providers/lovable/LovableAuthRepository";
import { LovableUserRepository } from "./providers/lovable/LovableUserRepository";
import type { AuthRepository } from "./contracts/AuthRepository";
import type { UserRepository } from "./contracts/UserRepository";

export const authRepository: AuthRepository = new LovableAuthRepository();
export const userRepository: UserRepository = new LovableUserRepository();

export type { AuthRepository, UserRepository };
