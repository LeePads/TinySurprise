"use client";

import { useState } from "react";
import type { ExportBudgetEstimate } from "@/lib/export/types";
import { MAX_HTML_EXPORT_BYTES } from "@/lib/export/html-generator";
import { formatBytes } from "@/lib/format-bytes";

const formatMb = (bytes: number) => formatBytes(bytes);

export function MediaBudgetMeter({
  estimate,
  actualBytes,
}: {
  estimate: ExportBudgetEstimate;
  actualBytes?: number;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const bytes = actualBytes ?? estimate.conservativeBytes;
  const limit = estimate.limitBytes || MAX_HTML_EXPORT_BYTES;
  const ratio = Math.min(1, Math.max(0, bytes / limit));
  const remaining = Math.max(0, limit - bytes);
  const overLimit = bytes > limit;
  const nearLimit = !overLimit && ratio >= 0.8;

  return (
    <section className="w-full min-w-0 rounded-2xl border border-border bg-card/75 px-4 py-3 text-sm shadow-sm" aria-label="Surprise size">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Surprise size</h2>
          <p className={`mt-1 font-semibold tabular-nums ${overLimit ? "text-destructive" : nearLimit ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
            {actualBytes === undefined ? "About " : ""}{formatMb(bytes)} · {overLimit ? "Over the file limit" : `${formatMb(remaining)} left`}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
          className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          {detailsOpen ? "Hide details" : "Details"}
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${formatMb(bytes)} used and ${formatMb(remaining)} left`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(limit, bytes)}>
        <div className={`h-full rounded-full transition-[width] duration-300 ${overLimit ? "bg-destructive" : nearLimit ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{overLimit ? "Use smaller photos, videos, or music files before preparing your surprise." : actualBytes === undefined ? "Final size is checked when you prepare your surprise." : "Size of your ready-to-send file."}</p>
      {detailsOpen && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div><dt>Original photos and media</dt><dd className="font-semibold text-foreground">{formatMb(estimate.originalBytes)}</dd></div>
            <div><dt>Estimated recipient copy</dt><dd className="font-semibold text-foreground">{formatMb(estimate.predictedBytes)}</dd></div>
            <div><dt>Limit</dt><dd className="font-semibold text-foreground">{formatMb(limit)}</dd></div>
            <div><dt>Size estimate</dt><dd className="font-semibold text-foreground">{estimate.confidence === "exact-local" ? "Based on uploaded files" : estimate.confidence === "approximate" ? "Approximate" : "Needs checking"}</dd></div>
          </dl>
          {estimate.confidence === "unknown" && <p className="mt-2 text-xs text-muted-foreground">Some media still needs checking. Replace missing files or upload linked photos if they can’t be included.</p>}
        </div>
      )}
    </section>
  );
}

