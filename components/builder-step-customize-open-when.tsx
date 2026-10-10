"use client";
import { useReviewField } from "@/lib/review-field";
import { TEXT_LIMITS } from "@/lib/text-limits";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Images, MailPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ImagePicker } from "./image-picker";
import { VideoPicker } from "./video-picker";
import { InlineFieldMessage } from "./ui/inline-field-message";
import {
  createLocalImageWithMetadata,
  createStableId,
  revokeLocalImage,
} from "@/lib/local-media";
import { validateImageSignature } from "@/lib/validation";
import type {
  EnvelopeItem,
  LocalImage,
  OpenWhenContent,
} from "@/lib/types";
import { normalizeOpenWhenEnvelopeIds } from "@/lib/open-when";
import { getTemplateExperienceDefinition } from "@/lib/template-experience-definitions";
import { BuilderItemActions } from "./builder-item-actions";
import { useValidationAttempted } from "@/lib/use-validation-attempted";
import { BuilderWorkspace } from "./builder-workspace";

const openWhenDefinition = getTemplateExperienceDefinition("open-when");
const MIN_LETTERS = openWhenDefinition.limits.recommendedMin ?? 2;
const MAX_LETTERS = openWhenDefinition.limits.compatibilityMax ?? 6;

const isBlankEnvelope = (envelope: EnvelopeItem) =>
  !envelope.title.trim() &&
  !envelope.message.trim() &&
  !envelope.photo &&
  !envelope.video;
