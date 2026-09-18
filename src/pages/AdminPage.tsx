import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformMetrics } from "@/components/admin/PlatformMetrics";
import { ReportQueue } from "@/components/admin/ReportQueue";
import { StaffList } from "@/components/admin/StaffList";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";

/**
 * A área de administração, dentro da própria aplicação.
 *
 * Antes disto a fila de denúncias só existia como API: tratar uma denúncia
 * exigia um cliente HTTP, o que é o mesmo que dizer que na prática ninguém a
 * trataria. O que muda aqui não é o que o servidor permite — é ser possível
 * fazê-lo.
 *
 * Os separadores seguem os papéis: o moderador vê a fila e mais nada; o
 * administrador vê também as contas e os números. Esconder não é proteger — o
 * servidor recusa os dois pedidos a quem não tem papel (`requireModerator` e
 * `requireAdmin`) — mas mostrar separadores que respondem 403 é oferecer
 * portas fechadas.
 */
export function AdminPage() {
  const { data: me, isLoading } = useCurrentUser();
  const navigate = useNavigate();

  if (isLoading) return null;

  const role = me?.role ?? "user";
  const isAdmin = role === "admin";
  const isStaff = isAdmin || role === "moderator";

  if (!isStaff) return <Navigate to="/feed" replace />;

  return (
    <section className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 rounded-full text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-1.5 size-4" /> Voltar
      </Button>

      <div>
        <h1 className="text-xl font-bold">{isAdmin ? "Administração" : "Moderação"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "A fila, quem modera, e os números da aplicação."
            : "As denúncias que chegaram, e o que fazer com elas."}
        </p>
      </div>

      {isAdmin ? (
        <Tabs defaultValue="fila">
          <TabsList className="grid w-full grid-cols-3 rounded-full">
            <TabsTrigger value="fila" className="rounded-full text-xs">
              Fila
            </TabsTrigger>
            <TabsTrigger value="contas" className="rounded-full text-xs">
              Contas
            </TabsTrigger>
            <TabsTrigger value="numeros" className="rounded-full text-xs">
              Números
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fila" className="mt-4">
            <ReportQueue />
          </TabsContent>
          <TabsContent value="contas" className="mt-4">
            <StaffList meId={me?.id} />
          </TabsContent>
          <TabsContent value="numeros" className="mt-4">
            <PlatformMetrics />
          </TabsContent>
        </Tabs>
      ) : (
        <ReportQueue />
      )}
    </section>
  );
}

export default AdminPage;
