/**
 * Data provider container.
 * Swap providers here without touching UI/hooks/services.
 */
import { ApiAuthRepository } from "./providers/api/ApiAuthRepository";
import { ApiUserRepository } from "./providers/api/ApiUserRepository";
import type { AuthRepository } from "./contracts/AuthRepository";
import type { UserRepository } from "./contracts/UserRepository";

export const authRepository: AuthRepository = new ApiAuthRepository();
export const userRepository: UserRepository = new ApiUserRepository();
