import type { UserRepository } from "@/data/contracts/UserRepository";
import { AppError, NotFoundError } from "@/data/contracts/errors";
import type { User, UserUpdate } from "@/types/user";
import { supabase } from "./client";
import { mapUserRow, type UserRow } from "./mappers";

export class LovableUserRepository implements UserRepository {
  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, email, photo_url, level, xp, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new AppError(error.message, error);
    return data ? mapUserRow(data as UserRow) : null;
  }

  async update(id: string, patch: UserUpdate): Promise<User> {
    const payload: { username?: string; photo_url?: string | null } = {};
    if (patch.username !== undefined) payload.username = patch.username;
    if (patch.photoUrl !== undefined) payload.photo_url = patch.photoUrl;


    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .select("id, username, email, photo_url, level, xp, created_at, updated_at")
      .maybeSingle();
    if (error) throw new AppError(error.message, error);
    if (!data) throw new NotFoundError("User");
    return mapUserRow(data as UserRow);
  }
}
