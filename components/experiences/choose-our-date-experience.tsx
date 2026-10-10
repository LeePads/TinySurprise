"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarHeart, Check, ListChecks, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PresentationImage } from "@/components/presentation-image";
import { appearanceVisual } from "@/lib/appearance";
import type { ChooseOurDateContent, SurpriseData } from "@/lib/types";
import { normalizeChooseOurDateIds } from "@/lib/choose-our-date";
import { resolveExperienceCompletion } from "@/lib/experience-completion";
import { hapticTap } from "@/lib/native/haptics";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { useRecipientReducedMotion } from "@/lib/recipient-motion";

export function ChooseOurDateExperience({ data }: { data: SurpriseData }) {
  const content = normalizeChooseOurDateIds(data.content) as ChooseOurDateContent;
  const completion = resolveExperienceCompletion(data);
  const [roundIndex, setRoundIndex] = useState(0);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [complete, setComplete] = useState(false);
  const [interactionMode, setInteractionMode] = useState<"play" | "edit-result">("play");
  const [changePickerOpen, setChangePickerOpen] = useState(false);
  const reduceMotion = useRecipientReducedMotion(data.appearance.animationIntensity);
  const theme = appearanceVisual(data.appearance);
  const round = content.rounds?.[roundIndex];
  const selectedId = picks[roundIndex] || "";
  const selectedByRound = content.rounds.map((item, index) =>
    item.options.find((option) => option.id === picks[index]),
  );
  const roundHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const changePickerRef = useRef<HTMLDivElement>(null);
  const changePickerCloseRef = useRef<HTMLButtonElement>(null);
  const shouldFocusHeadingRef = useRef(false);

  useRecipientOverlay({
    open: changePickerOpen,
    containerRef: changePickerRef,
    initialRef: changePickerCloseRef,
    onClose: () => setChangePickerOpen(false),
  });

  useEffect(() => {
    if (!shouldFocusHeadingRef.current || changePickerOpen) return;
    shouldFocusHeadingRef.current = false;
    let frame = 0;
    let attempts = 0;
    const focusHeading = () => {
      const heading = complete ? resultHeadingRef.current : roundHeadingRef.current;
      const isCurrentRound = complete || heading?.dataset.roundIndex === String(roundIndex);
      if (heading && isCurrentRound) {
        heading.focus({ preventScroll: true });
        return;
      }
      if (attempts++ < 30) frame = requestAnimationFrame(focusHeading);
    };
    frame = requestAnimationFrame(focusHeading);
    return () => cancelAnimationFrame(frame);
  }, [changePickerOpen, complete, roundIndex]);

  const restart = () => {
    shouldFocusHeadingRef.current = true;
    setRoundIndex(0);
    setPicks({});
    setComplete(false);
    setInteractionMode("play");
  };
  const next = () => {
    if (!selectedId) return;
    shouldFocusHeadingRef.current = true;
    void hapticTap("selection");
    if (interactionMode === "edit-result") {
      setInteractionMode("play");
      setComplete(true);
    } else if (roundIndex === content.rounds.length - 1) setComplete(true);
    else setRoundIndex((value) => value + 1);
  };
  const back = () => {
    if (roundIndex > 0) {
      shouldFocusHeadingRef.current = true;
      setRoundIndex((value) => value - 1);
    }
  };
  const openChangePicker = () => setChangePickerOpen(true);
  const changeRound = (index: number) => {
    shouldFocusHeadingRef.current = true;
    setRoundIndex(index);
    setComplete(false);
    setInteractionMode("edit-result");
    setChangePickerOpen(false);
  };

  if (!round)
    return <div className="flex min-h-[520px] items-center justify-center p-6 text-center text-[var(--experience-muted)]">This little date is still finding its shape. Please try opening it again.</div>;

  const resultTitle = content.result.title.trim() || "Our little date, chosen together";
  const resultDescription = content.result.description.trim() || "Here is the adventure your choices made.";
  const resultDetails = content.result.details.trim();

  return (
    <div className="choose-date-root relative p-3 text-[var(--experience-foreground)]" style={{ background: `radial-gradient(circle at 15% 10%,${theme.accent}45,transparent 30%),linear-gradient(145deg,var(--experience-canvas),var(--experience-surface-elevated))` }}>
      <div className="relative mx-auto max-w-4xl">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-[clamp(2rem,8cqw,4rem)] font-semibold">Choose our next little adventure</h1>
          <p className="mx-auto mt-4 whitespace-pre-wrap leading-7 text-[var(--experience-muted)]">{content.introMessage || data.basics.openingMessage}</p>
        </header>
        <AnimatePresence mode="wait">
          {!complete ? (
            <motion.section key={round.id} initial={reduceMotion ? false : { opacity: 0, x: 28 }} animate={reduceMotion ? undefined : { opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -28 }} className="mx-auto mt-7 max-w-3xl p-1 @[640px]/recipient-preview:p-2">
              <div className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>{roundIndex > 0 && <Button type="button" variant="ghost" className="-ml-3" onClick={back}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>}</div>
                <p className="text-center text-sm font-semibold text-primary" role="status" aria-live="polite">Round {roundIndex + 1} of {content.rounds.length}</p>
                <span aria-hidden="true" />
              </div>
              <h2 ref={roundHeadingRef} data-round-index={roundIndex} tabIndex={-1} className="mt-4 text-balance text-center text-2xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]/35 @[640px]/recipient-preview:text-3xl">{round.question}</h2>
              <div className="date-options mt-6 grid gap-3">
                {round.options.map((option, index) => {
                  const chosen = selectedId === option.id;
                  return (
                    <button type="button" key={option.id} aria-pressed={chosen} onClick={() => { if (!chosen) void hapticTap("light"); setPicks((current) => ({ ...current, [roundIndex]: option.id })); }} className={`recipient-surface group overflow-hidden rounded-2xl border bg-[var(--experience-surface)] text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]/35 ${chosen ? "ring-2 ring-primary/35 shadow-md" : ""}`} style={{ borderColor: chosen ? theme.primary : undefined }}>
                      {option.photo && <PresentationImage image={option.photo} alt={`${option.title || `Option ${index + 1}`} photo`} aspectRatio="16 / 9" frameClassName="w-full bg-muted" />}
                      <div className="p-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${theme.primary}18`, color: theme.primary }}>{chosen ? <Check /> : <span className="font-bold">{index + 1}</span>}</span>
                        <h3 className="mt-3 text-lg font-semibold">{option.kind === "recipient-decides" ? option.title || "You choose this part" : option.title || `Option ${index + 1}`}</h3>
                        {option.details && <p className="mt-1 text-sm leading-6 text-[var(--experience-muted)]">{option.details}</p>}
                        {option.kind === "recipient-decides" && <p className="mt-2 text-xs font-semibold text-primary">This part stays yours to decide.</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 min-h-5 text-center text-sm text-[var(--experience-muted)]" role="status" aria-live="polite">{selectedId ? "Choice selected" : "Choose one to continue"}</p>
              <div className="date-action-zone mt-6 w-full">
                <Button size="lg" className="min-h-12 w-full" disabled={!selectedId} onClick={next}>{roundIndex === content.rounds.length - 1 ? "Reveal our date" : "Keep choosing"}<Sparkles className="ml-2 h-4 w-4" /></Button>
              </div>
            </motion.section>
          ) : (
            <motion.section key="result" initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 24 }} animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }} className="recipient-surface mx-auto mt-8 max-w-2xl overflow-hidden rounded-[2rem] bg-[var(--experience-surface)] text-center shadow-2xl">
              <div className="p-6 @[640px]/recipient-preview:p-9">
                <CalendarHeart className="mx-auto h-14 w-14" style={{ color: theme.primary }} />
                <p className="mt-4 text-sm font-semibold text-primary">{completion.eyebrow}</p>
                <h2 ref={resultHeadingRef} tabIndex={-1} className="mt-2 text-3xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]/35 @[640px]/recipient-preview:text-4xl">{resultTitle}</h2>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-[var(--experience-muted)]">{resultDescription}</p>
                <div className="mt-6 space-y-2 text-left" role="list" aria-label="Our date plan">
                  {selectedByRound.map((item, index) => item && (
                    <article key={`${item.id}-${index}`} role="listitem" className="recipient-surface-elevated flex min-w-0 items-start gap-3 rounded-2xl bg-[var(--experience-surface-elevated)] p-3 @[640px]/recipient-preview:gap-4 @[640px]/recipient-preview:p-4">
                      {item.photo ? <PresentationImage image={item.photo} alt={`${item.title} selection`} aspectRatio="1 / 1" frameClassName="h-16 w-16 shrink-0 rounded-xl @[640px]/recipient-preview:h-20 @[640px]/recipient-preview:w-20" /> : <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary @[640px]/recipient-preview:h-20 @[640px]/recipient-preview:w-20">{index + 1}</span>}
                      <div className="min-w-0 pt-1"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Choice {index + 1}</span><p className="mt-1 font-semibold">{item.title}</p>{item.details && <p className="mt-1 text-sm leading-5 text-[var(--experience-muted)]">{item.details}</p>}</div>
                    </article>
                  ))}
                </div>
                {resultDetails && <p className="mt-6 rounded-2xl bg-primary/10 p-4 whitespace-pre-wrap">{resultDetails}</p>}
                <div className="my-6 h-px bg-[var(--experience-border)]" aria-hidden="true" />
                <p className="text-xl font-semibold">{completion.finalMessage}</p>
                {completion.closingMessage && <p className="mt-3 font-medium">{completion.closingMessage}</p>}
                {completion.signature && <p className="mt-3 italic text-[var(--experience-muted)]">{completion.signature}</p>}
                <div className="date-result-actions mt-7 flex flex-col justify-center gap-3">
                  <Button className="min-h-12" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" /> Choose again</Button>
                  <Button variant="outline" className="min-h-12" onClick={openChangePicker}><ListChecks className="mr-2 h-4 w-4" /> Change a choice</Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {changePickerOpen && (
            <motion.div ref={changePickerRef} role="dialog" aria-modal="true" aria-labelledby="date-change-title" className="recipient-dialog-overlay fixed inset-0 z-50 flex items-end justify-center bg-[var(--experience-overlay)] p-0 backdrop-blur-sm" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setChangePickerOpen(false); }}>
              <motion.div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[2rem] bg-[var(--experience-surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl @[640px]/recipient-preview:rounded-[2rem] @[640px]/recipient-preview:p-7" initial={reduceMotion ? false : { y: 24, opacity: 0 }} animate={reduceMotion ? undefined : { y: 0, opacity: 1 }} exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}>
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-sm font-semibold text-primary">Choose a round</p><h2 id="date-change-title" className="mt-1 text-2xl font-semibold">Change a choice</h2></div>
                  <Button ref={changePickerCloseRef} type="button" size="icon" variant="ghost" aria-label="Close change-a-choice picker" onClick={() => setChangePickerOpen(false)}><X className="h-5 w-5" /></Button>
                </div>
                <div className="mt-5 grid gap-2">
                  {content.rounds.map((item, index) => {
                    const answer = selectedByRound[index];
                    return <button type="button" key={item.id} onClick={() => changeRound(index)} className="min-h-12 rounded-2xl border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] px-4 py-3 text-left transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]/35"><span className="block font-semibold">{item.question}</span>{answer && <span className="mt-1 block text-sm text-[var(--experience-muted)]">{answer.title}</span>}</button>;
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
