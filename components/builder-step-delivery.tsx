"use client";
import { useReviewField } from "@/lib/review-field";
import { TEXT_LIMITS } from "@/lib/text-limits";


import { useEffect, useId, useRef, useState } from "react";
import {
  BookOpen,
  Camera,
  Clapperboard,
  FileAudio2,
  Gift,
  Heart,
  KeyRound,
  ListChecks,
  Mail,
  Music2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "./image-picker";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { RecipientPreview } from "./recipient-preview";
import { BuilderPreviewShell } from "./builder-preview-shell";
import { OPENING_STYLES } from "@/lib/config";
import { isNativePlatform } from "@/lib/platform";
import { useBuilderPreviewMode } from "@/lib/use-builder-preview-mode";
import type {
  OpeningStyle,
  SurpriseData,
  SurpriseDelight,
  SurpriseDelivery,
  SurpriseMusic,
} from "@/lib/types";
import {
  AUDIO_ACCEPT,
  audioValidationMessage,
  prepareLocalAudio,
  AUDIO_COMPATIBILITY_NOTE,
} from "@/lib/music";
import { parseYouTubeUrl } from "@/lib/youtube";
import { bindExclusiveAudioPreview } from "@/lib/audio-preview";
import { revokeObjectUrl } from "@/lib/local-media";
import { DeliveryPreviewControls } from "./delivery-preview-controls";

/** Templates whose recipient runtime needs its own tap/drag gestures — the compact preview locks vertical swipes to page scroll (touch-action: pan-y), so these get a shortcut into full-screen where a swipe is safe to mean "gameplay" again. */
const GESTURE_HEAVY_TEMPLATES = new Set(["catch-the-heart"]);

const visuals: Record<OpeningStyle, { icon: typeof Gift; color: string }> = {
  "gentle-fade": {
    icon: Sparkles,
    color: "bg-primary/10 text-primary",
  },
  "gift-unwrap": {
    icon: Gift,
    color: "bg-primary/10 text-primary",
  },
  "envelope-reveal": {
    icon: Mail,
    color: "bg-primary/10 text-primary",
  },
  "sparkle-pop": {
    icon: Sparkles,
    color: "bg-primary/10 text-primary",
  },
  "cinematic-curtain": {
    icon: Clapperboard,
    color: "bg-primary/10 text-primary",
  },
  "polaroid-drop": {
    icon: Camera,
    color: "bg-primary/10 text-primary",
  },
  "heart-bloom": {
    icon: Heart,
    color: "bg-primary/10 text-primary",
  },
  "storybook-turn": {
    icon: BookOpen,
    color: "bg-primary/10 text-primary",
  },
};

type Props = {
  data: SurpriseData;
  experience: React.ReactNode;
  delivery: SurpriseDelivery;
  delight: SurpriseDelight;
  music?: SurpriseMusic;
  onDelivery: (value: Partial<SurpriseDelivery>) => void;
  onDelight: (value: Partial<SurpriseDelight>) => void;
  onMusic: (value: Partial<SurpriseMusic>) => void;
  onOpenFullPreview?: () => void;
  /** Lifted from the builder page's single useKeyboard() call. */
  keyboardVisible?: boolean;
  /** True while the creator's full-screen preview is open over this step — the compact embedded preview underneath is fully hidden then, so its own animation loop/audio is paused instead of running unseen. */
  previewPaused?: boolean;
};

export function StepDelivery({
  data,
  experience,
  delight,
  music,
  onDelight,
  onMusic,
  onOpenFullPreview,
  keyboardVisible,
  previewPaused,
}: Props) {
  const [liveMode, setLiveMode] = useState<"mobile" | "desktop">("mobile");
  const [livePreviewKey, setLivePreviewKey] = useState(0);
  const [previewOpening, setPreviewOpening] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [showOpeningChoices, setShowOpeningChoices] = useState(false);
  const [showYoutube, setShowYoutube] = useState(Boolean(music?.youtubeUrl));
  useEffect(() => { if (music?.youtubeUrl) setShowYoutube(true); }, [music?.youtubeUrl]);
  const [audioError, setAudioError] = useState("");
  const delightRef = useRef(delight);
  useEffect(() => {
    delightRef.current = delight;
  }, [delight]);
  const audioInput = useRef<HTMLInputElement>(null);
  const audioChoice = useRef(0);
  const [audioPreparing, setAudioPreparing] = useState(false);
  useEffect(() => () => { audioChoice.current++; }, []);
  const previewAudio = useRef<HTMLAudioElement>(null);
  const previewAudioOwner = useId();
  const musicRef = useRef(music);
  useEffect(() => {
    musicRef.current = music;
  }, [music]);
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);
  useEffect(() => {
    const audio = previewAudio.current;
    if (!audio) return;
    return bindExclusiveAudioPreview(audio, `delivery-audio-${previewAudioOwner}`);
  }, [music?.file?.id, previewAudioOwner]);
  const previewMode = useBuilderPreviewMode();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLElement>(null);
  const [wideWorkspace, setWideWorkspace] = useState(false);
  const [previewFitsHeight, setPreviewFitsHeight] = useState(false);
  useEffect(() => {
    const workspace = workspaceRef.current;
    const panel = previewPanelRef.current;
    if (!workspace || !panel) return;
    let frame = 0;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      // Match the CSS container breakpoint: 24rem editor + 40rem preview,
      // a 2rem gap, and breathing room. The browser width alone is not enough.
      setWideWorkspace(workspace.clientWidth >= 68 * rem);
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      // Reserve the top offset and bottom action bar, including its safe area.
      const navigation = document.querySelector<HTMLElement>(".builder-sticky-nav");
      const bottomReserve = Math.max(6 * rem, (navigation?.offsetHeight ?? 0) + rem);
      setPreviewFitsHeight(panel.getBoundingClientRect().height + 5 * rem + bottomReserve <= viewportHeight);
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(workspace);
    observer.observe(panel);
    const navigation = document.querySelector<HTMLElement>(".builder-sticky-nav");
    if (navigation) observer.observe(navigation);
    window.addEventListener("resize", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
    };
  }, []);
  const mode = native && previewMode === "short-landscape"
    ? "short-landscape"
    : wideWorkspace && !keyboardVisible ? "wide" : "compact";
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const collapsed = mode === "compact" && (manualCollapsed || Boolean(keyboardVisible));
  const offeredOpeningValues = new Set<OpeningStyle>([
    "gentle-fade",
    "gift-unwrap",
    "envelope-reveal",
    "sparkle-pop",
    "storybook-turn",
  ]);
  const offeredOpeningStyles = OPENING_STYLES.filter((style) =>
    offeredOpeningValues.has(style.value),
  );
  const selectedOpening = OPENING_STYLES.find(
    (style) => style.value === delight.openingStyle,
  );
  const visibleOpeningStyles =
    selectedOpening && !offeredOpeningValues.has(selectedOpening.value)
      ? [selectedOpening, ...offeredOpeningStyles]
      : offeredOpeningStyles;
  useEffect(() => {
    const show = () => {
      setShowErrors(true);
      // Everything validateDelight() can reject (the secret question, its
      // answer choices, the answer) lives inside "Optional extras". If that
      // disclosure is collapsed the invalid control is not in the DOM at all,
      // so focusFirstInvalidField() has nothing to find. Open it first.
      if (delightRef.current?.passphraseEnabled) setShowOptional(true);
    };
    window.addEventListener("tiny-validation-attempted", show);
    return () => window.removeEventListener("tiny-validation-attempted", show);
  }, []);
  useReviewField(id => {
    if (id.startsWith("secret-")) setShowOptional(true);
    if (id === "shared-youtube-url") setShowYoutube(true);
  });
  const answer = delight.passphraseAnswers?.[0] || delight.passphrase || "";
  const questionMode = delight.passphraseMode || "text";
  const storedChoices = delight.passphraseChoices || [];
  const choices = Array.from(
    { length: Math.max(3, storedChoices.length) },
    (_, index) =>
      storedChoices[index] || (index === 0 && !storedChoices.length ? answer : ""),
  );
  const inferredCorrectChoice = choices.findIndex(
    (choice) =>
      Boolean(answer.trim()) &&
      choice.trim().toLocaleLowerCase() === answer.trim().toLocaleLowerCase(),
  );
  const correctChoiceIndex = Math.min(
    choices.length - 1,
    Math.max(
      0,
      delight.passphraseCorrectChoiceIndex ?? inferredCorrectChoice,
    ),
  );
  const trimmedChoices = choices.map((choice) => choice.trim());
  const filledChoices = trimmedChoices.filter(Boolean);
  const duplicateChoices =
    new Set(filledChoices.map((choice) => choice.toLocaleLowerCase())).size !==
    filledChoices.length;
  const missingCorrectChoice = !trimmedChoices[correctChoiceIndex];
  const choiceErrorIds = [
    showErrors && filledChoices.length < 2
      ? "secret-choices-count-error"
      : undefined,
    showErrors && duplicateChoices
      ? "secret-choices-duplicate-error"
      : undefined,
    showErrors && missingCorrectChoice
      ? "secret-choices-correct-error"
      : undefined,
  ].filter(Boolean).join(" ") || undefined;
  const updateChoice = (index: number, value: string) => {
    const next = choices.map((choice, choiceIndex) =>
      choiceIndex === index ? value : choice,
    );
    const wasCorrect = index === correctChoiceIndex;
    onDelight({
      passphraseChoices: next,
      ...(wasCorrect
        ? { passphrase: value, passphraseAnswers: [value] }
        : {}),
    });
  };
  const selectOpening = (openingStyle: OpeningStyle) => {
    onDelight({ openingStyle });
    setPreviewOpening(true);
    setLivePreviewKey((value) => value + 1);
  };
  const restartPreview = () => {
    setPreviewOpening(false);
    setLivePreviewKey((value) => value + 1);
  };
  const chooseMusic = async (file?: File) => {
    if (!file) return;
    const choice = ++audioChoice.current;
    const message = audioValidationMessage(file);
    if (message) {
      setAudioError(message);
      setAudioPreparing(false);
      if (audioInput.current) audioInput.current.value = "";
      return;
    }
    const previous = musicRef.current;
    setAudioPreparing(true); setAudioError("");
    try {
      const uploaded = await prepareLocalAudio(file, "surprise-music");
      if (choice !== audioChoice.current) { revokeObjectUrl(uploaded.previewUrl); return; }
      if (musicRef.current !== previous) { revokeObjectUrl(uploaded.previewUrl); setAudioError("Music settings changed while reading this file. Choose it again; your existing song is kept."); return; }
      onMusic({ file: uploaded, youtubeUrl: "" });
      if (previous?.file?.previewUrl.startsWith("blob:")) revokeObjectUrl(previous.file.previewUrl);
    } catch (reason) { if (choice === audioChoice.current) setAudioError(reason instanceof Error ? reason.message : "This music could not be read. Your existing song is kept."); }
    finally { if (choice === audioChoice.current) { setAudioPreparing(false); if (audioInput.current) audioInput.current.value = ""; } }
  };
  const renderFormSections = () => (
    <>
      <section className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Gift className="h-5 w-5 text-primary" />
            Welcome them
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a short note or photo before the surprise begins.
          </p>
        </div>
        <Toggle
          checked={delight.coverEnabled}
          onChange={(coverEnabled) => onDelight({ coverEnabled })}
          title="Show a welcome screen"
          text="A warm first moment before the surprise opens."
        />
        {delight.coverEnabled && (
          <div className="space-y-4 border-t border-border/70 pt-4">
            <label
              className="block text-sm font-medium"
              htmlFor="cover-message"
            >
              Welcome note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave this blank to use your opening message.
            </p>
            <Textarea textBudget={TEXT_LIMITS.welcome}
              id="cover-message"

              placeholder="I made a little something for you…"
              value={delight.coverMessage}
              onChange={(event) =>
                onDelight({ coverMessage: event.target.value })
              }
            />

            <ImagePicker
              focusId="cover-photo"
              label="Welcome photo (optional)"
              adjustLabel="Adjust photo"
              adjustAriaLabel="Adjust welcome photo"
              actionLayout="featured"
              frameAspect="16 / 9"
              value={delight.coverPhoto}
              onChange={(coverPhoto) => onDelight({ coverPhoto })}
            />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            Opening: {selectedOpening?.label || "Your saved opening"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your opening is ready to use. Change it if you like.
          </p>
        </div>
        <Button variant="outline" aria-expanded={showOpeningChoices} aria-controls="opening-choices" onClick={() => setShowOpeningChoices(value => !value)}>{showOpeningChoices ? "Hide openings" : "Change opening"}</Button>
        {showOpeningChoices && <div id="opening-choices" className="grid gap-3 min-[360px]:grid-cols-2 sm:grid-cols-2">
            {visibleOpeningStyles.map((style) => {
              const Icon = visuals[style.value].icon;
              return (
                <button
                  type="button"
                  key={style.value}
                  aria-pressed={delight.openingStyle === style.value}
                  onClick={() => selectOpening(style.value)}
                  className={`min-h-32 rounded-2xl border p-4 text-left ${delight.openingStyle === style.value ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-card"}`}
                >
                  <span
                    className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${visuals[style.value].color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <strong className="block">{style.label}</strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {style.description}
                  </span>
                </button>
              );
            })}
        </div>}
        {selectedOpening && !offeredOpeningValues.has(selectedOpening.value) && (
          <p className="text-xs text-muted-foreground">
            Your saved opening is still selected. Change it only if you want to.
          </p>
        )}
      </section>

      {data.template !== "cozy-playlist" && musicSection}

      <button
        type="button"
        className="min-h-12 px-1 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        aria-expanded={showOptional}
        onClick={() => setShowOptional((value) => !value)}
      >
        {showOptional ? "Hide optional extras" : "Optional extras"}
      </button>
      {showOptional && (
      <div className="space-y-5">
      <section className="space-y-4 border-t border-border/70 pt-5">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-5 w-5 text-primary" />
            Optional secret
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
             A playful question before it opens. This doesn’t protect private information.
          </p>
        </div>
        <Toggle
          checked={delight.passphraseEnabled}
          onChange={(passphraseEnabled) => onDelight({ passphraseEnabled })}
           title="Ask a question before it opens"
           text="Answers can use different capitalization or spacing."
        />
        {delight.passphraseEnabled && (
          <div className="space-y-4">
            <label className="text-sm font-medium" htmlFor="secret-question">
              Question <span className="text-primary">*</span>
              <Input textBudget={TEXT_LIMITS.question}
                id="secret-question"
                required
                aria-invalid={showErrors && !delight.passphraseQuestion?.trim()}
                aria-describedby={showErrors && !delight.passphraseQuestion?.trim() ? "secret-question-error" : undefined}
                className="mt-2"
                value={delight.passphraseQuestion || ""}
                onChange={(event) =>
                  onDelight({ passphraseQuestion: event.target.value })
                }
                placeholder="Where did we first meet?"
              />
              {showErrors && !delight.passphraseQuestion?.trim() && (
                <InlineFieldMessage id="secret-question-error" message="Add the question your recipient will see." />
              )}
            </label>
            <div>
              <p className="text-sm font-medium">How they answer</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={questionMode === "choice" ? "default" : "outline"}
                  onClick={() =>
                    onDelight({
                      passphraseMode: "choice",
                      passphraseChoices: choices,
                      passphraseCorrectChoiceIndex: correctChoiceIndex,
                      passphrase: choices[correctChoiceIndex] || "",
                      passphraseAnswers: [
                        choices[correctChoiceIndex] || "",
                      ],
                    })
                  }
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  Pick a playful choice
                </Button>
                <Button
                  type="button"
                  variant={questionMode === "text" ? "default" : "outline"}
                  onClick={() => onDelight({ passphraseMode: "text" })}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Type the shared answer
                </Button>
              </div>
            </div>
            {questionMode === "choice" ? (
              <fieldset className="space-y-2" aria-describedby={choiceErrorIds}>
                <legend className="text-sm font-medium">
                  Choices <span className="text-primary">*</span>
                </legend>
                <p className="text-xs text-muted-foreground">
                  Mark the correct memory. They get one quick, friendly guess
                  at a time.
                </p>
                {choices.map((choice, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-xl border bg-secondary/20 p-3"
                  >
                    <label className="grid cursor-pointer place-items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <input
                        type="radio"
                        name="correct-secret-choice"
                        checked={correctChoiceIndex === index}
                        onChange={() =>
                          onDelight({
                            passphraseCorrectChoiceIndex: index,
                            passphrase: choice,
                            passphraseAnswers: [choice],
                          })
                        }
                      />
                      Correct
                    </label>
                    <div className="min-w-0"><Input textBudget={TEXT_LIMITS.answer} id={`secret-choice-${index}`}
                      aria-label={`Secret choice ${index + 1}`}
                      aria-invalid={
                        showErrors &&
                        (!choice.trim() ||
                          duplicateChoices ||
                          (correctChoiceIndex === index && missingCorrectChoice))
                      }
                      aria-describedby={choiceErrorIds}
                      value={choice}
                      onChange={(event) =>
                        updateChoice(index, event.target.value)
                      }
                      placeholder={
                        index === 0
                          ? "The tiny coffee shop"
                          : index === 1
                            ? "The rainy bus stop"
                            : "The bookstore window"
                      }
                    /></div>
                  </div>
                ))}
                {showErrors &&
                  filledChoices.length < 2 && (
                    <InlineFieldMessage id="secret-choices-count-error" message="Add at least two answer choices." />
                  )}
                {showErrors && duplicateChoices && (
                  <InlineFieldMessage id="secret-choices-duplicate-error" message="Make each answer choice different." />
                )}
                {showErrors && missingCorrectChoice && (
                  <InlineFieldMessage id="secret-choices-correct-error" message="Choose a filled-in answer as the correct one." />
                )}
              </fieldset>
            ) : (
              <label className="block text-sm font-medium" htmlFor="secret-answer">
                Accepted answer <span className="text-primary">*</span>
                <Input textBudget={TEXT_LIMITS.answer}
                  id="secret-answer"
                  required
                aria-invalid={showErrors && !answer.trim()}
                aria-describedby={showErrors && !answer.trim() ? "secret-answer-error" : undefined}
                  className="mt-2"
                  value={answer}
                  onChange={(event) =>
                    onDelight({
                      passphrase: event.target.value,
                      passphraseAnswers: [event.target.value],
                    })
                  }
                  placeholder="The little coffee shop"
                />
                {showErrors && !answer.trim() && (
                  <InlineFieldMessage id="secret-answer-error" message="Add the answer they’ll need to open the surprise." />
                )}
              </label>
            )}
          </div>
        )}
      </section>

      </div>
      )}
    </>
  );

  const musicSection = (
      <section id="delivery-music" tabIndex={-1} className="space-y-4 border-t border-border/70 pt-5">
          <div className="flex gap-3">
            <Music2 className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Music <span className="font-normal text-muted-foreground">(optional)</span></h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your surprise works without music. Add a song if you like.
              </p>
            </div>
          </div>
          {music?.file ? (
            <div className="border-y border-border/60 py-3">
              <div className="flex items-center gap-2">
                <FileAudio2 className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">
                  {music.file.name}<span className="block text-xs font-normal text-muted-foreground">{(music.file.size / 1024 / 1024).toFixed(1)} MB · Included in the surprise</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (music.file?.previewUrl.startsWith("blob:"))
                      revokeObjectUrl(music.file.previewUrl);
                    onMusic({ file: undefined, youtubeUrl: "" });
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove
                </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => audioInput.current?.click()}>
                    Replace
                  </Button>
              </div>
              {music.file.unavailable ? (
                <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-foreground" role="alert">
                  Music unavailable — choose it again.
                </p>
              ) : (
                <audio
                  key={music.file.id}
                  ref={previewAudio}
                  className="mt-3 w-full"
                  controls
                  preload="metadata"
                  src={music.file.previewUrl}
                  onError={() => setAudioError("This browser cannot play the saved song. Replace it with an MP3 or M4A copy; your existing file is kept until the replacement is ready.")}
                />
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-14 w-full border-dashed"
              onClick={() => audioInput.current?.click()}
            >
              <FileAudio2 className="mr-2 h-5 w-5" />
              Upload a music file
            </Button>
          )}
          <input
            ref={audioInput}
            type="file"
            className="hidden"
            aria-label="Upload background music"
            accept={AUDIO_ACCEPT}
            onChange={(event) => chooseMusic(event.target.files?.[0])}
          />
          {audioError && <InlineFieldMessage message={audioError} />}
          {audioPreparing && <p role="status" className="text-sm text-muted-foreground">Reading audio… Your existing song is kept until the new file is ready.</p>}
          <p className="text-xs text-muted-foreground">{AUDIO_COMPATIBILITY_NOTE}</p>
          <Button variant="ghost" aria-expanded={showYoutube} aria-controls="youtube-music-options" onClick={() => setShowYoutube(value => !value)}>{showYoutube ? "Hide YouTube link" : "Use a YouTube link"}</Button>
          {showYoutube && <div id="youtube-music-options" className="space-y-2 border-t border-border/60 pt-3">
            <label className="block text-sm font-medium" htmlFor="shared-youtube-url">
              Or open a song on YouTube <span className="font-normal text-muted-foreground">(needs internet)</span>
            </label>
            <Input
              id="shared-youtube-url"
              inputMode="url"
              placeholder="https://youtu.be/..."
              value={music?.youtubeUrl || ""}
              onChange={(event) => {
                const value = event.target.value;
                const replacesUpload = Boolean(parseYouTubeUrl(value));
                if (replacesUpload && music?.file?.previewUrl.startsWith("blob:"))
                  revokeObjectUrl(music.file.previewUrl);
                onMusic({ youtubeUrl: value, ...(replacesUpload ? { file: undefined } : {}) });
              }}
            />
            <p className="text-xs text-muted-foreground">YouTube opens separately and needs internet. Upload audio you have permission to share for music inside the surprise, including offline.</p>
            {music?.file && <p className="text-xs text-muted-foreground">Adding a valid YouTube link replaces the uploaded song. An incomplete link keeps your file.</p>}
            {music?.youtubeUrl && (
              <InlineFieldMessage
                tone={parseYouTubeUrl(music.youtubeUrl) ? "success" : "error"}
                message={parseYouTubeUrl(music.youtubeUrl) ? "YouTube link ready." : "Use a valid YouTube link."}
              />
            )}
          </div>}
          {music?.file && (
            <details className="space-y-3 border-t border-border/60 pt-3">
            <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">Music settings</summary>
            <label className="grid gap-2 text-sm font-medium">Starting volume {music.volume}%<input type="range" min="0" max="100" value={music.volume} onChange={event => onMusic({ volume: Number(event.target.value) })} className="min-h-12 w-full accent-primary" /></label>
            <label className="flex min-h-12 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={music.startMuted} onChange={event => onMusic({ startMuted: event.target.checked })} />Start muted</label>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={music.loop}
                onChange={(event) => onMusic({ loop: event.target.checked })}
              />
              Loop the song while the surprise is open
            </label>
            </details>
          )}
      </section>
  );

  const livePreview = (
    <div className="min-w-0 space-y-3">
      <DeliveryPreviewControls
        native={native}
        liveMode={liveMode}
        onLiveMode={setLiveMode}
        onRestart={restartPreview}
        restartLabel="Restart preview"
      />
      <div className={`preview-device preview-device--compact preview-device-${native ? "available" : liveMode}`}>
        <div key={livePreviewKey} className="preview-device__screen" style={{ touchAction: "pan-y" }}>
          {previewPaused ? (
            // Full-screen preview is open and fully covers this — skip
            // mounting the animated runtime/audio here entirely rather than
            // running it unseen underneath.
            <div className="h-full bg-secondary/20" aria-hidden="true" />
          ) : (
            <RecipientPreview
              data={data}
              initialPhase={previewOpening ? "opening" : undefined}
              presentationMode="builder-compact-preview"
            >
              {experience}
            </RecipientPreview>
          )}
        </div>
      </div>
        {!previewPaused && onOpenFullPreview && GESTURE_HEAVY_TEMPLATES.has(data.template) && (
          <p className="text-xs text-muted-foreground">
            Use the full preview to catch hearts.
          </p>
        )}
    </div>
  );

  const previewBlock = (
    <BuilderPreviewShell
      mode={mode}
      label="Opening preview"
      collapsed={collapsed}
      onToggleCollapse={() => setManualCollapsed((value) => !value)}
      onOpenFullPreview={onOpenFullPreview}
    >
      {livePreview}
    </BuilderPreviewShell>
  );

  return (
    <div ref={workspaceRef} className="builder-workspace builder-workspace--delivery">
      <div className="delivery-workspace">
        <aside
          ref={previewPanelRef}
          className="delivery-workspace__preview min-w-0 rounded-[1.5rem] border bg-card p-3 sm:p-4"
          aria-label="Opening preview"
          data-preview-sticky={previewFitsHeight && !keyboardVisible}
        >
          <div className="mb-3">
            <h3 className="font-semibold">Opening preview</h3>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Try the welcome and opening before the surprise begins.
            </p>
          </div>
          {previewBlock}
        </aside>
        <div className="builder-workspace__editor delivery-workspace__editor space-y-7">
          {renderFormSections()}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  text,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  text: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-2xl border bg-card p-4">
      <input
        className="mt-1 h-5 w-5"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="text-xs text-muted-foreground">{text}</span>
      </span>
    </label>
  );
}
