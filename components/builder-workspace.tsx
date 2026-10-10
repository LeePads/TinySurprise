import type { ReactNode } from "react";

interface BuilderWorkspaceProps {
  children: ReactNode;
  preview?: ReactNode;
  className?: string;
}

/**
 * The shared desktop frame for builder steps. The web shell turns this into
 * an editor/preview workspace; native layouts keep the normal flow and their
 * existing Android-specific preview behavior.
 */
export function BuilderWorkspace({
  children,
  preview,
  className = "",
}: BuilderWorkspaceProps) {
  const hasPreview = preview !== undefined;

  return (
    <div
      className={`builder-workspace ${hasPreview ? "builder-workspace--with-preview" : "builder-workspace--single"} ${className}`.trim()}
    >
      <div className="builder-workspace__editor">{children}</div>
      {hasPreview && (
        <aside className="builder-workspace__preview">{preview}</aside>
      )}
    </div>
  );
}
