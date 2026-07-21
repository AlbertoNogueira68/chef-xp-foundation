/**
 * Domínio: User.
 *
 * Este é o tipo canónico usado por toda a UI. Nunca expor tipos do provider
 * (ex.: rows do Postgres em snake_case). Os mappers no data layer convertem
 * o formato de origem neste DTO.
 */
export interface User {
  id: string;
  username: string;
  email: string;
  photoUrl: string | null;
  level: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdate {
  username?: string;
  photoUrl?: string | null;
}
