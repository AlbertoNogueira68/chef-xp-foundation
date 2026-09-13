import { useQuery } from "@tanstack/react-query";
import { userService } from "@/features/profile/services/userService";

export type FollowListKind = "followers" | "following";

export const followListQueryKey = (kind: FollowListKind, id: string | undefined) =>
  ["followList", kind, id ?? ""] as const;

/** Carregada só quando a lista abre: são dados que raramente se veem. */
export function useFollowList(kind: FollowListKind, id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: followListQueryKey(kind, id),
    queryFn: () =>
      kind === "followers"
        ? userService.followers(id as string)
        : userService.following(id as string),
    enabled: enabled && Boolean(id),
  });
}
