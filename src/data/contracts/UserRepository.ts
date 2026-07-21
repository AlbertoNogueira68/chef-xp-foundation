import type { User, UserUpdate } from "@/types/user";

/**
 * Contrato do repositório de utilizadores.
 *
 * Toda a leitura/escrita da tabela `users` passa por aqui. Nenhum componente
 * ou hook deve importar diretamente o cliente do provider.
 */
export interface UserRepository {
  getById(id: string): Promise<User | null>;
  update(id: string, patch: UserUpdate): Promise<User>;
}
