import { useQuery } from "@tanstack/react-query";
import { authService } from "@/features/auth/services/authService";
import { userService } from "@/features/profile/services/userService";

export const currentUserQueryKey = ["currentUser"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: async () => {
      const session = await authService.getCurrentSession();
      if (!session) return null;
      return userService.getById(session.userId);
    },
    staleTime: 60_000,
  });
}
