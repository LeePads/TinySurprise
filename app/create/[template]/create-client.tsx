"use client";
import { requestReviewField } from "@/lib/review-field";
import { consumeBuilderNotice } from "@/lib/library-notice";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Header } from "@/components/header";
import { BuilderStickyNav } from "@/components/builder-sticky-nav";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { Button } from "@/components/ui/button";
import { StepBasics } from "@/components/builder-step-basics";
import { StepCustomizeHeart } from "@/components/builder-step-customize-heart";
import { StepCustomizePuzzle } from "@/components/builder-step-customize-puzzle";
import { StepCustomizeOpenWhen } from "@/components/builder-step-customize-open-when";
import { StepCustomizeDate } from "@/components/builder-step-customize-date";
import { StepCustomizeQuiz } from "@/components/builder-step-customize-quiz";
import { StepCustomizeNewTemplate } from "@/components/builder-step-customize-extended";
import { StepAppearance } from "@/components/builder-step-appearance";
import { StepDelivery } from "@/components/builder-step-delivery";
import { StepPreview } from "@/components/builder-step-preview";
import { RecipientPreview } from "@/components/recipient-preview";
import { FullScreenPreview } from "@/components/full-screen-preview";
import { getExperienceComponent } from "@/lib/render-experience";
import { useBuilderState } from "@/lib/use-builder-state";
import { registerBackHandler } from "@/lib/native/back-handler";
import { requestBuilderExit } from "@/lib/builder-exit";
import { useKeyboard } from "@/lib/native/use-keyboard";
import { useKeyboardSafeScroll } from "@/lib/native/use-keyboard-safe-scroll";
import { isNativePlatform } from "@/lib/platform";
import { useAndroidWideLayout } from "@/lib/use-media-query";
import { TEMPLATES } from "@/lib/config";
import { MOTION, MOTION_EASE } from "@/lib/motion";
import { useExportBudgetEstimate } from "@/lib/use-export-budget-estimate";
import { MediaBudgetMeter } from "@/components/media-budget-meter";
import type {
  CatchTheHeartContent,
  ChooseOurDateContent,
  CozyPlaylistContent,
  MemoryQuizContent,
  OpenWhenContent,
  OurStorybookContent,
  PhotoPuzzleContent,
  TemplateType,
  WishUponAStarContent,
} from "@/lib/types";
import {
  Check,
  CircleAlert,
  HardDrive,
  LoaderCircle,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

const ExportSummary = dynamic(
  () =>
    import("@/components/export-summary").then(
      (module) => module.ExportSummary,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid min-h-72 place-items-center rounded-[1.75rem] border bg-card/80 p-8 text-center shadow-[var(--shadow-soft)]"
        role="status"
      >
        <span>
          <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <strong className="block">Loading review and send options…</strong>
        </span>
      </div>
    ),
  },
);

const steps = [
  ["Who it’s for", "Start with the details that make it personal."],
  ["Your surprise", "Add the words and memories they’ll discover."],
  ["Look & feel", "Keep the current look or choose another."],
  [
    "Finishing touches",
    "Make it yours with an optional welcome, music, or secret question.",
  ],
  ["Preview", "See it the way they will."],
  ["Review & send", "Get it ready to send."],
] as const;
export default function CreateClient() {
  return (
    <Suspense fallback={null}>
      <CreateClientWithSearchParams />
    </Suspense>
  );
}

function CreateClientWithSearchParams() {
  const params = useParams(),
    router = useRouter(),
    id = params.template as string;
  const isAvailable = Boolean(TEMPLATES[id]?.isAvailable);
  const creationId = useSearchParams().get("creation") || undefined;

  useEffect(() => {
    if (!isAvailable) router.replace("/templates");
  }, [isAvailable, router]);

  if (!isAvailable) return null;
  return <BuilderPage id={id as TemplateType} creationId={creationId} />;
}

