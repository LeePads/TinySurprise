"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Heart, MailOpen } from "lucide-react";
import type { OpenWhenContent, SurpriseData } from "@/lib/types";
import { resolveExperienceCompletion } from "@/lib/experience-completion";
import { Button } from "@/components/ui/button";
import { PresentationImage } from "@/components/presentation-image";
import { SafeVideo } from "@/components/safe-video";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { hapticTap } from "@/lib/native/haptics";
import { normalizeOpenWhenEnvelopeIds } from "@/lib/open-when";
import { useRecipientReducedMotion } from "@/lib/recipient-motion";

type OpenLetter = number | "final" | null;

export function OpenWhenExperience({ data }: { data: SurpriseData }) {
  const content = normalizeOpenWhenEnvelopeIds(
    data.content,
  ) as OpenWhenContent;
  const completion = resolveExperienceCompletion(data);
  const [selected, setSelected] = useState<OpenLetter>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const envelope = typeof selected === "number" ? content.envelopes[selected] : undefined;
  const allLettersOpened =
    content.envelopes.length > 0 &&
    content.envelopes.every((item) => opened.has(item.id));
  const reduceMotion = useRecipientReducedMotion(data.appearance.animationIntensity);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useRecipientOverlay({ open: selected !== null, containerRef: dialogRef, initialRef: closeButton, onClose: () => setSelected(null) });

  const openLetter = (index: number) => {
    const item = content.envelopes[index];
    if (!item) return;
    if (!opened.has(item.id)) void hapticTap("light");
    setOpened((current) => new Set([...current, item.id]));
    setSelected(index);
    requestAnimationFrame(() => {
      const body = dialogRef.current?.querySelector<HTMLElement>(".letter-recipient-body");
      if (body) body.scrollTop = 0;
      if (selected !== null) dialogRef.current?.querySelector<HTMLElement>("#open-letter-title")?.focus({ preventScroll: true });
    });
  };
  const openAnother = () => {
    const current = typeof selected === "number" ? selected : -1;
    const unopened = content.envelopes.findIndex((item, index) => index > current && !opened.has(item.id));
    const next = unopened >= 0 ? unopened : (current + 1) % content.envelopes.length;
    openLetter(next);
  };

  return (
    <div className="open-when-root p-3">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="recipient-title font-bold">Open one whenever you need me</h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-[var(--experience-muted)]">{data.basics.openingMessage}</p>
      </header>
      <div className="open-when-grid mx-auto mt-7 grid max-w-4xl gap-4">
        {content.envelopes.map((item, index) => {
          const wasOpened = opened.has(item.id);
          return (
            <motion.button key={item.id} type="button" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : Math.min(index * 0.05, 0.2) }} whileHover={reduceMotion ? undefined : { y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => openLetter(index)} className="recipient-surface group relative min-h-44 overflow-hidden rounded-[1.6rem] border border-primary/20 bg-[var(--experience-surface)] p-5 text-left shadow-warm transition hover:border-primary/50 hover:shadow-lg" aria-label={`${wasOpened ? "Read again" : "Open"} ${item.title}`}>
              <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-16 origin-top bg-primary/[.09] [clip-path:polygon(0_0,100%_0,50%_100%)] transition-transform duration-300 ${wasOpened ? "[transform:perspective(400px)_rotateX(150deg)]" : "group-hover:scale-y-110"}`} />
              <span className="relative flex min-h-7 items-start justify-end">{wasOpened && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"><Check className="h-3 w-3" /> Opened</span>}</span>
              <strong className="relative mt-5 block text-base leading-snug">{item.title}</strong>
              <span className="relative mt-2 block text-xs font-semibold text-primary">{wasOpened ? "Read again" : "Break the little seal"}</span>
            </motion.button>
          );
        })}
        <motion.button type="button" disabled={!allLettersOpened} aria-disabled={!allLettersOpened} aria-label={allLettersOpened ? "Open the final note" : "Final note locked until all letters are opened"} onClick={() => { if (allLettersOpened) setSelected("final"); }} whileHover={reduceMotion || !allLettersOpened ? undefined : { y: -4 }} className="recipient-surface-elevated relative min-h-44 overflow-hidden rounded-[1.6rem] border border-primary/35 bg-[var(--experience-surface-elevated)] p-5 text-left shadow-warm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60">
          <Heart className="h-6 w-6 text-primary" aria-hidden="true" />
          <strong className="mt-8 block text-lg">One last note</strong>
          <span className="mt-2 block text-xs font-semibold text-primary">{allLettersOpened ? "Always here when you want it" : "Open all letters first"}</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {selected !== null && (
          <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="open-letter-title" className="recipient-dialog-overlay fixed inset-0 z-50 flex items-end justify-center bg-[var(--experience-overlay)] p-0 supports-[backdrop-filter]:backdrop-blur-sm" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
            <motion.article initial={reduceMotion ? false : { opacity: 0, y: 35, rotate: -1 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0, rotate: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: 30 }} transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }} className="recipient-surface android-recipient-dialog letter-recipient-panel flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-[2rem] bg-[var(--experience-surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl @[640px]/recipient-preview:rounded-[2rem] @[640px]/recipient-preview:p-8">
              <Button ref={closeButton} type="button" size="sm" variant="ghost" className="shrink-0 self-start" onClick={() => setSelected(null)}><ArrowLeft className="mr-2 h-4 w-4" /> Back to the letters</Button>
              <div className="letter-recipient-body min-h-0 overflow-y-auto overscroll-contain">
              {envelope ? (
                <>
                  <p className="mt-5 text-sm font-semibold text-primary">Opened with care</p>
                  <h2 id="open-letter-title" tabIndex={-1} className="mt-2 text-3xl font-bold">{envelope.title}</h2>
                  <p className="mt-5 whitespace-pre-wrap text-lg leading-8 text-[var(--experience-surface-foreground)]">{envelope.message}</p>
                  {envelope.photo && <PresentationImage image={envelope.photo} alt={`Memory inside ${envelope.title}`} aspectRatio="4 / 3" frameClassName="letter-recipient-photo mx-auto mt-6 rounded-2xl bg-muted shadow-lg" />}
                  {envelope.video && <SafeVideo className="mt-6 max-h-[55cqh] w-full rounded-2xl bg-[var(--experience-canvas)] shadow-lg" src={envelope.video.previewUrl} />}
                  {content.envelopes.length > 1 && <Button type="button" variant="outline" className="mt-6 min-h-12 w-full" onClick={openAnother}><MailOpen className="mr-2 h-4 w-4" /> Open another letter</Button>}
                </>
              ) : (
                <>
                  <p className="mt-5 text-sm font-semibold text-primary">A note to keep</p>
                  <h2 id="open-letter-title" className="mt-2 text-3xl font-bold">One last note</h2>
                  <p className="mt-5 whitespace-pre-wrap text-lg leading-8">{completion.finalMessage}</p>
                  {completion.closingMessage && <p className="mt-5 font-medium">{completion.closingMessage}</p>}
                  {completion.signature && <p className="mt-3 whitespace-pre-wrap text-sm italic text-[var(--experience-surface-muted)]">{completion.signature}</p>}
                </>
              )}
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
