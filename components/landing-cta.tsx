"use client";

import Link from "next/link";
import type { SVGProps } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Heart, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_LINKS } from "@/lib/site-links";

function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22" />
    </svg>
  );
}

export function LandingCTA() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="px-3 py-16 sm:px-4 sm:py-24">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        viewport={{ once: true }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-primary/20 bg-[linear-gradient(rgba(18,12,17,.42),rgba(18,12,17,.5)),url('/background/styles/page_1.png')] bg-cover bg-center px-6 py-14 text-center shadow-[var(--shadow-elevated)] sm:px-12 sm:py-20"
      >
        <span
          aria-hidden="true"
          className="absolute left-[9%] top-[18%] text-white/25"
        >
          <Heart className="h-12 w-12 fill-current" />
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-[14%] right-[8%] text-white/25"
        >
          <Sparkles className="h-11 w-11" />
        </span>
        <h2 className="relative mx-auto max-w-3xl text-balance text-3xl font-bold tracking-[-.04em] text-white sm:text-5xl">
          Make a tiny surprise worth opening twice.
        </h2>
        <p className="relative mx-auto mb-8 mt-5 max-w-xl text-pretty text-base leading-7 text-white/80 sm:text-lg">
          Choose a template, add the moments only you share, and save a private
          file to send.
        </p>
        <Button
          asChild
          size="lg"
          className="relative min-h-13 px-7 shadow-warm"
        >
          <Link href="/templates">
            Create a surprise <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <div className="landing-resource-links relative mx-auto mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
          {[
            { ...SITE_LINKS.github, Icon: GitHubIcon },
            { ...SITE_LINKS.android, Icon: Smartphone },
          ].map(({ label, Icon }) => (
            <Button key={label} type="button" variant="outline" disabled className="h-auto min-h-12 w-full min-w-0 justify-start gap-3 whitespace-normal px-4 py-3 text-left disabled:opacity-100">
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-1">
                <span>{label}</span>
                <span className="text-xs font-normal text-muted-foreground">Coming soon</span>
              </span>
            </Button>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
