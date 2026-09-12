import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LandingPage } from "@/pages/LandingPage";
import { AuthPage } from "@/pages/AuthPage";
import { FeedPage } from "@/pages/FeedPage";
import { SearchPage } from "@/pages/SearchPage";
import { PublishPage } from "@/pages/PublishPage";
import { ChallengesPage } from "@/pages/ChallengesPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ChefPage } from "@/pages/ChefPage";
import { RecipePage } from "@/pages/RecipePage";
import { SESSION_EXPIRED_EVENT } from "@/services/api";

/**
 * Reage a um 401 vindo de qualquer pedido.
 *
 * Antes o cliente HTTP fazia `window.location.assign("/auth")`, o que
 * recarregava a aplicação inteira e deitava fora a cache. Agora navegamos pelo
 * router e guardamos a rota de origem, para poder voltar depois do login.
 */
function SessionWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handle = () => {
      queryClient.clear();
      if (!location.pathname.startsWith("/auth")) {
        navigate("/auth", { replace: true, state: { from: location.pathname } });
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handle);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handle);
  }, [navigate, location, queryClient]);

  return null;
}

export default function App() {
  return (
    <>
      <SessionWatcher />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/publish" element={<PublishPage />} />
          <Route path="/challenges" element={<ChallengesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/chef/:id" element={<ChefPage />} />
          <Route path="/recipe/:id" element={<RecipePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </>
  );
}
