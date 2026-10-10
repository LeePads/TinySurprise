"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CatchTheHeartContent, SurpriseData } from "@/lib/types";
import { resolveExperienceCompletion } from "@/lib/experience-completion";
import { createExperienceProgress } from "@/lib/experience-progress";


import { heartAssetPath } from "@/lib/design-assets";
import { hapticTap } from "@/lib/native/haptics";
import { MOTION, MOTION_EASE } from "@/lib/motion";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { useRecipientMotionMode } from "@/lib/recipient-motion";
import { PresentationImage } from "@/components/presentation-image";
import { CATCH_HEART_VISIBLE_LIMIT } from "@/lib/heart-memories";
import { getCatchHeartSpawn } from "@/lib/catch-heart-spawn";
import { CATCH_FIELD_BACKGROUND } from "@/lib/appearance";
import Image from "next/image";
export function CatchTheHeartExperience({ data }: { data: SurpriseData }) {
  const c = data.content as CatchTheHeartContent;

  const completion = resolveExperienceCompletion(data);
  const motionMode = useRecipientMotionMode(data.appearance.animationIntensity);
  const reduce = motionMode === "reduced";
  const previewOwner = useId();
  const [caught, setCaught] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [memoriesSheetOpen, setMemoriesSheetOpen] = useState(false);
  const completionFocusIntent = useRef<"replay" | null>(null);
  const firstPlayableHeartRef = useRef<HTMLButtonElement>(null);
  const heartDialogRef = useRef<HTMLDivElement>(null);
  const heartCloseRef = useRef<HTMLButtonElement>(null);
  const completionDialogRef = useRef<HTMLDivElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const catchProgressRef = useRef<HTMLSpanElement>(null);
  const memoriesSheetRef = useRef<HTMLDivElement>(null);
  const memoriesCloseRef = useRef<HTMLButtonElement>(null);
  const completionTitleId = `${previewOwner}-completion-title`;
  const completionDescriptionId = `${previewOwner}-completion-description`;
  const complete = caught.length === c.hearts.length && c.hearts.length > 0;
  const completionOpen = complete && active === null && !completionDismissed;
  const closeMemory = () => {
    setActive(null);
    if (complete) setCompletionDismissed(false);
  };

  const dismissCompletion = () => {
    setCompletionDismissed(true);
    setMemoriesSheetOpen(true);
  };
  const replayCatch = () => {
    completionFocusIntent.current = "replay";
    setActive(null);
    setCaught([]);
    setMemoriesSheetOpen(false);
    setCompletionDismissed(false);
    setRound((value) => value + 1);
  };
  const closeMemories = () => {
    setMemoriesSheetOpen(false);
    requestAnimationFrame(() => catchProgressRef.current?.focus({ preventScroll: true }));
  };

  useRecipientOverlay({
    open: active !== null,
    containerRef: heartDialogRef,
    initialRef: heartCloseRef,
    fallbackReturnRef: catchProgressRef,
    onClose: closeMemory,
  });
  useRecipientOverlay({
    open: completionOpen,
    containerRef: completionDialogRef,
    initialRef: completionHeadingRef,
    onClose: dismissCompletion,
  });
  useRecipientOverlay({
    open: memoriesSheetOpen,
    containerRef: memoriesSheetRef,
    initialRef: memoriesCloseRef,
    onClose: closeMemories,
  });
  useEffect(() => {
    document.body.classList.toggle("heart-memory-open", active !== null);
    return () => document.body.classList.remove("heart-memory-open");
  }, [active]);
  useEffect(() => {
    document.body.classList.toggle("heart-completion-open", completionOpen);
    return () => document.body.classList.remove("heart-completion-open");
  }, [completionOpen]);
  const positions = useMemo(
    () => c.hearts.map((_, i) => getCatchHeartSpawn(i, round)),
    [c.hearts, round],
  );

  const remainingIndices = c.hearts
    .map((_, index) => index)
    .filter((index) => !caught.includes(index));
  const visibleIndices =
    remainingIndices.length === 1
      ? remainingIndices
      : remainingIndices.slice(0, CATCH_HEART_VISIBLE_LIMIT);
  const firstPlayableHeartIndex = visibleIndices[0] ?? null;
  const visibleHeartSlots = visibleIndices.map((index, slot) => ({ index, slot }));
  useEffect(() => {
    const intent = completionFocusIntent.current;
    if (intent !== "replay") return;
    const target = firstPlayableHeartRef.current;
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      if (document.contains(target)) target.focus({ preventScroll: true });
      completionFocusIntent.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [completionDismissed, firstPlayableHeartIndex, round]);

  const progress = createExperienceProgress("catch-the-heart", caught.length, c.hearts.length);
  const completionHasDescription = Boolean(
    completion.finalMessage || completion.closingMessage || completion.signature,
  );

  return (
    <div className="heartbeat-glow catch-game-shell relative min-h-[660px] overflow-hidden bg-[var(--experience-canvas)] text-[var(--experience-foreground)]">
      <div className="catch-game-content relative z-10 mx-auto flex min-h-[660px] max-w-5xl flex-col p-5">
        <header className="catch-game-header text-center">
          <h1 className="text-4xl font-semibold">
            For {data.basics.recipientName}
          </h1>
          <p className="mt-3 text-[var(--experience-muted)]">
            {data.basics.openingMessage}
          </p>
          <div className="catch-game-header-actions mt-4 flex justify-center gap-2">
            <span ref={catchProgressRef} className="px-1 py-2 text-sm font-semibold" tabIndex={-1}>
              {progress.label}
            </span>
            <span className="sr-only" aria-live="polite">
              {!complete && `${progress.announce}. ${remainingIndices.length} remaining.`}
            </span>
          </div>
        </header>
        <div
          className="catch-game-field relative mt-5 min-h-[430px] flex-1 overflow-hidden rounded-[2rem] border border-[var(--experience-border)] bg-[var(--experience-surface)]"
          style={{
            background: CATCH_FIELD_BACKGROUND,
          }}
        >
          {/*
            AnimatePresence must keep its default `initial` here. With
            `initial={false}` framer-motion sets PresenceContext.initial=false,
            which blocks the mount animation of every child present on the
            first render and initialises it at the *end* of its `animate`
            target (top: 105%, i.e. below an overflow-hidden field). The
            starting hearts then never fell, never became clickable, and the
            progress chip stayed pinned at "0 memories found" forever.
          */}
          <AnimatePresence>
            {visibleHeartSlots.map(({ index: i, slot }) => {
                const p = positions[i];
                const finalHeart = remainingIndices.length === 1;
                return (
                  <motion.button
                    key={`${round}-slot-${slot}`}
                    ref={i === firstPlayableHeartIndex ? firstPlayableHeartRef : undefined}
                    aria-label={finalHeart ? "Catch the final glowing heart" : `Catch heart ${i + 1}`}
                    className={`absolute z-10 h-16 w-16 ${finalHeart ? "drop-shadow-[0_0_20px_var(--experience-accent)]" : ""}`}
                    style={{
                      left: `clamp(2.75rem, ${p.left}%, calc(100% - 2.75rem))`,
                      marginLeft: "-2rem",
                    }}
                    initial={
                      reduce
                        ? { top: `${p.top}%` }
                        : { top: `${p.initialTop}%` }
                    }
                    animate={
                      reduce
                        ? { top: `${p.top}%` }
                        : {
                            top: "105%",
                            x: [0, 8, -6, 5, 0],
                            rotate: [0, 6, -5, 4, 0],
                          }
                    }
                    exit={{
                      opacity: 0,
                      scale: 0.28,
                      rotate: 16,
                      transition: { duration: reduce ? 0 : 0.18, ease: MOTION_EASE },
                    }}
                    transition={{
                      duration: reduce ? 0 : p.duration + (finalHeart ? 2.5 : 0),
                      delay: p.delay,
                      repeat: reduce ? 0 : Infinity,
                      ease: "linear",
                    }}
                    whileHover={reduce ? undefined : { scale: 1.18, rotate: -8 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => {
                      void hapticTap("medium");
                      setCaught((previous) => [...previous, i]);
                      setActive(i);
                    }}
                  >
                    <Image
                      src={heartAssetPath(c.heartStyle)}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 object-contain drop-shadow-lg"
                    />
                  </motion.button>
                );
            })}
          </AnimatePresence>
          {complete && completionDismissed && (
            <section className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-5 text-center">
              <h2 className="text-xl font-semibold">Every little memory, found.</h2>
              <div className="recipient-actions flex flex-wrap justify-center gap-3">
                <Button onClick={() => setCompletionDismissed(false)}>Read the final note</Button>
                <Button variant="outline" onClick={() => setMemoriesSheetOpen(true)}>Revisit memories</Button>
                <Button variant="outline" onClick={replayCatch}>Play again</Button>
              </div>
            </section>
          )}
        </div>
      </div>
      <AnimatePresence>
        {active !== null && (
          <motion.div
            ref={heartDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Heart memory"
            className="catch-memory-overlay bg-[var(--experience-overlay)] backdrop-blur-sm"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={closeMemory}
          >
            <motion.article
              className="android-recipient-dialog memory-modal catch-memory-dialog relative flex w-full flex-col overflow-hidden rounded-[2rem] bg-card text-card-foreground text-center shadow-2xl"
              initial={
                reduce ? false : { opacity: 0, scale: 0.72, y: 50, rotate: -3 }
              }
              animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
              exit={
                reduce
                  ? undefined
                  : { opacity: 0, scale: 0.86, y: 24, rotate: 2 }
              }
              transition={{ duration: reduce ? 0 : MOTION.reveal, ease: MOTION_EASE }}
              onClick={(event) => event.stopPropagation()}
            >
              <span
                aria-hidden
                className="memory-modal__corner memory-modal__corner--tl"
              >
                ♥
              </span>
              {/*
                Head / scrollable body / foot, matching the exported HTML
                runtime's heart dialog exactly. The body — not the panel — owns
                the scroll, so a tall photo plus a long message can never be
                clipped out of reach, and the decorative corner keeps its own
                space instead of colliding with the close target.
              */}
              <div className="heart-dialog__head relative z-10">
                <p className="heart-dialog__progress min-w-0 flex-1 text-left text-xs font-bold uppercase tracking-[.16em] text-[var(--experience-accent)]">
                  Heart {active + 1} of {c.hearts.length}
                </p>
                <button
                  ref={heartCloseRef}
                  aria-label="Close heart memory"
                  className="heart-dialog__close"
                  onClick={closeMemory}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="heart-dialog__body relative z-10">
                {c.hearts[active].photo && (
                  <motion.div
                      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                      animate={reduce ? undefined : { opacity: 1, scale: 1 }}
                      transition={{ duration: reduce ? 0 : MOTION.standard, delay: reduce ? 0 : 0.12 }}
                      className="heart-dialog-photo-frame"
                    >
                    <PresentationImage
                      image={c.hearts[active].photo}
                      alt="A shared memory"
                      className="heart-dialog-photo"
                      frameClassName="h-full w-full bg-transparent"
                    />
                  </motion.div>
                )}
                <p
                  className={
                    c.hearts[active].photo
                      ? "pb-1 text-base font-medium text-[var(--experience-surface-muted)] [overflow-wrap:anywhere]"
                      : "pb-1 text-2xl font-semibold [overflow-wrap:anywhere]"
                  }
                >
                  {c.hearts[active].message || "Just a heart, caught with love."}
                </p>
              </div>
              <div className="heart-dialog__foot relative z-10">
                <Button
                  className="min-h-12 w-full"
                  onClick={closeMemory}
                >
                  {complete ? "Read the final note" : "Keep catching"}
                </Button>
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {memoriesSheetOpen && (
          <motion.div
            ref={memoriesSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Memory collection"
            className="catch-memory-overlay bg-[var(--experience-overlay)] backdrop-blur-sm"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={closeMemories}
          >
            <motion.div
              className="android-recipient-dialog memory-modal catch-memory-dialog relative flex w-full flex-col overflow-hidden rounded-[2rem] bg-card text-card-foreground shadow-2xl"
              initial={reduce ? false : { opacity: 0, scale: 0.9, y: 30 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: reduce ? 0 : MOTION.reveal, ease: MOTION_EASE }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="heart-dialog__head relative z-10">
                <p className="heart-dialog__progress min-w-0 flex-1 text-left text-xs font-bold uppercase tracking-[.16em] text-[var(--experience-accent)]">
                  Memory collection
                </p>
                <button
                  ref={memoriesCloseRef}
                  aria-label="Close memories"
                  className="heart-dialog__close"
                  onClick={closeMemories}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ul className="heart-dialog__body relative z-10 grid gap-2 overflow-y-auto text-left">
                {c.hearts.map((memory, index) => caught.includes(index) && (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => {
                        setMemoriesSheetOpen(false);
                        requestAnimationFrame(() => {
                          catchProgressRef.current?.focus({ preventScroll: true });
                          setActive(index);
                        });
                      }}
                      className="memory-collection-item flex min-h-12 w-full items-center gap-3 rounded-2xl border border-[var(--experience-border)] bg-[var(--experience-surface)] p-3 text-left text-sm hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]"
                    >
                      {memory.photo && <PresentationImage image={memory.photo} alt="" presentation={{ ...memory.photo.presentation, mode: "fill" }} frameClassName="h-14 w-14 shrink-0 rounded-xl" />}
                      <span className="min-w-0 flex-1"><strong className="block">Memory {index + 1}</strong><span className="mt-1 line-clamp-2 whitespace-pre-wrap text-[var(--experience-surface-muted)]">{memory.message || "A photo to remember"}</span></span>
                      <span aria-hidden="true" className="text-lg">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {completionOpen && (
          <motion.div
            ref={completionDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={completionTitleId}
            aria-describedby={completionHasDescription ? completionDescriptionId : undefined}
            tabIndex={-1}
            className="recipient-completion-overlay bg-[var(--experience-overlay)]"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.98, y: 12 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : MOTION.reveal, ease: MOTION_EASE }}
              className="recipient-completion-panel rounded-[2rem] border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] p-8 text-center text-[var(--experience-surface-elevated-foreground)] shadow-2xl"
            >
              <Sparkles className="mx-auto mb-1 text-[var(--experience-accent)]" aria-hidden="true" />
              <h2 ref={completionHeadingRef} tabIndex={-1} id={completionTitleId} className="mt-4 text-3xl font-semibold">{completion.title}</h2>
              {completionHasDescription && (
                <div className="recipient-completion-body mt-2 text-left leading-7" id={completionDescriptionId}>
                  {completion.finalMessage && <p className="mt-4 text-lg font-medium">{completion.finalMessage}</p>}
                  {completion.closingMessage && <p className="mt-4 font-medium">{completion.closingMessage}</p>}
                  {completion.signature && <p className="mt-3 text-right text-sm italic text-[var(--experience-surface-elevated-muted)]">{completion.signature}</p>}
                </div>
              )}
              <div className="recipient-completion-actions mt-6">
                <Button onClick={dismissCompletion}>Revisit memories</Button>
                <Button variant="outline" onClick={replayCatch}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Play again
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
