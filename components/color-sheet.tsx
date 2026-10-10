"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "./ui/button";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface ColorSheetProps {
  open: boolean;
  onClose: () => void;
  value: string;
  swatches: string[];
  onApply: (color: string) => void;
  label?: string;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Android's replacement for a raw <input type="color"> — that opens the
 * gray OS color dialog, which looks nothing like the rest of the app and
 * lets a creator pick a color that clashes badly with the chosen theme.
 * Primary interaction is curated, theme-compatible swatches; a native color
 * input + hex field are still available, but tucked under "More options"
 * rather than being the main control.
 */
export function ColorSheet({
  open,
  onClose,
  value,
  swatches,
  onApply,
  label = "Choose a color",
}: ColorSheetProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(value);
  const [hexDraft, setHexDraft] = useState(value);
  const [moreOpen, setMoreOpen] = useState(false);
  const nativeColorRef = useRef<HTMLInputElement>(null);
  useModalBackHandler(open, onClose);
  useFocusTrap(open, panelRef, closeButtonRef, onClose);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setHexDraft(value);
      setMoreOpen(false);
    }
  }, [open, value]);

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  };

  const pick = (color: string) => {
    void hapticTap("selection");
    setDraft(color);
    setHexDraft(color);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[115] flex items-end justify-center bg-black/55 backdrop-blur-sm"
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
            className="android-sheet-panel w-full max-w-md rounded-t-[1.75rem] border border-border/70 bg-card p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{label}</h2>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border bg-secondary/25 p-3">
              <span
                className="h-9 w-9 shrink-0 rounded-full border-2 border-card shadow-sm"
                style={{ background: draft }}
                aria-hidden="true"
              />
              <span className="font-mono text-sm text-muted-foreground">{draft}</span>
            </div>

            <div
              className="mt-4 grid grid-cols-6 gap-2.5"
              role="radiogroup"
              aria-label="Swatches"
            >
              {swatches.map((swatch) => {
                const selected = swatch.toLowerCase() === draft.toLowerCase();
                return (
                  <button
                    key={swatch}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={swatch}
                    onClick={() => pick(swatch)}
                    className="grid aspect-square min-h-12 place-items-center rounded-full border-2 transition"
                    style={{
                      background: swatch,
                      borderColor: selected ? "var(--foreground)" : "transparent",
                    }}
                  >
                    {selected && (
                      <Check
                        className="h-4 w-4 drop-shadow"
                        style={{ color: "#fff" }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className="mt-4 text-xs font-bold text-primary"
            >
              {moreOpen ? "Hide more options" : "More options"}
            </button>
            {moreOpen && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => nativeColorRef.current?.click()}
                  className="h-12 w-14 shrink-0 rounded-xl border"
                  style={{ background: draft }}
                  aria-label="Pick a custom color"
                />
                <input
                  ref={nativeColorRef}
                  type="color"
                  className="sr-only"
                  value={HEX_PATTERN.test(draft) ? draft : "#000000"}
                  onChange={(event) => pick(event.target.value)}
                />
                <input
                  type="text"
                  inputMode="text"
                  placeholder="#RRGGBB"
                  value={hexDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    setHexDraft(next);
                    if (HEX_PATTERN.test(next)) setDraft(next);
                  }}
                  className="min-h-12 flex-1 rounded-xl border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  aria-label="Custom hex color"
                />
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void hapticTap();
                  onApply(draft);
                  onClose();
                }}
              >
                Apply
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
