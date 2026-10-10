"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Gift, ShieldCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LandingResourceLinks } from "@/components/landing-resource-links";
import { TEMPLATE_CARD_ART } from "@/lib/design-assets";

export function LandingHero() {
  const reduce = useReducedMotion();
  return (
    <section className="landing-hero paper-texture relative overflow-hidden">
      <div className="site-container relative mx-auto grid items-center gap-12 py-12 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:py-20">
        <div>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="site-display max-w-2xl text-balance"
          >
            Turn a simple message into a{" "}
            <span className="text-primary">tiny experience.</span>
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="site-supporting mt-6 max-w-[38ch] text-pretty text-muted-foreground"
          >
            Create a playful surprise with your words and photos, then
            send it as a file to someone you care about.
          </motion.p>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" className="min-h-12 w-full px-6 shadow-warm sm:w-auto">
              <Link href="/templates">
                <Gift className="mr-2 h-5 w-5" />
                Create a surprise
              </Link>
            </Button>
            <LandingResourceLinks />
          </motion.div>
          <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              No account or cloud upload. Your surprise stays on this device
              until you choose to send it; uploaded photos travel with it.
              YouTube music still needs internet.
            </span>
          </p>
        </div>


        <motion.figure
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : .45 }}
          className="landing-hero__featured mx-auto w-full max-w-[540px]"
        >
          <div className="landing-hero__artwork relative aspect-[4/3]">
            <Image src={TEMPLATE_CARD_ART['catch-the-heart']} alt="An illustrated moment from Catch the Heart" fill priority sizes="(min-width: 1024px) 540px, 92vw" className="rounded-[1.5rem] object-cover" />
            <Image src="/hearts/heart_1.png" alt="" aria-hidden width={44} height={44} className="absolute left-[13%] top-[18%] -rotate-12" />
            <Image src="/hearts/heart_1.png" alt="" aria-hidden width={32} height={32} className="absolute right-[15%] top-[34%] rotate-12" />
            <div className="landing-hero__memory absolute bottom-5 left-5 right-5 flex items-center gap-4 rounded-xl bg-card p-3 sm:bottom-7 sm:left-7 sm:right-auto sm:max-w-[340px] sm:p-4">
              <Image src="/art/demo/memory-1.jpg" alt="A sample photo memory" width={72} height={72} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="text-base font-medium leading-6 text-foreground">A favorite little memory.</p>
                <p className="mt-1 text-xs text-muted-foreground">Catch a heart. Keep a moment.</p>
              </div>
            </div>
          </div>
          <figcaption className="pt-6">
            <h2 className="text-2xl font-semibold tracking-[-.025em]">Catch the Heart</h2>
            <p className="mt-2 max-w-[38ch] text-sm leading-6 text-muted-foreground">Catch little hearts and uncover every memory.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="outline" className="min-h-12"><Link href="/s/catch-the-heart-demo">Preview</Link></Button>
              <Button asChild variant="ghost" className="min-h-12"><Link href="/create/catch-the-heart">Use template</Link></Button>
            </div>
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
