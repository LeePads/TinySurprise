"use client";

import { useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from "react";

/** Saved oversized text remains editable. Reject oversized additions as a whole;
 * never slice a paste, emoji, restored value, or autosaved field. */
export function useTextBudget(value: unknown, budget?: number, recommendation = false, defaultValue?: unknown) {
  const [feedback, setFeedback] = useState("");
  const [uncontrolledText, setUncontrolledText] = useState(typeof defaultValue === "string" ? defaultValue : "");
  const current = typeof value === "string" ? value : value === undefined ? uncontrolledText : "";
  const maximum = budget === undefined || recommendation ? undefined : Math.max(budget, current.length);
  const permits = (next: string) => maximum === undefined || next.length <= maximum;
  const reject = () => setFeedback(`Maximum ${budget} characters.`);
  return {
    maximum,
    current,
    feedback,
    before(event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) {
      if (maximum === undefined) return;
      const native = event.nativeEvent as InputEvent;
      if (!native.data || !native.inputType?.startsWith("insert") || native.isComposing) return;
      const input = event.currentTarget;
      const next = current.slice(0, input.selectionStart ?? current.length) + native.data + current.slice(input.selectionEnd ?? current.length);
      if (!permits(next)) { event.preventDefault(); reject(); }
    },
    change(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, next?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void) {
      if (!permits(event.target.value)) { reject(); event.target.value = current; return; }
      setFeedback("");
      if (value === undefined && budget !== undefined) setUncontrolledText(event.target.value);
      next?.(event);
    },
    paste(event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
      if (maximum === undefined) return;
      const input = event.currentTarget;
      const next = current.slice(0, input.selectionStart ?? current.length) + event.clipboardData.getData("text") + current.slice(input.selectionEnd ?? current.length);
      if (!permits(next)) { event.preventDefault(); reject(); }
    },
  };
}