function BuilderPage({
  id,
  creationId,
}: {
  id: TemplateType;
  creationId?: string;
}) {
  const router = useRouter();
  const [importNotice, setImportNotice] = useState("");
  useEffect(() => { const pending = consumeBuilderNotice(); if (pending) setImportNotice(pending); }, []);
  const [showFreshConfirmation, setShowFreshConfirmation] = useState(false);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const [editActionBusy, setEditActionBusy] = useState(false);
  const editActionBusyRef = useRef(false);
  const runSaveAction = async (action: () => Promise<unknown>) => {
    if (editActionBusyRef.current) return;
    editActionBusyRef.current = true;
    setEditActionBusy(true);
    try { await action(); }
    finally { editActionBusyRef.current = false; setEditActionBusy(false); }
  };
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [focusOpenWhenVideoId, setFocusOpenWhenVideoId] = useState<string>();
  const closeFullPreview = useCallback(() => setFullPreviewOpen(false), []);
  const openFullPreview = useCallback(() => setFullPreviewOpen(true), []);
  const [native, setNative] = useState(false);
  const wide = useAndroidWideLayout();
  const keyboard = useKeyboard();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);
  // Single page-level owner of the keyboard-open scroll-padding + focused-
  // field scroll-into-view side effects — see the hook's own doc comment
  // for why this must not be duplicated per-step.
  useKeyboardSafeScroll(native, keyboard.visible);
  const builder = useBuilderState(id, {
    creationId,
    onCreationId: (newId) => {
      // A fresh "Create a surprise" tap has no ?creation= yet — mint one
      // and reflect it in the URL so autosave always targets a stable
      // record (and reloading/sharing the URL reopens the same one).
      router.replace(`/create/${id}?creation=${newId}`);
    },
  });
  const data = builder.surpriseData;
  const exportBudget = useExportBudgetEstimate(data);

  // Lets the Android hardware back button step back through the builder's
  // wizard steps (which live in component state, not the URL) before
  // NativeAppShell falls through to router/app-level back handling.
  //
  // Depends only on currentStep/handlePrevious (a stable useCallback), NOT
  // on the whole `builder` object: useBuilderState() returns a fresh object
  // literal every render, so depending on `builder` re-registered this
  // handler (pushing it to the top of back-handler.ts's stack) on every
  // unrelated re-render of this page — including autosave ticks and
  // keyboard-visibility changes while a sheet or full-screen preview was
  // open elsewhere, which could incorrectly move Back-press priority above
  // an already-open modal's own handler. See required Back priority order.
  useEffect(() => {
    return registerBackHandler(() => {
      if (builder.currentStep <= 1) {
        requestBuilderExit(() => router.push("/templates"));
        return true;
      }
      builder.handlePrevious();
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally narrower than `builder`; see comment above.
  }, [builder.currentStep, builder.handlePrevious]);
  const experience = useMemo(() => getExperienceComponent(data), [data]);
  if (builder.entryError) {
    return (
      <>
        <Header />
        <main
          className={`builder-shell mx-auto min-h-svh w-full min-w-0 max-w-3xl px-3 py-8 sm:px-4 sm:py-16 ${native ? "builder-shell--native" : "builder-shell--web"}`}
        >
          <section
            className="rounded-2xl border border-destructive/30 bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8"
            role="alert"
          >
            <h1 className="text-xl font-bold">This surprise could not be opened safely</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {builder.entryError}
            </p>
            <Button asChild className="mt-6 min-h-12">
              <Link href="/library">Go to My Surprises</Link>
            </Button>
          </section>
        </main>
      </>
    );
  }
  return (
    <>
      <Header />
      <main
        className={`builder-shell mx-auto min-h-svh w-full min-w-0 max-w-6xl px-3 py-5 sm:px-4 sm:py-10 ${native ? "builder-shell--native" : "builder-shell--web"}`}
      >
        <header className={`builder-page-heading ${native ? "" : "mt-3"}`}>
          <h1 className="builder-page-title">
            Create {builder.template.name}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {builder.template.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p
              className="inline-flex min-h-9 max-w-full items-center gap-2 text-xs font-medium text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {builder.draftStatus === "loading" ? (
                <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : builder.draftStatus === "saving" ? (
                <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : builder.draftStatus === "restored" ? (
                <RotateCcw className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : builder.draftStatus === "saved" ? (
                <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <CircleAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
              )}
              <span className="break-words">
                {builder.draftStatus === "loading"
                  ? "Checking your saved surprise…"
                  : builder.draftStatus === "saving"
                    ? "Saving…"
                  : builder.draftStatus === "restored"
                    ? builder.isEditSession
                      ? "Your edits are kept here. Tap Save edits to update the saved surprise."
                      : "Your surprise is back with its photos and settings"
                    : builder.draftStatus === "saved"
                      ? builder.isEditSession
                        ? "Your edits are kept here. Tap Save edits to update the saved surprise."
                        : `Saved on this device${builder.draftSavedAt ? ` at ${new Date(builder.draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`
                      : "Saving needs attention—keep this page open"}
              </span>
            </p>
            {builder.draftStatus !== "loading" && (
              <details>
              <summary className="flex min-h-12 cursor-pointer items-center text-xs font-semibold text-muted-foreground">More options</summary>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-12 rounded-full px-3 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
                disabled={editActionBusy || builder.draftStatus === "saving"}
                onClick={() => setShowFreshConfirmation(true)}
              >
                <RotateCcw className="mr-1.5 h-4 w-4 text-primary" aria-hidden="true" />
                Start fresh
              </Button>
              {builder.isEditSession && <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-12 rounded-full px-3 text-xs font-bold"
                disabled={editActionBusy || builder.draftStatus === "saving"}
                onClick={() => setShowDiscardConfirmation(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Discard edits
              </Button>}
              </details>
            )}
            {builder.isEditSession && builder.draftStatus !== "loading" && (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="min-h-12 rounded-full px-3 text-xs font-bold"
                  disabled={editActionBusy || builder.draftStatus === "saving"}
                  onClick={() => void runSaveAction(async () => {
                    const saved = await builder.saveEdit();
                    if (saved) router.push("/library");
                  })}
                >
                  <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Save edits
                </Button>
              </div>
            )}
          </div>
          {builder.draftStatus !== "unavailable" && <p className="mt-2 text-xs text-muted-foreground">Find your saved work in My Surprises.</p>}
          {builder.draftError && (
            <p className="mt-2 max-w-2xl text-sm text-destructive" role="alert">
              {builder.draftError}
            </p>
          )}
          {builder.draftStatus === "unavailable" && !builder.saveConflict && !builder.isEditSession && (
            <Button className="mt-3" variant="outline" disabled={editActionBusy} onClick={() => void runSaveAction(builder.flushPendingSave)}>
              {editActionBusy ? "Trying to save…" : "Retry save"}
            </Button>
          )}
          {builder.saveConflict && <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={editActionBusy} onClick={() => window.location.reload()}>Reload saved version</Button>
            <Button disabled={editActionBusy} onClick={() => void runSaveAction(builder.saveAsNewDraft)}>{editActionBusy ? "Saving a copy…" : "Save as new draft"}</Button>
            <p className="w-full text-xs text-muted-foreground">Save as new draft keeps your current work. Reload saved version replaces the changes on this page.</p>
          </div>}
        </header>
        {builder.currentStep !== 6 && exportBudget.contributors.length > 0 && (
          <div className="mt-4">
            <MediaBudgetMeter estimate={exportBudget} />
          </div>
        )}
        <div className="builder-progress my-8 border-y border-border/65 py-2">
          {(!native || wide) && (
            <nav aria-label="Builder progress" className="py-1">
              <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
                {steps.map(([label], index) => (
                  <li key={label} className="flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        index + 1 < builder.currentStep &&
                        builder.setCurrentStep(index + 1)
                      }
                      disabled={index + 1 > builder.currentStep}
                      aria-current={
                        builder.currentStep === index + 1 ? "step" : undefined
                      }
                      aria-label={`Step ${index + 1}: ${label}`}
                      className={`min-h-12 w-full min-w-0 rounded-xl border px-1 text-[.75rem] font-semibold leading-tight transition sm:px-2 sm:text-xs ${builder.currentStep === index + 1 ? "border-primary bg-primary text-primary-foreground shadow-warm" : index + 1 < builder.currentStep ? "border-primary/25 bg-primary/[.07] text-primary" : "border-transparent bg-transparent text-muted-foreground"}`}
                    >
                      <span className="inline-flex h-5 min-w-5 items-center justify-center opacity-90 sm:mr-1">
                        {index + 1 < builder.currentStep ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                      </span>
                       <span className="min-w-0">{label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="py-4 sm:py-5">
            <div>
              <p className="mb-1 text-sm font-semibold text-primary">Step {builder.currentStep} of {steps.length}</p>
              <h2 className="builder-step-title">
                {steps[builder.currentStep - 1][0]}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {steps[builder.currentStep - 1][1]}
              </p>
            </div>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            id="builder-step-fields"
            tabIndex={-1}
            key={builder.currentStep}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{
              duration: reduceMotion ? 0 : MOTION.standard,
              ease: MOTION_EASE,
            }}
            className={`builder-step-content min-h-0 min-w-0 max-w-full px-0 py-3 sm:px-1 sm:py-4 ${native ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}`}
          >
          {builder.currentStep === 1 && (
            <StepBasics data={data.basics} onUpdate={builder.updateBasics} />
          )}{" "}
          {builder.currentStep === 2 && id === "catch-the-heart" && (
            <StepCustomizeHeart
              data={data.content as CatchTheHeartContent}
              onUpdate={builder.updateContent}
            />
          )}{" "}
          {builder.currentStep === 2 && id === "photo-puzzle" && (
            <StepCustomizePuzzle
              data={data.content as PhotoPuzzleContent}
              onUpdate={builder.updateContent}
            />
          )}{" "}
          {builder.currentStep === 2 && id === "open-when" && (
            <StepCustomizeOpenWhen
              data={data.content as OpenWhenContent}
              onUpdate={builder.updateContent}
              focusMediaId={focusOpenWhenVideoId}
            />
          )}{" "}
          {builder.currentStep === 2 && id === "choose-our-date" && (
            <StepCustomizeDate
              data={data.content as ChooseOurDateContent}
              onUpdate={builder.updateContent}
            />
          )}{" "}
          {builder.currentStep === 2 && id === "memory-quiz" && (
            <StepCustomizeQuiz
              data={data.content as MemoryQuizContent}
              onUpdate={builder.updateContent}
            />
          )}{" "}
          {builder.currentStep === 2 && id === "our-storybook" && (
            <StepCustomizeNewTemplate
              kind="storybook"
              data={data.content as OurStorybookContent}
              onUpdate={builder.updateContent}

            />
          )}{" "}
          {builder.currentStep === 2 && id === "wish-upon-a-star" && (
            <StepCustomizeNewTemplate
              kind="stars"
              data={data.content as WishUponAStarContent}
              onUpdate={builder.updateContent}
            />
          )}{" "}
          {builder.currentStep === 2 && id === "cozy-playlist" && (
            <StepCustomizeNewTemplate
              kind="playlist"
              data={data.content as CozyPlaylistContent}
              onUpdate={builder.updateContent}
            />
          )}{" "}
          {builder.currentStep === 3 && (
            <StepAppearance
              data={data.appearance}
              onUpdate={builder.updateAppearance}
              onOpenFullPreview={openFullPreview}
              keyboardVisible={keyboard.visible}
            />
          )}{" "}
          {builder.currentStep === 4 && (
            <StepDelivery
              data={data}
              experience={experience}
              delivery={data.delivery}
              delight={data.delight!}
              music={data.music}
              onDelivery={builder.updateDelivery}
              onDelight={builder.updateDelight}
              onMusic={builder.updateMusic}
              onOpenFullPreview={openFullPreview}
              keyboardVisible={keyboard.visible}
              previewPaused={fullPreviewOpen}
            />
          )}{" "}
          {builder.currentStep === 5 && (
            <StepPreview
              renderPreview={(mode) => (
                <RecipientPreview data={data} presentationMode={mode === "mobile" ? "builder-compact-preview" : "contained"}>{experience}</RecipientPreview>
              )}
              onOpenFullPreview={openFullPreview}
              previewPaused={fullPreviewOpen}
            />
          )}{" "}
          {builder.currentStep === 6 && (
            <ExportSummary
              data={data}
              exportBudget={exportBudget}
              creationId={builder.creationId}
              onBeforeGenerate={builder.flushPendingSave}
              validationPolicy={builder.validationPolicy}
              onStartOver={builder.handleStartOver}
              onPreviewAgain={() => builder.setCurrentStep(5)}
              onEditText={issue => { requestReviewField(issue.inputId); builder.setCurrentStep(issue.step); }}
              onReturnToBuilder={() => builder.setCurrentStep(2)}
              onOptimizeVideo={(mediaId) => {
                setFocusOpenWhenVideoId(mediaId);
                builder.setCurrentStep(2);
              }}
            />
          )}
          </motion.section>
        </AnimatePresence>
        {importNotice && <p role="status" className="my-4 rounded-xl border p-3 text-sm">{importNotice}</p>}
        <BuilderStickyNav
          onBack={builder.handlePrevious}
          backLabel={builder.currentStep === 6 ? "Back to Preview" : "Back"}
          backDisabled={builder.currentStep === 1}
          onContinue={
            builder.currentStep < 6 ? builder.handleNext : undefined
          }
          continueLabel={
            builder.currentStep < 6
              ? `Continue to ${steps[builder.currentStep][0]}`
              : undefined
          }
          compact={native && keyboard.visible}
          music={data.template === "cozy-playlist" ? undefined : data.music}
          onMusic={data.template === "cozy-playlist" ? undefined : builder.updateMusic}
          hasYoutubeSong={Boolean(
            data.music?.youtubeUrl ||
              (data.content as { songUrl?: string }).songUrl,
          )}
        />
      </main>
      <ConfirmationModal
        open={showFreshConfirmation}
        title="Start this template fresh?"
        message="This clears the surprise you&apos;re working on, including its photos and music. Anything you&apos;ve already downloaded stays safe."
        confirmLabel="Start fresh"
        onCancel={() => setShowFreshConfirmation(false)}
        onConfirm={() => {
          setShowFreshConfirmation(false);
          void builder.handleStartFresh();
        }}
      />
      <ConfirmationModal
        open={showDiscardConfirmation}
        title="Discard these edits?"
        message="Your saved surprise will stay unchanged. Changes made since you opened it for editing will be removed."
        confirmLabel="Discard edits"
        onCancel={() => setShowDiscardConfirmation(false)}
        onConfirm={async () => {
          setEditActionBusy(true);
          const discarded = await builder.discardEdit();
          setEditActionBusy(false);
          if (discarded) {
            setShowDiscardConfirmation(false);
            router.push("/library");
          }
        }}
      />
      {/* Mounted on web as well as Android: one full-preview overlay for both,
          instead of the browser Fullscreen API on web and this on native. */}
      <FullScreenPreview
        open={fullPreviewOpen}
        onClose={closeFullPreview}
        data={data}
      >
        {experience}
      </FullScreenPreview>
    </>
  );
}
