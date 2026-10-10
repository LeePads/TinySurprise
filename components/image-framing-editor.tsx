"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  X,
} from "lucide-react";
import { normalizeImagePresentation, updateImagePresentation } from "@/lib/image-presentation";
import type { ImagePresentation, LocalImage } from "@/lib/types";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { Button } from "./ui/button";
import { SafeImage } from "./safe-image";

interface ImageFramingEditorProps {
  open: boolean;
  image?: LocalImage;
  label?: string;
  aspectRatio?: number | string;
  onCancel: () => void;
  onDone: (presentation: ImagePresentation) => void;
}

const FOCAL_NUDGE_STEP = 0.05;
type PointerPosition = Pick<PointerEvent, "clientX" | "clientY">;
const distance = (a: PointerPosition, b: PointerPosition) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export function ImageFramingEditor({
  open,
  image,
  label = "Photo",
  aspectRatio = "4 / 3",
  onCancel,
  onDone,
}: ImageFramingEditorProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const gestureRef = useRef({
    mode: "idle" as "idle" | "drag" | "pinch",
    startX: 0,
    startY: 0,
    startFocalX: 0.5,
    startFocalY: 0.5,
    pinchDistance: 0,
    pinchZoom: 1,
    current: normalizeImagePresentation(image?.presentation),
    frame: 0,
  });
  const [draft, setDraft] = useState(() => normalizeImagePresentation(image?.presentation));

  useEffect(() => {
    if (open) setDraft(normalizeImagePresentation(image?.presentation));
  }, [open, image]);

  useEffect(() => () => {
    if (gestureRef.current.frame) cancelAnimationFrame(gestureRef.current.frame);
    pointersRef.current.clear();
  }, []);

  useFocusTrap(open, panelRef, closeRef, onCancel);
  useModalBackHandler(open, onCancel);

  if (!open || !image) return null;

  const changeMode = (mode: ImagePresentation["mode"]) => {
    setDraft(updateImagePresentation(draft, mode));
  };

  const reset = () =>
    setDraft({ mode: "custom", focalX: 0.5, focalY: 0.5, zoom: 1 });

  const nudgeFocal = (axis: "x" | "y", direction: -1 | 1) => {
    setDraft((current) => ({
      ...current,
      mode: "custom",
      focalX:
        axis === "x"
          ? Math.min(1, Math.max(0, (current.focalX ?? 0.5) + direction * FOCAL_NUDGE_STEP))
          : current.focalX ?? 0.5,
      focalY:
        axis === "y"
          ? Math.min(1, Math.max(0, (current.focalY ?? 0.5) + direction * FOCAL_NUDGE_STEP))
          : current.focalY ?? 0.5,
    }));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (pointersRef.current.size === 1) {
      const current = normalizeImagePresentation(draft);
      gestureRef.current = {
        ...gestureRef.current,
        mode: "drag",
        startX: event.clientX,
        startY: event.clientY,
        startFocalX: current.focalX,
        startFocalY: current.focalY,
        pinchDistance: 0,
        pinchZoom: current.zoom,
        current,
      };
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      gestureRef.current.mode = "pinch";
      gestureRef.current.pinchDistance = distance(first, second);
      gestureRef.current.pinchZoom = gestureRef.current.current.zoom;
    }
  };

  const renderTemporaryPresentation = (next: ImagePresentation) => {
    const current = normalizeImagePresentation({ ...next, mode: "custom" });
    gestureRef.current.current = current;
    if (gestureRef.current.frame) return;
    gestureRef.current.frame = requestAnimationFrame(() => {
      gestureRef.current.frame = 0;
      const rendered = gestureRef.current.current;
      const image = frameRef.current?.querySelector("img");
      if (!image) return;
      image.style.objectFit = "cover";
      image.style.objectPosition = `${rendered.focalX * 100}% ${rendered.focalY * 100}%`;
      image.style.transform = `scale(${rendered.zoom})`;
      image.style.transformOrigin = `${rendered.focalX * 100}% ${rendered.focalY * 100}%`;
    });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    const frame = frameRef.current;
    if (!frame) return;
    if (pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      const start = gestureRef.current.pinchDistance;
      if (start > 0) {
        renderTemporaryPresentation({
          ...gestureRef.current.current,
          mode: "custom",
          zoom: Math.min(3, Math.max(1, gestureRef.current.pinchZoom * (distance(first, second) / start))),
        });
      }
      return;
    }
    const dx = (event.clientX - gestureRef.current.startX) /
      Math.max(frame.clientWidth, 1) /
      Math.max(gestureRef.current.current.zoom, 1);
    const dy = (event.clientY - gestureRef.current.startY) /
      Math.max(frame.clientHeight, 1) /
      Math.max(gestureRef.current.current.zoom, 1);
    renderTemporaryPresentation({
      ...gestureRef.current.current,
      mode: "custom",
      focalX: Math.min(1, Math.max(0, gestureRef.current.startFocalX - dx)),
      focalY: Math.min(1, Math.max(0, gestureRef.current.startFocalY - dy)),
    });
  };

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) {
      const committed = normalizeImagePresentation(gestureRef.current.current);
      setDraft(committed);
      gestureRef.current.mode = "idle";
      gestureRef.current.current = committed;
      gestureRef.current.pinchDistance = 0;
    } else if (pointersRef.current.size === 1) {
      const [remaining] = [...pointersRef.current.values()];
      const current = gestureRef.current.current;
      gestureRef.current.mode = "drag";
      gestureRef.current.startX = remaining.clientX;
      gestureRef.current.startY = remaining.clientY;
      gestureRef.current.startFocalX = current.focalX;
      gestureRef.current.startFocalY = current.focalY;
    }
  };

  const presentationStyle = {
    objectFit: draft.mode === "fit" ? ("contain" as const) : ("cover" as const),
    objectPosition: `${(draft.focalX ?? 0.5) * 100}% ${(draft.focalY ?? 0.5) * 100}%`,
    transform: draft.mode === "custom" ? `scale(${draft.zoom ?? 1})` : "scale(1)",
    transformOrigin: `${(draft.focalX ?? 0.5) * 100}% ${(draft.focalY ?? 0.5) * 100}%`,
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      /*
        The editor is a DOM descendant of LocalImagePicker, whose root div
        carries onDragOver/onDrop for desktop file drops. Swallow both here so
        a gesture that ends over the backdrop can never be read as "the
        creator dropped a new file on the picker".
      */
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-framing-title"
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-border bg-background shadow-2xl sm:max-w-2xl sm:rounded-[1.75rem]"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Image framing</p>
            <h2 id="image-framing-title" className="truncate text-lg font-semibold text-foreground">Adjust {label.toLowerCase()}</h2>
          </div>
          <Button ref={closeRef} type="button" variant="ghost" size="icon" className="min-h-12 min-w-12" aria-label="Close without saving" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-w-0 shrink-0 space-y-5 px-4 py-5 sm:px-6">
          <div
            ref={frameRef}
            className="relative isolate mx-auto aspect-[4/3] w-full max-w-xl touch-none select-none overflow-hidden rounded-2xl bg-muted ring-1 ring-border"
            style={{ aspectRatio }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            onDragStart={(event) => event.preventDefault()}
          >
            <SafeImage
              src={image.previewUrl}
              alt={`Preview of ${label.toLowerCase()}`}
              required
              className="absolute inset-0 block h-full w-full"
              style={presentationStyle}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">Drag the image to choose what stays in the frame. Pinch or use the zoom control.</p>

          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Image framing mode">
            {(["fit", "fill", "custom"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={draft.mode === mode}
                className="min-h-12 rounded-xl border border-border px-3 py-2 text-sm font-medium capitalize transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10"
                onClick={() => changeMode(mode)}
              >
                {mode === "custom" ? "Adjust" : mode}
              </button>
            ))}
          </div>

          {draft.mode === "custom" && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="image-zoom" className="text-sm font-medium">Zoom</label>
                <span className="text-sm tabular-nums text-muted-foreground">{Math.round((draft.zoom ?? 1) * 100)}%</span>
              </div>
              <input
                id="image-zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={draft.zoom ?? 1}
                aria-valuetext={`${Math.round((draft.zoom ?? 1) * 100)} percent`}
                onChange={(event) => setDraft((current) => ({ ...current, mode: "custom", zoom: Number(event.target.value) }))}
                className="min-h-12 w-full accent-primary"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">Position the image</p>
                <p className="text-xs text-muted-foreground">
                  Use the buttons or drag the image to choose what stays in the frame.
                </p>
                <div
                  className="mx-auto grid w-fit grid-cols-3 gap-2"
                  role="group"
                  aria-label="Keyboard image positioning"
                >
                  <span aria-hidden="true" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="min-h-12 min-w-12"
                    aria-label="Move image up"
                    onClick={() => nudgeFocal("y", -1)}
                  >
                    <ChevronUp className="h-5 w-5" aria-hidden="true" />
                  </Button>
                  <span aria-hidden="true" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="min-h-12 min-w-12"
                    aria-label="Move image left"
                    onClick={() => nudgeFocal("x", -1)}
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="min-h-12 min-w-12"
                    aria-label="Move image down"
                    onClick={() => nudgeFocal("y", 1)}
                  >
                    <ChevronDown className="h-5 w-5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="min-h-12 min-w-12"
                    aria-label="Move image right"
                    onClick={() => nudgeFocal("x", 1)}
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="mr-2 h-4 w-4" />Reset framing
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={() => onDone(draft)}>
            <Check className="mr-2 h-4 w-4" />Done
          </Button>
        </div>
      </div>
    </div>
  );
}
