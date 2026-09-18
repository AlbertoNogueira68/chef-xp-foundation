import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformMetrics } from "@/features/admin/hooks/useAdmin";

function Numero({ label, value, nota }: { label: string; value: number; nota?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString("pt-PT")}</p>
      <p className="text-[11px] font-medium">{label}</p>
      {nota && <p className="text-[10px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

/**
 * Os números da plataforma.
 *
 * Todos somados na hora sobre as tabelas que já existem — nenhum é um contador
 * guardado que alguém tenha de manter sincronizado, pela mesma razão que o
 * ranking não tem tabela própria.
 *
 * "Ativos" é quem ganhou XP nos últimos sete dias, e não quem abriu a
 * aplicação: isto não segue ninguém para saber a segunda coisa.
 */
export function PlatformMetrics() {
  const { data, isLoading } = usePlatformMetrics();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gente
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero
            label="Contas"
            value={data.contas}
            nota={`+${data.contasUltimos7Dias} nos últimos 7 dias`}
          />
          <Numero
            label="Ativos (7 dias)"
            value={data.ativosUltimos7Dias}
            nota="ganharam XP, não só abriram"
          />
          <Numero
            label="Email confirmado"
            value={data.contasConfirmadas}
            nota={`de ${data.contas}`}
          />
          <Numero label="Com papel" value={data.equipa} nota="moderação e administração" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conteúdo
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero
            label="Receitas"
            value={data.receitas}
            nota={`+${data.receitasUltimos7Dias} nos últimos 7 dias`}
          />
          <Numero label="Comentários" value={data.comentarios} />
          <Numero label="Gostos" value={data.gostos} />
          <Numero label="Desafios a decorrer" value={data.desafiosAtivos} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Aprendizagem
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero label="Lições concluídas" value={data.licoesConcluidas} />
          <Numero label="Missões cozinhadas" value={data.missoesConcluidas} />
          <Numero label="XP distribuído" value={data.xpDistribuido} nota="soma do livro-razão" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Convivência
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero
            label="Denúncias por tratar"
            value={data.denunciasAbertas}
            nota={`${data.denunciasTotal} desde sempre`}
          />
          <Numero label="Bloqueios" value={data.bloqueios} nota="entre utilizadores" />
        </div>
      </section>
    </div>
  );
}
