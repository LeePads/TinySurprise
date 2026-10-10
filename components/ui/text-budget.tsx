import { countText } from "@/lib/text-limits";

export function TextBudget({ id, value, budget, required, recommendation, feedback }: { id: string; value: unknown; budget: number; required?: boolean; recommendation?: boolean; feedback?: string }) {
  const count = countText(typeof value === "string" ? value : "");
  const over = count > budget;
  return <div id={id} className="mt-1 text-xs text-muted-foreground">
    <span className="block text-right tabular-nums">{count} / {budget}</span>
    <span className="sr-only">{recommendation ? "Recommended length." : "Maximum for new input."} Some emoji count as more than one character.</span>
    <span className="block" role="status">{feedback || (over ? "This saved message is over the limit. Your text is preserved." : "")}{over && required && <span className="sr-only"> Shorten it before finalizing. Editable backups preserve the full text.</span>}</span>
  </div>;
}
