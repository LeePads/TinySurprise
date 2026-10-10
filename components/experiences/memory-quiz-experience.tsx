"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PresentationImage } from "@/components/presentation-image";
import { appearanceVisual } from "@/lib/appearance";
import { normalizeRenderableImageUrl } from "@/lib/safe-url";
import type { MemoryQuizContent, SurpriseData } from "@/lib/types";
import { resolveExperienceCompletion } from "@/lib/experience-completion";
import { createExperienceProgress } from "@/lib/experience-progress";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { useRecipientReducedMotion } from "@/lib/recipient-motion";

export function MemoryQuizExperience({ data }: { data: SurpriseData }) {
  const content = data.content as MemoryQuizContent;
  const completion = resolveExperienceCompletion(data);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const reduceMotion = useRecipientReducedMotion(data.appearance.animationIntensity);
  const theme = appearanceVisual(data.appearance);
  const question = content.questions[current];
  const resultRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<
    "initial" | "feedback" | "question" | "replay" | undefined
  >("initial");
  useRecipientOverlay({
    open: done,
    containerRef: resultRef,
    initialRef: resultHeadingRef,
    onClose: () => setDone(false),
  });

  useEffect(() => {
    if (done) return;
    const target = pendingFocusRef.current;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      if (target === "feedback") continueButtonRef.current?.focus();
      else if (target === "initial" || target === "question" || target === "replay")
        questionHeadingRef.current?.focus();
      pendingFocusRef.current = undefined;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [answer, current, done]);

  if (!question)
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        Add quiz questions to begin.
      </div>
    );

  const visibleAnswers = question.answers
    .map((option, originalIndex) => ({ option, originalIndex }))
    .filter(({ option }) => Boolean(option.trim()));
  const photoUrl = normalizeRenderableImageUrl(question.photo?.previewUrl);
  const resultHeading = score / content.questions.length >= 0.8
    ? "You remembered the little things."
    : score / content.questions.length >= 0.45
      ? "So many of these moments stayed with you."
      : "The memories matter more than the score.";

  const choose = (originalIndex: number) => {
    if (answer !== null) return;
    pendingFocusRef.current = "feedback";
    setAnswer(originalIndex);
    if (originalIndex === question.correctIndex)
      setScore((value) => value + 1);
  };
  const next = () => {
    if (current === content.questions.length - 1) setDone(true);
    else {
      pendingFocusRef.current = "question";
      setCurrent((value) => value + 1);
      setAnswer(null);
    }
  };

  return (
    <div
      className="memory-quiz-root relative flex items-start justify-center p-4 py-8"
      style={{
        background: `radial-gradient(circle at 80% 8%,${theme.accent}35,transparent 30%),linear-gradient(145deg,var(--experience-canvas),var(--experience-surface-elevated))`,
      }}
    >
      <div className="w-full max-w-2xl">
        <header className="mb-5 text-center">
          <p
            className="text-sm font-semibold"
            style={{ color: theme.primary }}
          >
            {createExperienceProgress("memory-quiz", current + 1, content.questions.length).label}
          </p>
          <h1 className="recipient-title mt-2 font-semibold">
            How well do you remember us?
          </h1>
          <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              style={{ background: theme.primary, transformOrigin: "left" }}
              initial={false}
              animate={{
                scaleX: (current + (answer !== null ? 1 : 0)) / content.questions.length,
              }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            />
          </div>
        </header>
        <motion.section
          key={question.id}
          initial={reduceMotion ? false : { opacity: 0, y: 15 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          className="p-1 @[640px]/recipient-preview:p-2"
        >
          <h2
            ref={questionHeadingRef}
            tabIndex={-1}
            className="text-balance text-center text-xl font-semibold leading-snug outline-none @[640px]/recipient-preview:text-2xl"
          >
            {question.prompt}
          </h2>
          <div className="quiz-answer-group mt-6 grid gap-3">
            {visibleAnswers.map(({ option, originalIndex }) => {
              const selected = answer === originalIndex;
              const correct =
                answer !== null && originalIndex === question.correctIndex;
              const accessibleState =
                answer === null
                  ? undefined
                  : selected
                    ? correct
                      ? `${option}. Your answer. Correct answer.`
                      : `${option}. Your answer.`
                    : correct
                      ? `${option}. Correct answer.`
                      : undefined;
              return (
                <button
                  type="button"
                  key={originalIndex}
                  disabled={answer !== null}
                  aria-label={accessibleState}
                  onClick={() => choose(originalIndex)}
                  className={`min-h-12 rounded-2xl border px-4 text-left font-medium transition ${
                    correct
                      ? "recipient-surface-elevated border-emerald-500 bg-[var(--experience-surface-elevated)] text-foreground"
                      : selected
                        ? "recipient-surface-elevated border-amber-500 bg-[var(--experience-surface-elevated)] text-foreground"
                        : "recipient-surface border-[var(--experience-border)] bg-[var(--experience-surface)] text-foreground hover:border-primary"
                  }`}
                >
                  {option}
                  {correct && (
                    <span className="float-right font-bold text-emerald-700 dark:text-emerald-300">
                      ✓ Correct
                    </span>
                  )}
                  {selected && !correct && (
                    <span className="float-right font-bold text-amber-700 dark:text-amber-300">
                      Memory revealed
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {answer !== null && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                className="quiz-memory-feedback recipient-surface-elevated mt-6 rounded-2xl border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] p-4 text-center"
              >
                {photoUrl && (
                  <div className="quiz-memory-photo mx-auto mb-5 rounded-xl">
                    <PresentationImage
                      image={question.photo ? { ...question.photo, previewUrl: photoUrl || "" } : { previewUrl: photoUrl || "" }}
                      alt="Shared memory"
                      aspectRatio="4 / 3"
                      frameClassName="w-full rounded-xl"
                    />
                  </div>
                )}
                <p
                  id="memory-quiz-feedback"
                  className="font-semibold"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {answer === question.correctIndex
                    ? "You remembered ✦"
                    : "Not quite—but here’s the memory."}
                </p>
                {question.memoryNote && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {question.memoryNote}
                  </p>
                )}
                <Button
                  type="button"
                  ref={continueButtonRef}
                  className="mt-4 w-full"
                  onClick={next}
                >
                  {current === content.questions.length - 1
                    ? "See our result"
                    : "Next memory"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
      <AnimatePresence>
        {done && (
          <motion.div
            ref={resultRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-quiz-result-title"
            className="recipient-completion-overlay bg-[var(--experience-overlay)]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
          >
            <motion.section
              initial={reduceMotion ? false : { scale: 0.9 }}
              animate={reduceMotion ? undefined : { scale: 1 }}
              className="recipient-surface-elevated memory-quiz-result recipient-completion-panel rounded-[2rem] border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] p-6 text-center shadow-xl @[640px]/recipient-preview:p-8"
            >
              <Sparkles className="mx-auto h-12 w-12 text-amber-400" />
              <p
                className="mt-4 text-xs font-bold uppercase tracking-[.18em]"
                style={{ color: theme.primary }}
              >
                {score} of {content.questions.length} remembered
              </p>
              <h2 ref={resultHeadingRef} tabIndex={-1} id="memory-quiz-result-title" className="mt-3 text-3xl font-semibold">
                {resultHeading}
              </h2>
              <div className="recipient-completion-body"><p className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">
                {completion.finalMessage}
              </p>
              {completion.closingMessage && <p className="mt-3 font-medium">{completion.closingMessage}</p>}
              {completion.signature && <p className="mt-2 text-sm italic text-muted-foreground">{completion.signature}</p>}
              </div><Heart
                className="mx-auto mt-5 h-8 w-8 fill-current"
                style={{ color: theme.primary }}
              />
              <Button
                type="button"
                variant="outline"
                className="mt-5"

                onClick={() => {
                  pendingFocusRef.current = "replay";
                  setCurrent(0);
                  setAnswer(null);
                  setScore(0);
                  setDone(false);
                }}
              >
                Remember them again
              </Button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
