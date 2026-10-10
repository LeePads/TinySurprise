"use client";

import { useEffect, useRef, type RefObject } from "react";
import { usePreviewSuspended } from "./preview-activity";
import { useFocusTrap } from "./use-focus-trap";
import { useModalBackHandler } from "./native/use-modal-back-handler";

interface RecipientOverlayOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialRef?: RefObject<HTMLElement | null>;
  fallbackReturnRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * Shared behavior for recipient-facing dialogs and preview overlays. The
 * existing focus trap and newest-first native Back stack remain the sources
 * of truth; this hook adds background inertness and keeps their lifetimes in
 * lockstep so one Back/Escape press closes only the topmost layer.
 */
export function useRecipientOverlay({
  open,
  containerRef,
  initialRef,
  fallbackReturnRef,
  onClose,
}: RecipientOverlayOptions): void {
  const suspended = usePreviewSuspended();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { if (suspended && open) closeRef.current(); }, [suspended, open]);
  useFocusTrap(open && !suspended, containerRef, initialRef, onClose, fallbackReturnRef);
  useModalBackHandler(open && !suspended, onClose);

  useEffect(() => {
    if (!open || suspended) return;
    const container = containerRef.current;
    window.dispatchEvent(new CustomEvent("tiny-recipient-overlay-open", { detail: { container } }));
    const parent = container?.parentElement;
    if (!container || !parent) return;

    container.querySelectorAll<HTMLElement>(".recipient-completion-body,.recipient-completion-panel").forEach(element => { element.scrollTop = 0; });
    const panel = container.querySelector<HTMLElement>(".recipient-completion-panel");
    const body = panel?.querySelector<HTMLElement>(".recipient-completion-body");
    const measurePanel = () => {
      if (!panel || !body) return;
      const style = getComputedStyle(panel);
      const fixedHeight = Array.from(panel.children).filter(element => element !== body).reduce((height, element) => {
        const childStyle = getComputedStyle(element);
        return height + element.getBoundingClientRect().height + parseFloat(childStyle.marginTop) + parseFloat(childStyle.marginBottom);
      }, parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
      panel.dataset.scrollWhole = String(fixedHeight > parseFloat(style.maxHeight) * 0.55);
    };
    const resize = panel && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measurePanel) : undefined;
    if (panel) { resize?.observe(panel); Array.from(panel.children).filter(element => element !== body).forEach(element => resize?.observe(element)); }
    measurePanel();
    const siblings: HTMLElement[] = [];
    const boundary = container.closest(".recipient-preview-surface");
    let branch: HTMLElement = container;
    do {
      const parent = branch.parentElement;
      if (!parent) break;
      siblings.push(...Array.from(parent.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== branch));
      branch = parent;
    } while (boundary && branch !== boundary);
    const previous = siblings.map((element) => ({
      element,
      inert: (element as HTMLElement & { inert?: boolean }).inert ?? false,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    siblings.forEach((element) => {
      (element as HTMLElement & { inert?: boolean }).inert = true;
      element.setAttribute("aria-hidden", "true");
    });

    return () => {
      resize?.disconnect();
      previous.forEach(({ element, inert, ariaHidden }) => {
        (element as HTMLElement & { inert?: boolean }).inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
    };
  }, [open, suspended, containerRef]);
}
