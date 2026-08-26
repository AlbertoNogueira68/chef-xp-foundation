import { useQuery } from "@tanstack/react-query";
import { userService } from "@/features/profile/services/userService";

export const currentUserQueryKey = ["currentUser"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: () => userService.me(),
    staleTime: 30_000,
    retry: false,
  });
}
