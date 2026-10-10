"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), iframe, summary, textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (element.closest("[inert]") || element.hasAttribute("disabled") || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
  });
}

interface FocusTrapEntry {
  containerRef: RefObject<HTMLElement | null>;
}

const focusTrapStack: FocusTrapEntry[] = [];

function isTopmost(entry: FocusTrapEntry): boolean {
  return focusTrapStack[focusTrapStack.length - 1] === entry;
}

/** Keeps keyboard focus inside an in-app dialog and returns it to the trigger. */
export function useFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialRef?: RefObject<HTMLElement | null>,
  onEscape?: () => void,
  fallbackReturnRef?: RefObject<HTMLElement | null>,
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousParentRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) return;
    const entry: FocusTrapEntry = { containerRef };
    focusTrapStack.push(entry);
    const activeElement = document.activeElement as HTMLElement | null;
    previousFocusRef.current = activeElement;
    previousParentRef.current = activeElement?.parentElement ?? null;
    const fallbackReturn = fallbackReturnRef?.current;

    const focusInitial = () => {
      if (!isTopmost(entry)) return;
      const initial = initialRef?.current;
      if (initial?.isConnected && !initial.hasAttribute("disabled") && !initial.closest("[inert]") && initial.getClientRects().length) {
        initial.focus({ preventScroll: true });
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      getFocusableElements(container)[0]?.focus();
    };
    const initialFrame = requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost(entry)) return;
      const container = containerRef.current;
      if (!container) return;
      if (event.key === "Escape" && onEscapeRef.current) {
        if (!container.contains(document.activeElement)) return;
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(container);
      if (!focusable.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!container.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      const index = focusTrapStack.indexOf(entry);
      cancelAnimationFrame(initialFrame);
      if (index !== -1) focusTrapStack.splice(index, 1);
      document.removeEventListener("keydown", handleKeyDown);
      requestAnimationFrame(() => {
        const top = focusTrapStack[focusTrapStack.length - 1];
        const mayReturn = (target: HTMLElement) => !top || Boolean(top.containerRef.current?.contains(target));
        const previous = previousFocusRef.current;
        if (previous && mayReturn(previous) && document.contains(previous) && !previous.hasAttribute("disabled") && !previous.closest("[inert]") && previous.getClientRects().length && getComputedStyle(previous).visibility !== "hidden") {
          previous.focus({ preventScroll: true });
          return;
        }
        const fallback = fallbackReturn;
        if (fallback && mayReturn(fallback) && fallback.isConnected && !fallback.closest("[inert]") && fallback.getClientRects().length) {
          fallback.focus({ preventScroll: true }); return;
        }
        const nearby = previousParentRef.current && getFocusableElements(previousParentRef.current)[0];
        if (nearby && mayReturn(nearby) && document.contains(nearby)) nearby.focus();
      });
    };
  }, [open, containerRef, initialRef, fallbackReturnRef]);
}
