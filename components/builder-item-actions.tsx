"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface BuilderItemActionsProps {
  itemLabel: string;
  index: number;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  canRemove: boolean;
  onMoveEarlier?: () => void;
  onMoveLater?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

/** Compact, keyboard-friendly actions for reorderable builder items. */
export function BuilderItemActions({
  itemLabel,
  index,
  canMoveEarlier,
  canMoveLater,
  canRemove,
  onMoveEarlier,
  onMoveLater,
  onRemove,
  removeLabel = `Remove ${itemLabel.toLowerCase()}`,
}: BuilderItemActionsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [open]);

  const run = (action?: () => void) => {
    action?.();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="ghost"
        className="min-h-12 min-w-12"
        aria-label={`Actions for ${itemLabel.toLowerCase()} ${index + 1}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 grid min-w-48 gap-1 rounded-xl border border-border bg-background p-1 shadow-lg"
          role="menu"
          aria-label={`${itemLabel} ${index + 1} actions`}
        >
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 justify-start"
            role="menuitem"
            disabled={!canMoveEarlier}
            onClick={() => run(onMoveEarlier)}
          >
            <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
            Move earlier
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 justify-start"
            role="menuitem"
            disabled={!canMoveLater}
            onClick={() => run(onMoveLater)}
          >
            <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
            Move later
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 justify-start text-destructive hover:text-destructive"
            role="menuitem"
            disabled={!canRemove}
            onClick={() => run(onRemove)}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {removeLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
