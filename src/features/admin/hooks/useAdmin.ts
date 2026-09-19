import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminService } from "../services/adminService";
import type { UserRole } from "@/types/user";
import { t } from "@/i18n";

export const metricsQueryKey = ["admin", "metrics"] as const;
export const adminUsersQueryKey = (q: string, role: string) => ["admin", "users", q, role] as const;
export const reportsQueryKey = (status: string) => ["moderation", "reports", status] as const;

export function usePlatformMetrics(enabled = true) {
  return useQuery({ queryKey: metricsQueryKey, queryFn: () => adminService.metrics(), enabled });
}

export function useAdminUsers(q: string, role: string, enabled = true) {
  return useQuery({
    queryKey: adminUsersQueryKey(q, role),
    queryFn: () => adminService.users({ q, role }),
    enabled,
  });
}

export function useSetRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => adminService.setRole(id, role),
    onSuccess: (user) => {
      // Os papéis chamam-se `moderator` e `admin` na base de dados, que é onde
      // devem ter nome inglês. No ecrã falam português.
      const nome = { admin: t("administrator"), moderator: t("moderator"), user: "" }[user.role];
      toast.success(
        user.role === "user"
          ? t("Role removed")
          : t("{name} is now {role}", { name: user.username, role: nome }),
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("Couldn't change the role"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmUsername }: { id: string; confirmUsername: string }) =>
      adminService.deleteUser(id, confirmUsername),
    onSuccess: (user) => {
      toast.success(t("@{username}'s account was deleted", { username: user.username }));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("Couldn't delete the account"));
    },
    onSettled: () => {
      // As métricas e a fila também mudam: a conta levou receitas, comentários
      // e as denúncias que tinha feito.
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["moderation"] });
    },
  });
}

export function useReports(status: string, enabled = true) {
  return useQuery({
    queryKey: reportsQueryKey(status),
    queryFn: () => adminService.reports(status),
    enabled,
  });
}

/**
 * Fechar uma denúncia fecha todas as que apontam para o mesmo alvo, por isso
 * o que se diz a seguir é quantas foram — senão a fila encolhia mais do que a
 * ação parecia justificar e ficava a parecer um erro.
 */
export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "remover" | "arquivar" }) =>
      adminService.resolve(id, action),
    onSuccess: ({ resolved }, { action }) => {
      const verbo = action === "remover" ? t("Content removed") : t("Report archived");
      toast.success(verbo, {
        description:
          resolved > 1
            ? t("{count} reports about the same target were closed.", { count: resolved })
            : undefined,
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("Couldn't close the report"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}
