import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformMetrics } from "@/features/admin/hooks/useAdmin";
import { t } from "@/i18n";

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
          {t("People")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero
            label={t("Accounts")}
            value={data.contas}
            nota={t("+{count} in the last 7 days", { count: data.contasUltimos7Dias })}
          />
          <Numero
            label={t("Active (7 days)")}
            value={data.ativosUltimos7Dias}
            nota={t("earned XP, not just signed up")}
          />
          <Numero
            label="Email confirmado"
            value={data.contasConfirmadas}
            nota={t("of {total}", { total: data.contas })}
          />
          <Numero label={t("With a role")} value={data.equipa} nota={t("moderation and admin")} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("Content")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero
            label={t("Recipes")}
            value={data.receitas}
            nota={t("+{count} in the last 7 days", { count: data.receitasUltimos7Dias })}
          />
          <Numero label={t("Comments")} value={data.comentarios} />
          <Numero label="Gostos" value={data.gostos} />
          <Numero label={t("Live challenges")} value={data.desafiosAtivos} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("Learning")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero label={t("Lessons completed")} value={data.licoesConcluidas} />
          <Numero label={t("Missions cooked")} value={data.missoesConcluidas} />
          <Numero label={t("XP awarded")} value={data.xpDistribuido} nota={t("from the ledger")} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("Community")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Numero
            label={t("Open reports")}
            value={data.denunciasAbertas}
            nota={t("{count} since the start", { count: data.denunciasTotal })}
          />
          <Numero label="Bloqueios" value={data.bloqueios} nota="entre utilizadores" />
        </div>
      </section>
    </div>
  );
}
