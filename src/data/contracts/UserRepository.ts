import type { User, UserUpdate } from "@/types/user";

/**
 * Contrato do repositório de utilizadores.
 * Nenhum componente ou hook deve importar o cliente HTTP/DB diretamente.
 */
export interface UserRepository {
  getById(id: string): Promise<User | null>;
  update(id: string, patch: UserUpdate): Promise<User>;
}
