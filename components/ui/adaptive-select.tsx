"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";
import { isNativePlatform } from "@/lib/platform";
import { useAndroidWideLayout } from "@/lib/use-media-query";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";

export interface AdaptiveSelectOption {
  value: string;
  label: string;
}

interface AdaptiveSelectProps {
  id?: string;
  label: string;
  value: string;
  options: AdaptiveSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

const TRIGGER_CLASS =
  "mt-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-card px-3 text-left text-sm";

/**
 * Drop-in replacement for a plain <select>. On the web build this renders
 * the exact same <select> markup as before (byte-identical output, so web
 * behavior is unchanged). On Android it never touches the OS's native
 * picker: portrait renders a bottom sheet, landscape/tablet a compact
 * centered dialog — both hand-rolled to match the focus-trap/backdrop/
 * Escape conventions already established by confirmation-modal.tsx.
 */
export function AdaptiveSelect({
  id,
  label,
  value,
  options,
  onChange,
  className,
}: AdaptiveSelectProps) {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);

  if (!native) {
    return (
      <select
        id={id}
        aria-label={label}
        className={className ?? TRIGGER_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <NativeAdaptiveSelect
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      className={className}
    />
  );
}

function NativeAdaptiveSelect({
  id,
  label,
  value,
  options,
  onChange,
  className,
}: AdaptiveSelectProps) {
  const [open, setOpen] = useState(false);
  const wide = useAndroidWideLayout();
  const selected = options.find((option) => option.value === value);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const select = useCallback(
    (next: string) => {
      void hapticTap("selection");
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={className ?? TRIGGER_CLASS}
      >
        <span className="truncate">{selected?.label ?? "Select"}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
      {wide ? (
        <AdaptiveSelectDialog
          open={open}
          label={label}
          value={value}
          options={options}
          onClose={close}
          onSelect={select}
        />
      ) : (
        <AdaptiveSelectSheet
          open={open}
          label={label}
          value={value}
          options={options}
          onClose={close}
          onSelect={select}
        />
      )}
    </>
  );
}

interface PanelProps {
  open: boolean;
  label: string;
  value: string;
  options: AdaptiveSelectOption[];
  onClose: () => void;
  onSelect: (value: string) => void;
}

/** Shared focus-trap/Escape/body-scroll-lock behavior for both variants (mirrors confirmation-modal.tsx). */
function useDialogBehavior(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  useModalBackHandler(open, onClose);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      const selectedOption = panelRef.current?.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]',
      );
      (selectedOption || panelRef.current?.querySelector("button"))?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose, panelRef]);
}

function OptionList({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: AdaptiveSelectOption[];
  onSelect: (value: string) => void;
}) {
  return (
    <ul role="listbox" aria-label={label} className="space-y-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <li key={option.value}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(option.value)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-medium transition ${selected ? "bg-primary/12 text-foreground" : "text-foreground hover:bg-secondary"}`}
            >
              {option.label}
              {selected && (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AdaptiveSelectSheet({ open, label, value, options, onClose, onSelect }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useDialogBehavior(open, onClose, panelRef);

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="android-sheet-panel w-full max-w-md rounded-t-[1.75rem] border border-border/70 bg-card p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-sm font-bold">{label}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto px-1 pb-1">
              <OptionList label={label} value={value} options={options} onSelect={onSelect} />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AdaptiveSelectDialog({ open, label, value, options, onClose, onSelect }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  useDialogBehavior(open, onClose, panelRef);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[105] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="w-full max-w-xs rounded-[var(--radius-dialog)] border border-border/70 bg-card p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-sm font-bold">{label}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-1 pb-1">
              <OptionList label={label} value={value} options={options} onSelect={onSelect} />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
