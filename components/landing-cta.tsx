"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingResourceLinks } from "@/components/landing-resource-links";

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
        <div className="relative mx-auto mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <LandingResourceLinks compact />
        </div>
      </motion.div>
    </section>
  );
}
