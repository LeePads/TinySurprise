"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { PuzzleTile } from "./puzzle-tile";
import { hapticTap } from "@/lib/native/haptics";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { usePreviewSuspended } from "@/lib/preview-activity";
import type { PuzzleState } from "@/lib/puzzle-utils";
import type { Difficulty, ImagePresentation } from "@/lib/types";
import {
  generateSolvableShuffle,
  moveTile,
  getGridPosition,
  isSolved,
  getValidMoves,
} from "@/lib/puzzle-utils";
import { puzzleBackdropStyle } from "@/lib/puzzle-image";

const PUZZLE_INSTRUCTION = "Slide a neighboring piece into the open space.";

interface PuzzleBoardProps {
  imageUrl?: string;
  presentation?: ImagePresentation;
  difficulty: Difficulty;
  onComplete: () => void;
  onRevealAlternative: () => void;
  animationIntensity: string;
  focusOnMount?: boolean;
}

export function PuzzleBoard({
  imageUrl,
  presentation,
  difficulty,
  onComplete,
  onRevealAlternative,
  animationIntensity,
  focusOnMount = false,
}: PuzzleBoardProps) {
  const [puzzleState, setPuzzleState] = useState<PuzzleState | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showRevealConfirm, setShowRevealConfirm] = useState(false);
  const suspended = usePreviewSuspended();
  useEffect(() => { if (suspended) { setShowHelp(false); setShowRevealConfirm(false); } }, [suspended]);
  const [helpsLeft, setHelpsLeft] = useState(2);
  const [statusMessage, setStatusMessage] = useState(PUZZLE_INSTRUCTION);
  const completionFiredRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const boardIntroRef = useRef<HTMLParagraphElement>(null);
  const focusOnMountRef = useRef(focusOnMount);
  const helpDialogRef = useRef<HTMLElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
  const statusResetRef = useRef<number | undefined>(undefined);

  useRecipientOverlay({ open: showHelp && !showRevealConfirm, containerRef: helpDialogRef, initialRef: helpCloseRef, onClose: () => setShowHelp(false) });

  const announceTransient = (message: string) => {
    if (statusResetRef.current) window.clearTimeout(statusResetRef.current);
    setStatusMessage(message);
    statusResetRef.current = window.setTimeout(() => {
      setStatusMessage(PUZZLE_INSTRUCTION);
      statusResetRef.current = undefined;
    }, 2800);
  };

  const reset = () => {
    completionFiredRef.current = false;
    setPuzzleState(generateSolvableShuffle(difficulty));
    setIsCompleted(false);
    setHelpsLeft(2);
    setShowHelp(false);
    setShowRevealConfirm(false);
    if (statusResetRef.current) window.clearTimeout(statusResetRef.current);
    statusResetRef.current = undefined;
    setStatusMessage(PUZZLE_INSTRUCTION);
  };

  useEffect(reset, [difficulty]);
  useEffect(() => {
    return () => {
      if (statusResetRef.current) window.clearTimeout(statusResetRef.current);
    };
  }, []);
  useEffect(() => {
    if (!focusOnMountRef.current || !puzzleState) return;
    focusOnMountRef.current = false;
    const frame = window.requestAnimationFrame(() => boardIntroRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [puzzleState]);
  useEffect(() => {
    if (!puzzleState || !isSolved(puzzleState) || completionFiredRef.current) return;
    completionFiredRef.current = true;
    setIsCompleted(true);
    setStatusMessage("Puzzle complete.");
    void hapticTap("medium");
    const timeout = window.setTimeout(onComplete, 280);
    return () => window.clearTimeout(timeout);
  }, [puzzleState, onComplete]);

  const move = (positionIndex: number) => {
    if (!puzzleState || isCompleted || !getValidMoves(puzzleState).includes(positionIndex)) return;
    const next = moveTile(puzzleState, positionIndex);
    if (next) {
      void hapticTap("light");
      setPuzzleState(next);
      setStatusMessage(
        `Moved puzzle piece ${puzzleState.tiles[positionIndex]}. Choose a neighboring piece to continue.`,
      );
    }
  };

  const swipe = (dx: number, dy: number) => {
    if (!puzzleState || Math.max(Math.abs(dx), Math.abs(dy)) < 32) return;
    const empty = puzzleState.tiles.indexOf(0);
    const size = puzzleState.gridSize;
    const candidate =
      Math.abs(dx) > Math.abs(dy)
        ? empty + (dx > 0 ? -1 : 1)
        : empty + (dy > 0 ? -size : size);
    move(candidate);
  };

  const help = () => {
    if (!puzzleState || helpsLeft <= 0) return;
    const next = generateSolvableShuffle(
      difficulty,
      Math.max(2, puzzleState.gridSize - 1),
    );
    if (isSolved(next)) return;
    setPuzzleState(next);
    setHelpsLeft((value) => value - 1);
    announceTransient("A few pieces moved closer.");
    setShowHelp(false);
  };

  if (!puzzleState) {
    return (
      <div className="flex min-h-64 items-center justify-center text-[var(--experience-muted)]">
        Preparing the puzzle…
      </div>
    );
  }

  const gridSize = puzzleState.gridSize;
  const validMoves = getValidMoves(puzzleState);

  return (
    <div className="no-select w-full space-y-4 @[640px]/recipient-preview:space-y-6">
      <p
        ref={boardIntroRef}
        id="photo-puzzle-instructions"
        tabIndex={-1}
        className="text-center text-sm text-[var(--experience-muted)] outline-none"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage}
      </p>
      <div className="rounded-2xl bg-[var(--experience-surface-elevated)] p-1.5 @[640px]/recipient-preview:p-2">
        <div
          className="relative w-full touch-none overflow-hidden rounded-xl bg-[var(--experience-surface)] shadow-warm"
          style={{ aspectRatio: "1 / 1" }}
          onPointerDown={(event) => {
            pointerStart.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = pointerStart.current;
            pointerStart.current = undefined;
            if (start) swipe(event.clientX - start.x, event.clientY - start.y);
          }}
          onPointerCancel={() => {
            pointerStart.current = undefined;
          }}
        >
          {imageUrl && (
            <div
              aria-hidden
              className="absolute inset-0 bg-cover opacity-35 blur-xl"
              style={{
                backgroundImage: `url(${imageUrl})`,
                ...puzzleBackdropStyle(presentation),
              }}
            />
          )}
          {puzzleState.tiles.map((tileNumber, index) => (
            <PuzzleTile
              key={`tile-${tileNumber}`}
              tileNumber={tileNumber}
              isEmpty={tileNumber === 0}
              imageUrl={imageUrl}
              presentation={presentation}
              gridSize={gridSize}
              position={getGridPosition(index, gridSize)}
              isClickable={validMoves.includes(index) && !isCompleted}
              onTileClick={move}
              tileIndex={index}
              animationIntensity={animationIntensity}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset} variant="outline" className="min-h-12 gap-2">
          <RotateCcw className="h-4 w-4" /> Restart
        </Button>
        <Button
          onClick={() => setShowHelp(true)}
          variant="outline"
          className="min-h-12 gap-2"
          aria-expanded={showHelp}
          aria-controls="photo-puzzle-help"
          aria-label={
            helpsLeft > 0
              ? "Open puzzle help, " + helpsLeft + " hints remaining"
              : "Open puzzle help, no hints remaining"
          }
        >
          <WandSparkles className="h-4 w-4" />{" "}
          {helpsLeft > 0 ? "Hint · " + helpsLeft : "Hint"}
        </Button>
      </div>

      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="recipient-dialog-overlay fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
          >
            <motion.section
              ref={helpDialogRef}
              id="photo-puzzle-help"
              role="dialog"
              aria-modal="true"
              aria-labelledby="photo-puzzle-help-title"
              className="w-full max-w-md rounded-[1.5rem] border border-[var(--experience-border)] bg-[var(--experience-surface)] p-5 text-[var(--experience-surface-foreground)] shadow-2xl @[640px]/recipient-preview:rounded-2xl"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="photo-puzzle-help-title" className="text-xl font-semibold">
                    Need a little help?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--experience-surface-muted)]">
                    You can make the puzzle easier or reveal the memory now.
                  </p>
                </div>
                <button
                  ref={helpCloseRef}
                  type="button"
                  aria-label="Close puzzle help"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--experience-border)] text-[var(--experience-surface-foreground)] transition hover:bg-[var(--experience-surface-elevated)]"
                  onClick={() => setShowHelp(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-14 justify-start px-4 py-3 text-left"
                  onClick={help}
                  disabled={helpsLeft <= 0}
                >
                  <span>
                    <span className="block font-semibold">
                      {helpsLeft > 0 ? "Give me a hint" : "No hints left"}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {helpsLeft > 0
                        ? "Move a few pieces closer to place. " +
                          helpsLeft +
                          " " +
                          (helpsLeft === 1 ? "hint" : "hints") +
                          " left."
                        : "You've used both hints for this puzzle."}
                    </span>
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-14 justify-start px-4 py-3 text-left"
                  onClick={() => setShowRevealConfirm(true)}
                >
                  <span>
                    <span className="block font-semibold">Reveal the memory</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Skip the rest of the puzzle.
                    </span>
                  </span>
                </Button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        open={showRevealConfirm}
        title="Reveal the memory?"
        message="You can skip the rest of the puzzle and see what's behind it."
        cancelLabel="Keep solving"
        confirmLabel="Reveal memory"
        onCancel={() => setShowRevealConfirm(false)}
        onConfirm={() => {
          setShowHelp(false);
          setShowRevealConfirm(false);
          onRevealAlternative();
        }}
      />
    </div>
  );
}
