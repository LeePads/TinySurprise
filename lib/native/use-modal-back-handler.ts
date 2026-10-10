"use client";

import { useEffect, useRef } from "react";
import { registerBackHandler } from "./back-handler";

/**
 * Wires the Android hardware back button to close a sheet/dialog/overlay
 * while it's open. Handlers register with lib/native/back-handler.ts's
 * module-level stack only for the lifetime of `open`, and the stack is
 * checked newest-first — so anything opened later (a select sheet on top of
 * a full-screen preview, say) is always closed before whatever is under it,
 * with no extra priority bookkeeping needed.
 */
export function useModalBackHandler(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    return registerBackHandler(() => {
      onCloseRef.current();
      return true;
    });
  }, [open]);
}
