"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

export function LibraryToast({ message, blocked, onDismiss }: { message: string; blocked: boolean; onDismiss: () => void }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!message || blocked) return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [message, blocked, onDismiss]);
  return <AnimatePresence>{message && !blocked && <motion.div
    key={message} className="library-toast fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] left-[max(1rem,env(safe-area-inset-left))] z-[90] flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[var(--shadow-soft)] sm:left-auto sm:max-w-sm"
    initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .16 }}>
    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
    <p role="status" aria-live="polite" className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{message}</p>
    <button type="button" className="-m-2 grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-secondary" aria-label="Dismiss notification" onClick={onDismiss}><X className="h-4 w-4" /></button>
  </motion.div>}</AnimatePresence>;
}
