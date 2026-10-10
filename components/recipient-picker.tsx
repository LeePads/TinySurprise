"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Search, User, UserPlus, X } from "lucide-react";
import { TEXT_LIMITS } from "@/lib/text-limits";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  listRecentRecipients,
  touchRecipient,
  type RecipientRecord,
} from "@/lib/recipients";

export interface RecipientSelection {
  id?: string;
  displayName: string;
  nickname?: string;
  relationship?: string;
}

interface RecipientPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (recipient: RecipientSelection) => void;
}

/**
 * Native-only "Choose recipient" sheet (Section F/G) — search, recent
 * saved recipients, and an inline "Add someone new" form. The web builder
 * keeps its plain text input untouched; this is additive Android UI only,
 * reached from StepBasics.
 */
export function RecipientPicker({ open, onClose, onSelect }: RecipientPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const [recent, setRecent] = useState<RecipientRecord[]>();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"browse" | "add">("browse");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const dismiss = () => {
    if (mode === "add") setMode("browse");
    else onClose();
  };
  useModalBackHandler(open, dismiss);
  useFocusTrap(open, panelRef, searchInputRef, dismiss);

  useEffect(() => {
    if (!open) return;
    setMode("browse");
    setQuery("");
    setName("");
    setNickname("");
    setRelationship("");
    setRecent(undefined);
    setLoadError("");
    setSaveError("");
    let active = true;
    void listRecentRecipients(12).then((records) => {
      if (!active) return;
      setRecent(records);
      if (!records.length) setMode("add");
    }).catch(() => {
      if (!active) return;
      setLoadError("Saved names couldn’t be loaded. You can still enter a name below.");
      setMode("add");
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target = mode === "add" ? nameInputRef.current : searchInputRef.current;
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, open, recent]);

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  };

  const pick = (recipient: RecipientSelection) => {
    void hapticTap("selection");
    onSelect(recipient);
    onClose();
  };

  const visible = (recent || []).filter((recipient) =>
    recipient.displayName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const identityTooLong = name.length > TEXT_LIMITS.name || nickname.length > TEXT_LIMITS.recipientDetail || relationship.length > TEXT_LIMITS.recipientDetail;
  const saveNew = async () => {
    if (!name.trim() || saving || identityTooLong) return;
    setSaving(true);
    setSaveError("");
    try {
      const record = await touchRecipient({
        displayName: name,
        nickname,
        relationship,
      });
      pick(record);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "The recipient could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
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
            aria-label={mode === "add" ? "Add recipient" : "Choose recipient"}
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="android-sheet-panel max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] border border-border/70 bg-card p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {mode === "add" ? "Their name" : "Who is it for?"}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {loadError && <p role="alert" className="mt-3 text-sm text-destructive">{loadError}</p>}

            {mode === "browse" && recent === undefined && !loadError ? (
              <p role="status" className="mt-4 text-sm text-muted-foreground">Loading saved names…</p>
            ) : mode === "browse" ? (
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search or type a new name"
                    className="min-h-12 w-full rounded-xl border bg-background pl-9 pr-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    aria-label="Search recipients"
                  />
                </div>
                {visible.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">
                      Recent
                    </p>
                    <ul className="mt-2 space-y-1">
                      {visible.map((recipient) => (
                        <li key={recipient.id}>
                          <button
                            type="button"
                            onClick={() => pick(recipient)}
                            className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-secondary"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                              <User className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">
                                {recipient.displayName}
                              </span>
                              {recipient.relationship && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {recipient.relationship}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {query.trim() && (
                  <Button
                    variant="outline"
                    className="min-h-12 w-full justify-start"
                    onClick={() => {
                      setName(query.trim());
                      setMode("add");
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Use &quot;{query.trim()}&quot;
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="min-h-12 w-full justify-start text-primary"
                  onClick={() => {
                    setName(query.trim());
                    setMode("add");
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add someone new
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="recipient-picker-name" className="mb-1.5 block text-sm font-semibold">
                    Their name <span className="text-primary">*</span>
                  </label>
                  <Input
                    id="recipient-picker-name"
                    ref={nameInputRef}
                    required
                    textBudget={TEXT_LIMITS.name} budgetRequired
                    placeholder="Who will open this?"
                    value={name}
                    aria-describedby="recipient-picker-save-error"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <details>
                  <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">Optional details</summary>
                <div>
                  <label htmlFor="recipient-picker-nickname" className="mb-1.5 block text-sm font-semibold">
                    Nickname <span className="font-normal text-muted-foreground">Optional</span>
                  </label>
                  <Input
                    id="recipient-picker-nickname"
                    textBudget={TEXT_LIMITS.recipientDetail} budgetRequired
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="recipient-picker-relationship" className="mb-1.5 block text-sm font-semibold">
                    Relationship <span className="font-normal text-muted-foreground">Optional</span>
                  </label>
                  <Input
                    id="recipient-picker-relationship"
                    textBudget={TEXT_LIMITS.recipientDetail} budgetRequired
                    placeholder="Friend, partner, family…"
                    value={relationship}
                    onChange={(event) => setRelationship(event.target.value)}
                  />
                </div>
                </details>
                <p className="text-xs text-muted-foreground">We’ll keep this name on this device for next time.</p>
                <p id="recipient-picker-save-error" role={saveError ? "alert" : undefined} className="text-sm text-destructive">{saveError}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => setMode("browse")}>
                    Back
                  </Button>
                  <Button disabled={!name.trim() || saving || identityTooLong} onClick={() => void saveNew()}>
                    {saving ? "Saving…" : "Use this name"}
                  </Button>
                </div>
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
