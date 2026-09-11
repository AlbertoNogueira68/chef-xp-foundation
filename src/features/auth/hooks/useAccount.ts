import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountService } from "../services/accountService";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";

export function useRequestVerification() {
  return useMutation({ mutationFn: () => accountService.requestVerification() });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => accountService.verify(code),
    onSuccess: (user) => queryClient.setQueryData(currentUserQueryKey, user),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => accountService.forgotPassword(email) });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { email: string; code: string; password: string }) =>
      accountService.resetPassword(input),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { currentPassword?: string | null; password: string }) =>
      accountService.changePassword(input),
    onSuccess: (user) => queryClient.setQueryData(currentUserQueryKey, user),
  });
}
