"use client";
import { useEffect, useRef } from "react";

let pendingField: string | undefined;
let cancelPrevious: (() => void) | undefined;

/** Survives the step transition so a newly mounted editor can reveal its item. */
export function requestReviewField(id?: string) {
  cancelPrevious?.();
  if (!id) return;
  pendingField = id;
  const readyAt = performance.now() + 350;
  const focus = () => {
    if (performance.now() < readyAt) return;
    const field = document.getElementById(id);
    if (!field || !field.getClientRects().length) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: "center", behavior: "instant" });
    cancelPrevious?.();
  };
  const observer = new MutationObserver(focus);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  const timer = window.setTimeout(() => cancelPrevious?.(), 4000);
  const settle = window.setTimeout(focus, 360);
  cancelPrevious = () => { observer.disconnect(); clearTimeout(timer); clearTimeout(settle); pendingField = undefined; cancelPrevious = undefined; };
  window.dispatchEvent(new CustomEvent("tiny-review-field", { detail: id }));
  requestAnimationFrame(focus);
}

export function useReviewField(reveal: (id: string) => void) {
  const revealRef = useRef(reveal);
  useEffect(() => { revealRef.current = reveal; }, [reveal]);
  useEffect(() => {
    if (pendingField) revealRef.current(pendingField);
    const listener = (event: Event) => revealRef.current((event as CustomEvent<string>).detail);
    window.addEventListener("tiny-review-field", listener);
    return () => window.removeEventListener("tiny-review-field", listener);
  }, []);
}
