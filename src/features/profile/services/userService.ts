import { userRepository } from "@/data";
import type { UserUpdate } from "@/types/user";

export const userService = {
  getById(id: string) {
    return userRepository.getById(id);
  },
  update(id: string, patch: UserUpdate) {
    return userRepository.update(id, patch);
  },
};
