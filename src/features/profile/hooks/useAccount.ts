import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { userService } from "@/features/profile/services/userService";
import type { ApiError } from "@/services/api";

/** Descarrega o ficheiro de dados sem passar por servidor nenhum pelo meio. */
export function useExportData() {
  return useMutation({
    mutationFn: () => userService.exportData(),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      // Sem isto o blob fica em memória até a página ser recarregada.
      URL.revokeObjectURL(url);
      toast.success("Os teus dados foram descarregados");
    },
    onError: (error: ApiError) => toast.error(error.message || "Não foi possível exportar"),
  });
}

export function useDeleteAccount() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { confirmUsername: string; password?: string }) =>
      userService.deleteAccount(input),

    onSuccess: () => {
      // A conta deixou de existir: a cache inteira é sobre alguém que já não
      // está cá.
      queryClient.clear();
      navigate("/", { replace: true });
      toast.success("A tua conta foi apagada");
    },

    onError: (error: ApiError) => toast.error(error.message || "Não foi possível apagar a conta"),
  });
}
