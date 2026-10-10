"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Eye, Lock } from "lucide-react";
import { TEMPLATE_CARD_ART } from "@/lib/design-assets";

interface TemplateCardProps {
  id: string;
  name: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  isAvailable: boolean;
  preview?: string;
  onPreview?: () => void;
}

const starterHints: Record<string, string> = {
  "catch-the-heart": "Start with a few personal notes",
  "photo-puzzle": "Start with one photo",
  "open-when": "Start with letters for different moments",
  "choose-our-date": "Start with date questions and choices",
  "memory-quiz": "Start with questions about your memories",
  "our-storybook": "Start with pages of your story",
  "cozy-playlist": "Start with songs and a note",
};

export function TemplateCard({
  id,
  name,
  description,
  isAvailable,
  preview,
  onPreview,
}: TemplateCardProps) {
  const artwork = TEMPLATE_CARD_ART[id];
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="group h-full"
    >
      <div className="premium-card flex h-full flex-col overflow-hidden rounded-[1.65rem] border border-border/70 bg-card shadow-[var(--shadow-soft)] transition duration-300 group-hover:border-primary/30 group-hover:shadow-[var(--shadow-elevated)]">
        <div className="relative min-h-44 overflow-hidden bg-secondary">
          {artwork ? (
            <Image
              src={artwork}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              quality={82}
              className="object-cover transition duration-500 ease-out motion-safe:group-hover:scale-[1.035]"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,hsl(var(--primary)/.3),transparent_38%),linear-gradient(145deg,hsl(var(--secondary)),hsl(var(--card)))]" />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(8,5,9,.92)_0%,rgba(8,5,9,.72)_34%,rgba(8,5,9,.18)_68%,transparent_100%)]"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-5">
            <div className="min-w-0">
              <h3 className="break-words text-xl font-bold leading-tight text-white [text-shadow:0_2px_10px_rgb(0_0_0/.9)]">
                {name}
              </h3>
            </div>
            {!isAvailable && (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/45 bg-black/70 text-white shadow-sm">
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Coming soon</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="min-h-12 text-sm font-medium leading-6 text-muted-foreground">
            {description}
          </p>
          <span className="mt-4 w-fit rounded-full border border-primary/15 bg-primary/[.07] px-2.5 py-1 text-[11px] font-bold text-primary">
            {starterHints[id] || "Make it personal"}
          </span>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
            {isAvailable ? (
              <>
                <Link
                  href={`/s/${id}-demo`}
                  aria-label={`Try an example of ${name}`}
                  onClick={onPreview}
                  className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/75 px-3 py-2 text-center text-sm font-semibold leading-5 text-foreground transition hover:border-primary/40 hover:bg-primary/[.07] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  <Eye className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0">Try an example</span>
                </Link>
                <Link
                  href={`/create/${id}`}
                  aria-label={`Create ${name}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground shadow-sm transition motion-safe:hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-warm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
                >
                  Create <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                {preview ? (
                  <Link
                    href={preview}
                    onClick={onPreview}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/[.07] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" /> Preview
                  </Link>
                ) : (
                  <span />
                )}
                <span className="inline-flex min-h-12 items-center justify-center rounded-xl border bg-secondary/60 px-3 text-sm font-semibold text-muted-foreground">
                  Coming soon
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