export function StepCustomizeOpenWhen({
  data,
  onUpdate,
  focusMediaId,
}: {
  data: Partial<OpenWhenContent>;
  onUpdate: (v: Partial<OpenWhenContent>) => void;
  focusMediaId?: string;
}) {
  const c = normalizeOpenWhenEnvelopeIds({
    envelopes: [],
    finalMessage: "",
    ...data,
  }) as OpenWhenContent,
    ref = useRef<HTMLInputElement>(null),
    [status, setStatus] = useState(""),
    [activeEnvelope, setActiveEnvelope] = useState<string | null>();
  const latestContent = useRef(c);
  const mounted = useRef(true);
  const batchActive = useRef(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  useLayoutEffect(() => { latestContent.current = c; }, [c]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const commit = (value: Partial<OpenWhenContent>) => {
    onUpdate(value);
    latestContent.current = { ...latestContent.current, ...value };
  };
  const showErrors = useValidationAttempted();
  const expandedEnvelope = activeEnvelope === undefined ? c.envelopes[0]?.id : activeEnvelope;
  useReviewField(id => { const item = c.envelopes.find(item => id === `envelope-title-${item.id}` || id === `envelope-message-${item.id}`); if (item) setActiveEnvelope(item.id); });
  useEffect(() => {
    if (!focusMediaId) return;
    const envelope = c.envelopes.find((item) => item.video?.id === focusMediaId);
    if (envelope) setActiveEnvelope(envelope.id);
  }, [c.envelopes, focusMediaId]);
  useEffect(() => {
    const revealFirstInvalid = () => {
      const firstInvalid = c.envelopes.find(
        (envelope) => !envelope.title.trim() || !envelope.message.trim(),
      );
      if (firstInvalid) setActiveEnvelope(firstInvalid.id);
    };
    window.addEventListener("tiny-validation-attempted", revealFirstInvalid);
    return () =>
      window.removeEventListener(
        "tiny-validation-attempted",
        revealFirstInvalid,
      );
  }, [c.envelopes]);
  const update = (id: string, v: Partial<EnvelopeItem>) =>
    commit({
      envelopes: latestContent.current.envelopes.map((x) => (x.id === id ? { ...x, ...v } : x)),
    });
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= latestContent.current.envelopes.length) return;
    const envelopes = [...latestContent.current.envelopes];
    [envelopes[index], envelopes[target]] = [envelopes[target], envelopes[index]];
    commit({ envelopes });
  };
  const bulk = async (files: FileList | null) => {
    if (!files || batchActive.current) return;
    const selectedFiles = Array.from(files);
    const blankIds = latestContent.current.envelopes.filter(isBlankEnvelope).map(envelope => envelope.id);
    batchActive.current = true;
    setBulkBusy(true);
    setStatus("Adding photos…");
    let added = 0;
    let skipped = 0;
    try {
      for (const file of selectedFiles) {
        if (!mounted.current) break;
        let photo: LocalImage | undefined;
        try {
          if (!(await validateImageSignature(file)).valid) { skipped++; continue; }
          if (!mounted.current) break;
          const hasSpace = () => latestContent.current.envelopes.length < MAX_LETTERS || latestContent.current.envelopes.some(envelope => blankIds.includes(envelope.id) && isBlankEnvelope(envelope));
          if (!hasSpace()) { skipped++; continue; }
          photo = await createLocalImageWithMetadata(file);
          if (!mounted.current) { revokeLocalImage(photo); break; }
          // Resolve by stable ID against current edits, never the array captured
          // before decoding. Deleted or edited blank slots are not overwritten.
          const next = [...latestContent.current.envelopes];
          const slot = next.findIndex(envelope => blankIds.includes(envelope.id) && isBlankEnvelope(envelope));
          let id: string;
          if (slot >= 0) {
            id = next[slot].id;
            next[slot] = { ...next[slot], photo };
          } else if (next.length < MAX_LETTERS) {
            id = createStableId("envelope");
            next.push({ id, title: "", message: "", photo });
          } else {
            revokeLocalImage(photo);
            skipped++;
            continue;
          }
          commit({ envelopes: next });
          photo = undefined; // Ownership has passed to the draft.
          added++;
          if (added === 1) setActiveEnvelope(id);
        } catch {
          revokeLocalImage(photo);
          skipped++;
        }
      }
    } finally {
      batchActive.current = false;
      if (mounted.current) {
        setBulkBusy(false);
        setStatus(`Added ${added} ${added === 1 ? "photo" : "photos"}.${skipped ? ` ${skipped} could not be added.` : ""}`);
        if (ref.current) ref.current.value = "";
      }
    }
  };
  return (
    <BuilderWorkspace className="builder-workspace--customize">
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card/70 p-4">
        <div className="flex gap-3">
          <MailPlus className="mt-0.5 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="font-semibold">Letters</h3>
            <p className="text-sm text-muted-foreground">
              {c.envelopes.length} of {MAX_LETTERS} letters
              {c.envelopes.length < MAX_LETTERS
                ? ` · ${MAX_LETTERS - c.envelopes.length} ${MAX_LETTERS - c.envelopes.length === 1 ? "space" : "spaces"} left`
                : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => ref.current?.click()}
          disabled={bulkBusy}
        >
          <Images className="mr-2" />
          Create letters from photos
        </Button>
        <input
          aria-label="Create letters from multiple photos"
          ref={ref}
          type="file"
          multiple
          disabled={bulkBusy}
          className="hidden"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => void bulk(e.target.files)}
        />
        {status && <p role="status" className="mt-2 text-sm text-muted-foreground">{status}</p>}
        {showErrors && (c.envelopes.length < MIN_LETTERS || c.envelopes.length > MAX_LETTERS) && (
          <InlineFieldMessage
            id="open-when-count-error"
            message={`Keep between ${MIN_LETTERS} and ${MAX_LETTERS} letters before continuing.`}
          />
        )}
      </section>
      <div className="space-y-2" aria-label="Letters">
      {c.envelopes.map((x, i) => {
        const expanded = expandedEnvelope === x.id;
        const complete = Boolean(x.title.trim() && x.message.trim());
        const media = x.photo && x.video ? "Photo + video" : x.photo ? "Photo" : x.video ? "Video" : "No media";
        return <section key={x.id} className={`overflow-hidden rounded-2xl border ${expanded ? "border-primary/45 bg-card" : "border-border/70 bg-card/60"}`}>
          <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
            <button
              type="button"
              className="min-h-12 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-expanded={expanded}
              onClick={() => {
                setActiveEnvelope(expanded ? null : x.id);
              }}
            >
              <span className="block truncate font-semibold">Letter {i + 1} · {x.title.trim() || "Needs a title"}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className={complete ? "text-primary" : ""}>{complete ? "Ready" : "Needs words"}</span>
                <span aria-hidden="true">·</span>
                <span>{media}</span>
              </span>
            </button>
            <BuilderItemActions
              itemLabel="Letter"
              index={i}
              canMoveEarlier={i > 0}
              canMoveLater={i < c.envelopes.length - 1}
              canRemove={c.envelopes.length > MIN_LETTERS}
              onMoveEarlier={() => move(i, -1)}
              onMoveLater={() => move(i, 1)}
              onRemove={() => {
                commit({ envelopes: latestContent.current.envelopes.filter((item) => item.id !== x.id) });
                if (expanded) setActiveEnvelope(null);
              }}
            />
          </div>
          {expanded && <div className="space-y-3 border-t border-border/70 px-3 pb-4 pt-4 sm:px-4">
          <label
            htmlFor={`envelope-title-${x.id}`}
            className="block text-sm font-medium"
          >
            Letter title <span className="text-primary">*</span>
          </label>
          <Input textBudget={TEXT_LIMITS.title}
            id={`envelope-title-${x.id}`}
            value={x.title}
            onChange={(e) => update(x.id, { title: e.target.value })}
            placeholder="Open when…"
            aria-invalid={showErrors && !x.title.trim()}
            aria-describedby={
              showErrors && !x.title.trim()
                ? "envelope-title-error-" + x.id
                : undefined
            }
          />
          {showErrors && !x.title.trim() && (
            <InlineFieldMessage
              id={"envelope-title-error-" + x.id}
              message={`Add a title for letter ${i + 1} before continuing.`}
            />
          )}
          <label
            htmlFor={`envelope-message-${x.id}`}
            className="block text-sm font-medium"
          >
            Letter message <span className="text-primary">*</span>
          </label>
          <Textarea textBudget={TEXT_LIMITS.body}
            id={`envelope-message-${x.id}`}
            value={x.message}
            onChange={(e) => update(x.id, { message: e.target.value })}
            placeholder="The words they need in that moment"
            aria-invalid={showErrors && !x.message.trim()}
            aria-describedby={
              showErrors && !x.message.trim()
                ? "envelope-message-error-" + x.id
                : undefined
            }
          />
          {showErrors && !x.message.trim() && (
            <InlineFieldMessage
              id={"envelope-message-error-" + x.id}
              message={`Add the message for letter ${i + 1} before continuing.`}
            />
          )}
          <div className="space-y-3 border-t border-border/60 pt-3">
            <div>
              <p className="text-sm font-semibold">Media <span className="font-normal text-muted-foreground">(optional)</span></p>
              {x.photo && x.video && <p className="mt-1 text-xs text-muted-foreground">This older letter has both attachments. Both remain available.</p>}
            </div>
            {x.photo && x.video && <div className="space-y-3"><ImagePicker adjustLabel="Adjust letter photo" frameAspect="4 / 3" label="Letter photo" value={x.photo} onChange={(photo) => update(x.id, { photo })} /><VideoPicker label="Letter video" value={x.video} onChange={(video) => update(x.id, { video })} /></div>}
            {x.photo && !x.video && <ImagePicker adjustLabel="Adjust letter photo" frameAspect="4 / 3" label="Letter photo" value={x.photo} onChange={(photo) => update(x.id, { photo })} />}
            {x.video && !x.photo && <VideoPicker label="Letter video" value={x.video} onChange={(video) => update(x.id, { video })} />}
            {!x.photo && !x.video && <div className="grid gap-2 sm:grid-cols-2"><ImagePicker label="Photo" addLabel="Add photo" hideLabel compactEmpty value={undefined} onChange={(photo) => update(x.id, { photo, ...(photo ? { video: undefined } : {}) })} /><VideoPicker label="Video" addLabel="Add video" hideLabel compactEmpty showUrlOption={false} value={undefined} onChange={(video) => update(x.id, { video, ...(video ? { photo: undefined } : {}) })} /></div>}
            {!x.photo && !x.video && <p className="text-xs text-muted-foreground">Add one photo or video for this letter.</p>}
          </div>
          </div>}
        </section>;
      })}
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={c.envelopes.length >= MAX_LETTERS}
        onClick={() => {
          if (latestContent.current.envelopes.length >= MAX_LETTERS) return;
          const envelope = { id: createStableId("envelope"), title: "", message: "" } satisfies EnvelopeItem;
          commit({ envelopes: [...latestContent.current.envelopes, envelope] });
          setActiveEnvelope(envelope.id);
        }}
      >
        Add letter
      </Button>
      <div>
        <label htmlFor="envelope-final" className="mb-2 block text-sm font-medium">
          Final reveal message <span className="text-primary">*</span>
        </label>
        <Textarea textBudget={TEXT_LIMITS.final}
          id="envelope-final"
          value={c.finalMessage}
          onChange={(e) => commit({ finalMessage: e.target.value })}
          placeholder="A last note they can open whenever they want"
          aria-invalid={showErrors && !c.finalMessage.trim()}
          aria-describedby={
            showErrors && !c.finalMessage.trim()
              ? "envelope-final-error"
              : undefined
          }
        />
        {showErrors && !c.finalMessage.trim() && (
          <InlineFieldMessage
            id="envelope-final-error"
            message="Add the final message before continuing."
          />
        )}
      </div>
    </div>
    </BuilderWorkspace>
  );
}
