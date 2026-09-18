import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { LandingPage } from "@/pages/LandingPage";

/**
 * As rotas são carregadas à medida que se visitam.
 *
 * Só a landing fica no arranque: é a porta de entrada de quem chega pela
 * primeira vez e adiar o que se vê primeiro seria trocar o problema de sítio.
 * O ecrã de entrada sai com ela porque arrasta o `react-hook-form` e o `zod`
 * inteiros — 22 kB comprimidos que ninguém deve pagar para ler a landing.
 *
 * O percurso de aprendizagem é o caso mais claro: arrasta o leitor de lições e
 * o ecrã de missões, e é a rota mais pesada da aplicação.
 */
const AuthPage = lazy(() => import("@/pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const ForgotPasswordPage = lazy(() =>
  import("@/pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const CreateAccountPage = lazy(() =>
  import("@/pages/CreateAccountPage").then((m) => ({ default: m.CreateAccountPage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import("@/pages/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })),
);
const FeedPage = lazy(() => import("@/pages/FeedPage").then((m) => ({ default: m.FeedPage })));
const SearchPage = lazy(() =>
  import("@/pages/SearchPage").then((m) => ({ default: m.SearchPage })),
);
const PublishPage = lazy(() =>
  import("@/pages/PublishPage").then((m) => ({ default: m.PublishPage })),
);
const ChallengesPage = lazy(() =>
  import("@/pages/ChallengesPage").then((m) => ({ default: m.ChallengesPage })),
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const ChefPage = lazy(() => import("@/pages/ChefPage").then((m) => ({ default: m.ChefPage })));
const RecipePage = lazy(() =>
  import("@/pages/RecipePage").then((m) => ({ default: m.RecipePage })),
);
// A área de administração é vista por meia dúzia de pessoas: não pertence ao
// pedaço que toda a gente descarrega.
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));

/**
 * O que se vê enquanto o pedaço da rota chega.
 *
 * Deliberadamente discreto: um spinner grande a piscar por 100 ms numa ligação
 * boa é pior do que um espaço em branco. O cabeçalho e a navegação já estão
 * desenhados à volta disto.
 */
function ARotaACarregar() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <span className="size-6 animate-spin rounded-full border-2 border-muted border-t-amber-500" />
      <span className="sr-only">A carregar…</span>
    </div>
  );
}
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
      <ConnectionStatus />
      <SessionWatcher />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/auth"
          element={
            <Suspense fallback={<ARotaACarregar />}>
              <AuthPage />
            </Suspense>
          }
        />
        {/*
          Os ecrãs de conta ficam fora do `ProtectedRoute` de propósito: quem
          recupera a password não tem sessão, quem está a criar conta ainda não
          tem conta nenhuma, e os links do email abrem-se quase sempre noutro
          dispositivo. Exigir login aqui era trancar a porta com a chave lá
          dentro.
        */}
        <Route
          path="/criar-conta"
          element={
            <Suspense fallback={<ARotaACarregar />}>
              <CreateAccountPage />
            </Suspense>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={<ARotaACarregar />}>
              <ForgotPasswordPage />
            </Suspense>
          }
        />
        <Route
          path="/reset-password"
          element={
            <Suspense fallback={<ARotaACarregar />}>
              <ResetPasswordPage />
            </Suspense>
          }
        />
        <Route
          path="/verify-email"
          element={
            <Suspense fallback={<ARotaACarregar />}>
              <VerifyEmailPage />
            </Suspense>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Suspense fallback={<ARotaACarregar />}>
                <AppShell />
              </Suspense>
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
          {/* Fila de denúncias e administração. A página reencaminha quem não
              tem papel; o servidor recusa-o de qualquer maneira. */}
          <Route
            path="/admin"
            element={
              <Suspense fallback={<ARotaACarregar />}>
                <AdminPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </>
  );
}
