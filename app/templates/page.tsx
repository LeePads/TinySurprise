"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Header } from "@/components/header";
import { TemplateCard } from "@/components/template-card";
import { getReleasedTemplateEntries } from "@/lib/config";
import { WholesomeAtmosphere } from "@/components/wholesome-atmosphere";
import { isNativePlatform } from "@/lib/platform";
import { useAndroidWideLayout, useMediaQuery } from "@/lib/use-media-query";

export default function TemplatesPage() {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);
  const wide = useAndroidWideLayout();
  const extraWide = useMediaQuery("(min-width: 900px)");
  const denseNative = native && wide;
  const reduceMotion = useReducedMotion();

  const releasedTemplates = getReleasedTemplateEntries();

  const containerVariants = {
    hidden: { opacity: reduceMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.1,
        delayChildren: reduceMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.5 },
    },
  };

  return (
    <>
      <Header />
      <main
        className={`relative min-h-svh overflow-hidden bg-background ${native ? "android-page" : ""}`}
      >
        <WholesomeAtmosphere density={8} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_15%_20%,var(--decorative-rose),transparent_28%),radial-gradient(circle_at_85%_15%,var(--decorative-sky),transparent_28%)] opacity-[.12]"
        />
        <div className="site-container relative z-10 mx-auto py-8 sm:py-14">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5 }}
            className="mb-8 border-b border-border/70 pb-7 sm:pb-8"
          >
            <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
              <div>
                <h1 className="site-page-title text-foreground">Choose your surprise</h1>
                <p className="site-supporting mt-3 text-muted-foreground">
                  Try an example, then make it yours.
                </p>
              </div>
            </div>
          </motion.div>

          <h2 className="sr-only">Available templates</h2>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={`grid gap-6 ${denseNative ? (extraWide ? "grid-cols-3" : "grid-cols-2") : "sm:grid-cols-2 lg:grid-cols-3"}`}
          >
            {releasedTemplates.map(([id, template]) => (
              <motion.div key={id} variants={itemVariants}>
                <TemplateCard
                  id={id}
                  name={template.name}
                  description={template.description}
                  difficulty={template.difficulty}
                  isAvailable={template.isAvailable}
                  preview={template.preview}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>
    </>
  );
}
