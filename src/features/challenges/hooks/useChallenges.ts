import { useQuery } from "@tanstack/react-query";
import { challengeService } from "../services/challengeService";

export function useChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: () => challengeService.list(),
  });
}
