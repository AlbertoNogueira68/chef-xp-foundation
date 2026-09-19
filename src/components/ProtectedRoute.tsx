import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { authService } from "@/features/auth/services/authService";
import { t } from "@/i18n";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: () => authService.getCurrentSession(),
    staleTime: 30_000,
    retry: false,
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("Loading…")}
      </div>
    );
  }

  if (!sessionQuery.data) {
    return <Navigate to="/auth" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
