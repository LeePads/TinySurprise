"use client";
import { TEXT_LIMITS } from "@/lib/text-limits";

import { useEffect, useMemo, useState } from "react";
import { WandSparkles } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { ImagePicker } from "./image-picker";
import { BuilderWorkspace } from "./builder-workspace";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { normalizeImagePresentation } from "@/lib/image-presentation";
import type { Difficulty, LocalImage, PhotoPuzzleContent } from "@/lib/types";

export function StepCustomizePuzzle({
  data,
  onUpdate,
}: {
  data: Partial<PhotoPuzzleContent>;
  onUpdate: (value: Partial<PhotoPuzzleContent>) => void;
}) {
  const content = {
    difficulty: "easy" as Difficulty,
    imageFit: "contain" as const,
    completionMessage: "",
    finalMessage: "",
    ...data,
  };
  // Authored presentation wins; imageFit is only a fallback for older photos.
  const framedPhoto = useMemo(() => data.photo ? {
    ...data.photo,
    presentation: normalizeImagePresentation(data.photo.presentation, data.imageFit),
  } : undefined, [data.photo, data.imageFit]);
  const framingMode = framedPhoto?.presentation.mode ||
    (content.imageFit === "cover" ? "fill" : "fit");
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    const show = () => setShowErrors(true);
    window.addEventListener("tiny-validation-attempted", show);
    return () => window.removeEventListener("tiny-validation-attempted", show);
  }, []);
  const choose = (source?: LocalImage) => {
    if (!source) {
      onUpdate({ photo: undefined });
      return;
    }
    setError("");
    const presentation = normalizeImagePresentation(source.presentation, content.imageFit);
    onUpdate({
      photo: { ...source, presentation },
      imageFit: presentation.mode === "fit" ? "contain" :
        presentation.mode === "fill" ? "cover" : content.imageFit,
    });
  };
  return (
    <BuilderWorkspace className="builder-workspace--customize">
      <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Photo framing</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={framingMode === "fit"}
            onClick={() => {
              onUpdate({
                imageFit: "contain",
                photo: content.photo
                  ? {
                      ...content.photo,
                      presentation: normalizeImagePresentation(undefined, "contain"),
                    }
                  : undefined,
              });
            }}
            className={`rounded-xl border p-3 text-sm ${framingMode === "fit" ? "border-primary bg-primary/10" : "bg-card"}`}
          >
            Fit entire image
            <span className="mt-1 block text-xs text-muted-foreground">
              Keeps every edge visible
            </span>
          </button>
          <button
            type="button"
            aria-pressed={framingMode === "fill"}
            onClick={() => {
              onUpdate({
                imageFit: "cover",
                photo: content.photo
                  ? {
                      ...content.photo,
                      presentation: normalizeImagePresentation(undefined, "cover"),
                    }
                  : undefined,
              });
            }}
            className={`rounded-xl border p-3 text-sm ${framingMode === "fill" ? "border-primary bg-primary/10" : "bg-card"}`}
          >
            Fill square
            <span className="mt-1 block text-xs text-muted-foreground">
              Crops evenly from center
            </span>
          </button>
        </div>
      </fieldset>
      <section className="space-y-3">
        <ImagePicker
          focusId="puzzle-photo"
          label="Puzzle photo"
          adjustLabel="Adjust photo"
          actionLayout="featured"
          frameAspect="1 / 1"
          helperText={framingMode === "custom"
            ? `Your adjusted crop is used for the puzzle (${Math.round((framedPhoto?.presentation.zoom ?? 1) * 100)}% zoom).`
            : framingMode === "fill" ? "The puzzle fills the square with your photo." : "The puzzle keeps your whole photo visible."}
          value={framedPhoto}
          invalid={showErrors && !content.photo}
          errorId="puzzle-photo-error"
          onChange={choose}
        />
      {error && <InlineFieldMessage tone="error" message={error} />}
      {showErrors && !content.photo && (
        <InlineFieldMessage
          id="puzzle-photo-error"
          message="Choose a photo for the puzzle before continuing."
        />
      )}
      </section>
      <fieldset>
        <legend className="mb-2 font-medium">Puzzle difficulty</legend>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
          {(["easy", "medium", "hard"] as Difficulty[]).map((difficulty) => (
            <button
              type="button"
              key={difficulty}
              aria-pressed={content.difficulty === difficulty}
              onClick={() => onUpdate({ difficulty })}
              className={`min-h-16 rounded-xl border bg-card p-3 capitalize ${content.difficulty === difficulty ? "border-primary bg-primary/10 ring-2 ring-primary/15" : ""}`}
            >
              {difficulty}
              <span className="mt-1 block text-xs normal-case text-muted-foreground">
                {difficulty === "easy"
                  ? "3 × 3 · Relaxed"
                  : difficulty === "medium"
                    ? "4 × 4 · Playful"
                    : "5 × 5 · Challenge"}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <WandSparkles className="h-4 w-4 text-primary" />
          They receive two Help Me boosts that bring the image close to
          completion.
        </p>
      </fieldset>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="puzzle-complete">
          Puzzle completion message <span className="text-primary">*</span>
        </label>
        <Textarea textBudget={TEXT_LIMITS.final}
          id="puzzle-complete"
          value={content.completionMessage}
          onChange={(event) =>
            onUpdate({ completionMessage: event.target.value })
          }
          placeholder="What should they see when the last piece clicks in?"
          aria-invalid={showErrors && !content.completionMessage.trim()}
          aria-describedby={
            showErrors && !content.completionMessage.trim()
              ? "puzzle-complete-error"
              : undefined
          }
        />
        {showErrors && !content.completionMessage.trim() && (
          <InlineFieldMessage
            id="puzzle-complete-error"
            message="Add the puzzle completion message before continuing."
          />
        )}
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="puzzle-final">
          Final reveal message <span className="text-primary">*</span>
        </label>
        <Textarea textBudget={TEXT_LIMITS.final}
          id="puzzle-final"
          value={content.finalMessage}
          onChange={(event) => onUpdate({ finalMessage: event.target.value })}
          placeholder="The memory or message behind this photo"
          aria-invalid={showErrors && !content.finalMessage.trim()}
          aria-describedby={
            showErrors && !content.finalMessage.trim()
              ? "puzzle-final-error"
              : undefined
          }
        />
        {showErrors && !content.finalMessage.trim() && (
          <InlineFieldMessage
            id="puzzle-final-error"
            message="Add the final reveal message before continuing."
          />
        )}
      </div>
      </div>
    </BuilderWorkspace>
  );
}
