import { useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReports, useResolveReport } from "@/features/admin/hooks/useAdmin";
import type { ModerationReport } from "@/types/admin";

const REASON_LABEL: Record<string, string> = {
  ofensivo: "Ofensivo",
  perigoso: "Perigoso",
  spam: "Spam",
  copia: "Cópia",
  outro: "Outro",
};

const SUBJECT_LABEL: Record<ModerationReport["subjectType"], string> = {
  recipe: "Receita",
  comment: "Comentário",
  user: "Conta",
};

function quando(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

/**
 * O conteúdo denunciado, tal como está.
 *
 * Mostra-se o que foi denunciado e não um resumo: decidir sobre um comentário
 * sem o ler é decidir sobre a palavra de quem denunciou. Quando já não existe
 * — porque o autor o apagou entretanto — diz-se isso, que é uma informação e
 * não um espaço em branco.
 */
function Conteudo({ report }: { report: ModerationReport }) {
  if (!report.subject) {
    return (
      <p className="text-xs italic text-muted-foreground">
        O conteúdo já não existe. A denúncia fica para historial.
      </p>
    );
  }

  if (report.subject.kind === "recipe") {
    return (
      <Link
        to={`/recipe/${report.subjectId}`}
        className="flex items-center gap-2 rounded-lg hover:opacity-80"
      >
        {report.subject.imageUrl && (
          <img
            src={report.subject.imageUrl}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{report.subject.title}</span>
          <span className="block text-[11px] text-muted-foreground">
            de {report.subject.author}
          </span>
        </span>
      </Link>
    );
  }

  if (report.subject.kind === "comment") {
    return (
      <p className="rounded-lg bg-muted/60 p-2 text-sm">
        “{report.subject.body}”
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          de {report.subject.author}
        </span>
      </p>
    );
  }

  return (
    <Link to={`/chef/${report.subjectId}`} className="text-sm font-medium hover:underline">
      {report.subject.username}
    </Link>
  );
}

export function ReportQueue() {
  const [status, setStatus] = useState<"open" | "all">("open");
  const fila = useReports(status);
  const resolver = useResolveReport();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {fila.data ? `${fila.data.open} por tratar` : "…"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-full text-xs"
          onClick={() => setStatus(status === "open" ? "all" : "open")}
        >
          {status === "open" ? "Ver também as tratadas" : "Ver só as abertas"}
        </Button>
      </div>

      {fila.isLoading && <Skeleton className="h-28 w-full rounded-xl" />}

      {fila.data?.reports.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nada por tratar. É o que se quer.
        </p>
      )}

      <ul className="space-y-3">
        {fila.data?.reports.map((report) => (
          <li key={report.id} className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={report.reason === "perigoso" ? "destructive" : "secondary"}
                className="rounded-full text-[10px]"
              >
                {REASON_LABEL[report.reason] ?? report.reason}
              </Badge>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {SUBJECT_LABEL[report.subjectType]}
              </Badge>
              {report.reportsOnSubject > 1 && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {report.reportsOnSubject} denúncias
                </Badge>
              )}
              {report.status !== "open" && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {report.resolution}
                  {report.resolvedBy ? ` · ${report.resolvedBy}` : ""}
                </Badge>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground">
                {quando(report.createdAt)}
              </span>
            </div>

            <Conteudo report={report} />

            {report.details && (
              <p className="text-xs text-muted-foreground">
                {report.reportedBy}: “{report.details}”
              </p>
            )}

            {report.status === "open" && (
              <div className="flex gap-2 pt-1">
                {/* Uma conta não se apaga pela fila: a rota recusa, e oferecer
                    o botão era prometer o que o servidor não faz. */}
                {report.subjectType !== "user" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9 flex-1 rounded-full text-xs"
                    disabled={resolver.isPending || !report.subject}
                    onClick={() => resolver.mutate({ id: report.id, action: "remover" })}
                  >
                    <Trash2 className="mr-1.5 size-3.5" /> Remover
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 flex-1 rounded-full text-xs"
                  disabled={resolver.isPending}
                  onClick={() => resolver.mutate({ id: report.id, action: "arquivar" })}
                >
                  <Archive className="mr-1.5 size-3.5" /> Arquivar
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
