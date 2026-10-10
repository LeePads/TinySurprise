"use client";
import * as React from "react";

import { TextBudget } from "./text-budget";
import { useTextBudget } from "./use-text-budget";

import { cn } from "@/lib/utils";

function Textarea({ className, textBudget, budgetRequired, budgetMode = "limit", ...props }: React.ComponentProps<"textarea"> & { textBudget?: number; budgetRequired?: boolean; budgetMode?: "limit" | "recommendation" }) {
  const budgetId = "text-budget-" + React.useId().replace(/:/g, "");
  const limit = useTextBudget(props.value, textBudget, budgetMode === "recommendation", props.defaultValue);
  return (
    <>
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-28 w-full resize-y rounded-[var(--radius-input)] border border-border/75 bg-card/65 px-4 py-3 text-base leading-7 text-foreground shadow-[var(--shadow-field)] transition-[background-color,border-color,box-shadow,transform] duration-200 outline-none hover:border-primary/45 hover:bg-card/85 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-[var(--shadow-field-focus)] placeholder:text-muted-foreground/55 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/35",
        className,
      )}
      {...props}
      maxLength={textBudget ? limit.maximum : props.maxLength}
      onChange={event => limit.change(event, props.onChange as React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>)}
      onPaste={event => { props.onPaste?.(event); if (!event.defaultPrevented) limit.paste(event); }}
      onBeforeInput={event => { props.onBeforeInput?.(event); if (!event.defaultPrevented) limit.before(event); }}
      aria-invalid={props["aria-invalid"] || (budgetRequired && textBudget && typeof props.value === "string" && props.value.length > textBudget ? true : undefined)}
      aria-describedby={[props["aria-describedby"], textBudget ? budgetId : undefined].filter(Boolean).join(" ") || undefined}
    />
    {textBudget && <TextBudget id={budgetId} value={limit.current} budget={textBudget} required={budgetRequired} recommendation={budgetMode === "recommendation"} feedback={limit.feedback} />}
    </>
  );
}

export { Textarea };
