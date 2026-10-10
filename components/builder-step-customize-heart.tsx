"use client";
import { useReviewField } from "@/lib/review-field";
import { TEXT_LIMITS } from "@/lib/text-limits";


import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Heart,
  Images,
  Plus,
  Trash2,
} from "lucide-react";
import { ImagePicker } from "./image-picker";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { ConfirmationModal } from "./confirmation-modal";
import { HeartStylePicker } from "./builder/heart-style-picker";
import { BuilderItemActions } from "./builder-item-actions";
import { createLocalImageWithMetadata, createStableId, revokeLocalImage } from "@/lib/local-media";
import {
  appendHeartMemory,
  assignPhotosToMemories,
  MAX_HEART_MEMORIES,
} from "@/lib/heart-memories";
import { getTemplateExperienceDefinition } from "@/lib/template-experience-definitions";
import { validateImageSignature } from "@/lib/validation";
import { useValidationAttempted } from "@/lib/use-validation-attempted";
import type { CatchTheHeartContent, HeartItem, LocalImage, SurpriseData } from "@/lib/types";

type PreparedMemory = HeartItem & { photo: LocalImage };
type BatchReceipt = {
  prepared: PreparedMemory[];
  invalid: number;
  overflow: number;
  before: Partial<CatchTheHeartContent>;
};

