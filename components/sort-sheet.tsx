"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";
import type { CreationSortKey } from "@/lib/creations";

interface SortSheetProps {
  open: boolean;
  onClose: () => void;
  value: CreationSortKey;
  onSelect: (value: CreationSortKey) => void;
}

const OPTIONS: { value: CreationSortKey; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Name" },
  { value: "template", label: "Template" },
];

/** Android's "Sort" bottom sheet — replaces the full-width desktop-style dropdown in My Surprises. */
export function SortSheet({ open, onClose, value, onSelect }: SortSheetProps) {
  const reduceMotion = useReducedMotion();
  useModalBackHandler(open, onClose);

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
            role="dialog"
            aria-modal="true"
            aria-label="Sort by"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="android-sheet-panel w-full max-w-md rounded-t-[1.75rem] border border-border/70 bg-card p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-sm font-bold">Sort by</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul role="radiogroup" aria-label="Sort by" className="space-y-0.5 px-1">
              {OPTIONS.map((option) => {
                const selected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        void hapticTap("selection");
                        onSelect(option.value);
                        onClose();
                      }}
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
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
