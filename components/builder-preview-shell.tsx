"use client";
import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
import type { BuilderPreviewMode } from "@/lib/use-builder-preview-mode";
import { PreviewSuspendedContext } from "@/lib/preview-activity";
interface BuilderPreviewShellProps {
  mode: BuilderPreviewMode; label: string; collapsed: boolean;
  onToggleCollapse: () => void; onOpenFullPreview?: () => void; children: React.ReactNode;
}
/** Retain experience identity through rotation/keyboard changes without
 * reserving space or playing media while the preview pane is collapsed. */
export function BuilderPreviewShell({ mode, label, collapsed, onToggleCollapse, onOpenFullPreview, children }: BuilderPreviewShellProps) {
  const hidden = mode === "short-landscape" || (mode === "compact" && collapsed);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hidden) contentRef.current?.querySelectorAll<HTMLMediaElement>("audio,video").forEach(media => media.pause());
  }, [hidden]);
  return <div className="min-w-0">
    <PreviewSuspendedContext.Provider value={hidden}>
      <div ref={contentRef} hidden={hidden} inert={hidden} className={hidden ? "preview-suspended" : undefined}>{children}</div>
    </PreviewSuspendedContext.Provider>
    <div className="mt-2 flex min-h-12 flex-wrap items-center justify-between gap-2">
      {hidden && <span className="text-sm text-muted-foreground">{label} collapsed</span>}
      {mode === "compact" && <button type="button" onClick={onToggleCollapse} aria-expanded={!hidden} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold">
        {hidden ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}{hidden ? "Show preview" : "Collapse"}
      </button>}
      {onOpenFullPreview && <button type="button" onClick={onOpenFullPreview} className="inline-flex min-h-12 items-center gap-2 rounded-full border bg-card px-3 text-sm font-semibold text-primary"><Maximize2 className="h-4 w-4" />Open full preview</button>}
    </div>
  </div>;
}