export function StepCustomizeHeart({
  data,
  onUpdate,
}: {
  data: Partial<CatchTheHeartContent>;
  onUpdate: (v: Partial<CatchTheHeartContent> | ((current: SurpriseData["content"]) => Partial<CatchTheHeartContent>)) => void;
}) {
  const c = {
    hearts: [],
    finalMessage: "",
    soundEffects: false,
    heartStyle: "classic" as const,
    ...data,
  };
  const bulk = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "warning" | "error">("info");
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const stagedRef = useRef<PreparedMemory[]>([]);
  const [receipt, setReceipt] = useState<BatchReceipt>();
  const [activeMemory, setActiveMemory] = useState<string>();
  useReviewField(id => { const item = c.hearts.find(item => id === `heart-note-${item.id}`); if (item) setActiveMemory(item.id); });
  const showErrors = useValidationAttempted();
  const limits = getTemplateExperienceDefinition("catch-the-heart").limits;
  const maxMemories = limits.compatibilityMax ?? limits.recommendedMax ?? MAX_HEART_MEMORIES;
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stagedRef.current.forEach((memory) => revokeLocalImage(memory.photo));
      stagedRef.current = [];
    };
  }, []);
  // Count from committed props, never perform feedback or URL cleanup in the
  // state updater (React may replay it). Layout timing keeps the receipt and
  // its unused media settled before another interaction can begin.
  useLayoutEffect(() => {
    if (!receipt || receipt.before === data) return;
    const accepted = new Set(c.hearts.flatMap((heart) => heart.photo ? [heart.photo.id] : []));
    const added = receipt.prepared.filter((memory) => accepted.has(memory.photo.id)).length;
    receipt.prepared.forEach((memory) => {
      if (!accepted.has(memory.photo.id)) revokeLocalImage(memory.photo);
    });
    const skipped = receipt.overflow + receipt.prepared.length - added;
    const parts = [`${added} ${added === 1 ? "photo" : "photos"} added`];
    if (receipt.invalid) parts.push(`${receipt.invalid} invalid or unreadable`);
    if (skipped) parts.push(`${skipped} skipped because no photo slots remain`);
    setStatus(`${parts.join(" · ")}.`);
    setStatusTone(added ? receipt.invalid || skipped ? "warning" : "success" : "error");
    setReceipt(undefined);
    processingRef.current = false;
    setProcessing(false);
  }, [data, c.hearts, receipt]);
  // One memory open at a time; the first is open by default. Collapsing only
  // hides the panel — photo, framing metadata, note and order all live in
  // `c.hearts`, so nothing is discarded.
  const expanded = (id: string) => (activeMemory || c.hearts[0]?.id) === id;
  useEffect(() => {
    const revealFirstInvalid = () => {
      const firstInvalid = c.hearts.find(
        (heart) => !heart.message.trim() && !heart.photo,
      );
      if (firstInvalid) setActiveMemory(firstInvalid.id);
    };
    window.addEventListener("tiny-validation-attempted", revealFirstInvalid);
    return () =>
      window.removeEventListener(
        "tiny-validation-attempted",
        revealFirstInvalid,
      );
  }, [c.hearts]);
  const memoryStatus = (h: HeartItem) =>
    h.photo
      ? h.message.trim()
        ? "Photo ready · Note added"
        : "Photo ready"
      : h.message.trim()
        ? "Note added"
        : "No photo";
  const update = (id: string, v: Partial<HeartItem>) =>
    onUpdate((current) => ({
      hearts: (current as CatchTheHeartContent).hearts.map((h) => (h.id === id ? { ...h, ...v } : h)),
    }));
  const remove = (id: string) =>
    { if (!processingRef.current) onUpdate({ hearts: c.hearts.filter((h) => h.id !== id) }); };
  const move = (index: number, direction: -1 | 1) => {
    if (processingRef.current) return;
    const target = index + direction;
    if (target < 0 || target >= c.hearts.length) return;
    const hearts = [...c.hearts];
    [hearts[index], hearts[target]] = [hearts[target], hearts[index]];
    onUpdate({ hearts });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length || processingRef.current) return;
    const selectedFiles = Array.from(files);
    const capacity = c.hearts.filter((heart) => !heart.photo).length + Math.max(0, maxMemories - c.hearts.length);
    if (!capacity) {
      setStatus(`All ${maxMemories} memories already have photos. Remove a photo before adding more.`);
      setStatusTone("warning");
      if (bulk.current) bulk.current.value = "";
      return;
    }
    processingRef.current = true;
    setProcessing(true);
    setStatus(`Preparing ${selectedFiles.length} ${selectedFiles.length === 1 ? "photo" : "photos"}…`);
    setStatusTone("info");
    const prepared: PreparedMemory[] = [];
    stagedRef.current = prepared;
    let invalid = 0;
    let overflow = 0;
    let handedOff = false;
    try {
      for (const file of selectedFiles) {
        if (!mountedRef.current) return;
        try {
          const result = await validateImageSignature(file);
          if (!result.valid) { invalid++; continue; }
          if (prepared.length >= capacity) { overflow++; continue; }
          const photo = await createLocalImageWithMetadata(file);
          if (!mountedRef.current) { revokeLocalImage(photo); return; }
          prepared.push({ id: createStableId("heart"), message: "", photo });
        } catch {
          invalid++;
        }
      }
      if (!mountedRef.current) return;
      if (!prepared.length) {
        setStatus(`${invalid} ${invalid === 1 ? "photo" : "photos"} invalid or unreadable. Try JPG, PNG, WebP, or GIF up to 5 MB.`);
        setStatusTone("error");
        return;
      }
      // Only the pure assignment runs in the builder updater. Notes and photos
      // changed while the files were read are merged against current content.
      setReceipt({ prepared, invalid, overflow, before: data });
      onUpdate((current) => ({
        hearts: assignPhotosToMemories((current as CatchTheHeartContent).hearts, prepared, maxMemories),
      }));
      handedOff = true;
      stagedRef.current = [];
    } catch {
      if (mountedRef.current) {
        setReceipt(undefined);
        setStatus("Photos could not be added. Please try choosing them again.");
        setStatusTone("error");
      }
    } finally {
      if (bulk.current) bulk.current.value = "";
      if (!handedOff) {
        prepared.forEach((memory) => revokeLocalImage(memory.photo));
        stagedRef.current = [];
        processingRef.current = false;
        if (mountedRef.current) setProcessing(false);
      }
    }
  };

  const memoryCount = c.hearts.length;
  const emptyPhotoSlots = c.hearts.filter((heart) => !heart.photo).length;
  const remainingMemories = Math.max(0, maxMemories - memoryCount);
  const memoryCountLabel =
    memoryCount >= maxMemories
      ? emptyPhotoSlots
        ? `${memoryCount} memories · ${emptyPhotoSlots} ${emptyPhotoSlots === 1 ? "photo slot" : "photo slots"} available`
        : `${memoryCount} memories · Limit reached`
      : remainingMemories <= 2
        ? `${memoryCount} memories · ${remainingMemories} ${remainingMemories === 1 ? "space" : "spaces"} left`
        : `${memoryCount} memories`;

  return (
    <div className="builder-workspace builder-workspace--single builder-workspace--customize min-w-0 max-w-full">
    <div className="builder-workspace__editor min-w-0 max-w-full space-y-7">
      <HeartStylePicker
        value={c.heartStyle || "classic"}
        onChange={(heartStyle) => onUpdate({ heartStyle })}
      />
      <section>
        <div className="flex min-w-0 gap-3">
          <Heart className="h-6 w-6 fill-current text-primary" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">
              Add memories for them to catch
            </h3>
            <p className="text-sm text-muted-foreground">
              Photos fill memories without a photo first, then create new ones.
              Notes can also stand on their own.
            </p>
          </div>
        </div>
        <div className="mt-5 flex min-w-0 max-w-full flex-wrap gap-2">
          <Button
            type="button"
            className="min-w-0 max-w-full whitespace-normal"
            onClick={() => bulk.current?.click()}
            disabled={processing}
          >
            <Images className="mr-2 h-4 w-4" />
            {processing ? "Preparing photos…" : "Add multiple photos"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-w-0 max-w-full whitespace-normal"
            disabled={processing || c.hearts.length >= maxMemories}
            onClick={() => {
              if (!processingRef.current) onUpdate({ hearts: appendHeartMemory(c.hearts, maxMemories) });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add one memory
          </Button>
          {c.hearts.length > 0 && (
            <ClearAllMemoriesButton disabled={processing} onClear={() => { if (!processingRef.current) onUpdate({ hearts: [] }); }} />
          )}
        </div>
        <input
          aria-label="Add multiple memory photos"
          ref={bulk}
          className="hidden"
          type="file"
          multiple
          disabled={processing}
          accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => void addPhotos(e.target.files)}
        />
        <p className="mt-3 text-sm font-medium">{memoryCountLabel}</p>
        {showErrors &&
          (c.hearts.length < 1 ||
            c.hearts.length > maxMemories) && (
            <InlineFieldMessage
              id="heart-count-error"
              message={`Add between 1 and ${maxMemories} heart memories before continuing.`}
            />
          )}
        {status && (
          <InlineFieldMessage
            tone={statusTone}
            message={status}
          />
        )}
      </section>

      {/*
        Single-column, single-open accordion. The previous md:grid-cols-2
        layout put the expanded editor in one narrow column with a collapsed
        row beside it, wasting most of the row's width.
      */}
      <div className="grid min-w-0 max-w-full gap-3">
        {c.hearts.map((h, i) => (
          <section
            className="flex min-w-0 max-w-full flex-col rounded-xl border border-border/70"
            key={h.id}
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-1">
              <button
                type="button"
                id={`heart-memory-header-${h.id}`}
                className="min-h-12 min-w-0 flex-1 text-left text-sm font-semibold text-primary"
                aria-expanded={expanded(h.id)}
                aria-controls={`heart-memory-panel-${h.id}`}
                onClick={() => setActiveMemory(expanded(h.id) ? undefined : h.id)}
              >
                <span className="truncate">Memory {i + 1}</span>
                <span className="ml-1 font-normal text-muted-foreground">
                  · {memoryStatus(h)}
                </span>
              </button>
              <BuilderItemActions
                itemLabel="Memory"
                index={i}
                canMoveEarlier={!processing && i > 0}
                canMoveLater={!processing && i < c.hearts.length - 1}
                canRemove={!processing}
                onMoveEarlier={() => move(i, -1)}
                onMoveLater={() => move(i, 1)}
                onRemove={() => remove(h.id)}
              />
            </div>
            {expanded(h.id) && (
            <div
              id={`heart-memory-panel-${h.id}`}
              role="region"
              aria-labelledby={`heart-memory-header-${h.id}`}
              className="flex min-w-0 max-w-full flex-col gap-3 border-t border-border/70 px-3 pt-4 pb-4"
            >
            {/* Image-first anatomy: the photo leads, the note follows — but
                DOM order stays fixed (photo, then note) and only the visual
                order flips via `order-*`, so adding/removing a photo never
                remounts the Textarea mid-edit. */}
            <div className={`min-w-0 max-w-full ${h.photo ? "order-1" : "order-2"}`}>
              <ImagePicker
                adjustLabel="Adjust photo"
                adjustAriaLabel={`Adjust photo for Memory ${i + 1}`}
                frameAspect="4 / 3"
                label={`Memory ${i + 1} photo (optional)`}
                metaLabel={`Memory ${i + 1} · Photo ready`}
                value={h.photo}
                onChange={(photo) => update(h.id, { photo })}
              />
            </div>
            <div className={`min-w-0 max-w-full ${h.photo ? "order-2" : "order-1"}`}>
              <label
                className="block text-sm font-medium"
                htmlFor={`heart-note-${h.id}`}
              >
                {h.photo ? (
                  <>
                    Note{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </>
                ) : (
                  <>
                    Memory {i + 1} note{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional with a photo)
                    </span>
                  </>
                )}
              </label>
              <Textarea textBudget={TEXT_LIMITS.note}
                id={`heart-note-${h.id}`}
                value={h.message}
                onChange={(e) => update(h.id, { message: e.target.value })}

                placeholder="A little note for this heart…"
                className={h.photo ? "mt-2" : "mt-2 min-h-28 text-base"}
                aria-invalid={showErrors && !h.message.trim() && !h.photo}
                aria-describedby={
                  showErrors && !h.message.trim() && !h.photo
                    ? "heart-note-error-" + h.id
                    : undefined
                }
              />
              {showErrors && !h.message.trim() && !h.photo && (
                <InlineFieldMessage
                  id={"heart-note-error-" + h.id}
                  message={`Add a note or photo for heart ${i + 1} before continuing.`}
                />
              )}

            </div>
            </div>
            )}
          </section>
        ))}
      </div>


      <section className="min-w-0 max-w-full space-y-3">
        <div>
          <label htmlFor="heart-finale" className="font-semibold">
            Final message <span className="text-primary">*</span>
          </label>
        </div>
        <Textarea textBudget={TEXT_LIMITS.final}
          id="heart-finale"
          value={c.finalMessage}
          onChange={(e) => onUpdate({ finalMessage: e.target.value })}

          placeholder="The message after every heart is caught…"
          aria-invalid={showErrors && !c.finalMessage.trim()}
          aria-describedby={
            showErrors && !c.finalMessage.trim()
              ? "heart-finale-error"
              : undefined
          }
        />
        {showErrors && !c.finalMessage.trim() && (
          <InlineFieldMessage
            id="heart-finale-error"
            message="Add the final reveal message before continuing."
          />
        )}

      </section>
    </div>
    </div>
  );
}

function ClearAllMemoriesButton({ onClear, disabled }: { onClear: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" disabled={disabled} onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        Clear all
      </Button>
      <ConfirmationModal
        open={open}
        title="Clear every heart memory?"
        message="This removes all of the heart notes and photos currently in this surprise."
        confirmLabel="Clear memories"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onClear();
        }}
      />
    </>
  );
}
