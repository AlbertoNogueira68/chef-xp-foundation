import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useReport } from "@/features/moderation/hooks/useModeration";
import type { ReportReason, ReportSubjectType } from "@/types/moderation";
import { t } from "@/i18n";

/**
 * Motivos fechados, com as palavras de quem cozinha e não as de um formulário
 * jurídico. "Perigoso" está lá porque esta aplicação é sobre comida: uma
 * receita que manda servir frango mal passado é um problema diferente de um
 * insulto, e quem modera precisa de os distinguir à primeira vista.
 */
const reasons = (): Array<{ value: ReportReason; label: string; hint: string }> => [
  { value: "ofensivo", label: t("Offensive"), hint: t("Insults, hate, harassment") },
  { value: "perigoso", label: t("Dangerous"), hint: t("Unsafe for anyone who follows it") },
  { value: "spam", label: t("Spam"), hint: t("Spam or repetition") },
  { value: "copia", label: t("Copy"), hint: t("Someone else's work, uncredited") },
  { value: "outro", label: t("Other"), hint: t("Explain below") },
];

const title = (tipo: ReportSubjectType) =>
  ({
    recipe: t("Report this recipe"),
    comment: t("Report this comment"),
    user: t("Report this account"),
  })[tipo];

export function ReportDialog({
  subjectType,
  subjectId,
  open,
  onOpenChange,
}: {
  subjectType: ReportSubjectType;
  subjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason>("ofensivo");
  const [details, setDetails] = useState("");
  const report = useReport();

  // Reabrir não traz o que se escreveu da vez anterior.
  useEffect(() => {
    if (open) {
      setReason("ofensivo");
      setDetails("");
    }
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    report.mutate(
      { subjectType, subjectId, reason, details: details.trim() || null },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>{title(subjectType)}</DialogTitle>
          <DialogDescription>
            {t(
              "It's logged under your name and only moderators see it. The person reported won't know it was you.",
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <RadioGroup value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
            {reasons().map((option) => (
              <Label
                key={option.value}
                htmlFor={`reason-${option.value}`}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/60 px-3 py-2"
              >
                <RadioGroupItem id={`reason-${option.value}`} value={option.value} />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>

          <div className="space-y-1.5">
            <Label htmlFor="report-details">{t("What's going on (optional)")}</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t("Two lines will do. The more specific, the faster it gets sorted.")}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" className="rounded-full" disabled={report.isPending}>
              {report.isPending ? t("Sending…") : t("Report")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
