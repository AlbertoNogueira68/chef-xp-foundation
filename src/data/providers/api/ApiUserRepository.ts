import type { UserRepository } from "@/data/contracts/UserRepository";
import { AppError, NotFoundError } from "@/data/contracts/errors";
import { apiFetch } from "@/services/api";
import type { User, UserUpdate } from "@/types/user";

export class ApiUserRepository implements UserRepository {
  async getById(id: string): Promise<User | null> {
    try {
      const data = await apiFetch<{ user: User }>(`/users/${id}`);
      return data.user;
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 404) {
        return null;
      }
      throw new AppError(error instanceof Error ? error.message : "Failed to load user", error);
    }
  }

  async update(id: string, patch: UserUpdate): Promise<User> {
    void id;
    try {
      const data = await apiFetch<{ user: User }>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return data.user;
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 404) {
        throw new NotFoundError("User", error);
      }
      throw new AppError(error instanceof Error ? error.message : "Failed to update user", error);
    }
  }
}
