import { useQuery } from "@tanstack/react-query";
import { missionService } from "../services/missionService";

export const missionPostsQueryKey = (userId: string | undefined) =>
  ["missionPosts", userId ?? "me"] as const;

export function useMissionPosts(userId: string | undefined) {
  return useQuery({
    queryKey: missionPostsQueryKey(userId),
    queryFn: () => missionService.posts(userId),
    enabled: Boolean(userId),
  });
}
