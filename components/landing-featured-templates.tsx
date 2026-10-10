"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { TemplateCard } from "@/components/template-card";
import { TEMPLATES } from "@/lib/config";

const featuredIds = [
  "catch-the-heart",
  "photo-puzzle",
  "open-when",
  "our-storybook",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48 } },
};

export function LandingFeaturedTemplates() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <div className="site-container relative mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-10 flex flex-col justify-between gap-6 sm:mb-12 md:flex-row md:items-end"
        >
          <div>
            <h2 className="max-w-2xl text-balance text-3xl font-bold tracking-[-.035em] sm:text-4xl">
              A different kind of surprise for every kind of connection.
            </h2>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              Create something for a partner, close friend, or family member.
              Start with a playful idea and make every word, photograph, color,
              and reveal completely yours.
            </p>
          </div>
          <Link
            href="/templates"
            className="inline-flex min-h-11 w-fit items-center gap-2 px-1 text-sm font-bold text-primary underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            See every template <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
        >
          {featuredIds.map((id) => {
            const template = TEMPLATES[id];
            return template?.isAvailable ? (
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
            ) : null;
          })}
        </motion.div>

      </div>
    </section>
  );
}
