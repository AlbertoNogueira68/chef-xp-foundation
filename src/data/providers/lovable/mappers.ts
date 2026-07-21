import type { User } from "@/types/user";

/**
 * Row bruta devolvida pelo cliente Supabase para a tabela `public.users`.
 * Mantido local a este provider para evitar que o resto da app dependa de
 * snake_case ou de tipos gerados pelo Supabase.
 */
export interface UserRow {
  id: string;
  username: string;
  email: string;
  photo_url: string | null;
  level: number;
  xp: number;
  created_at: string;
  updated_at: string;
}

export function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    photoUrl: row.photo_url,
    level: row.level,
    xp: row.xp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
