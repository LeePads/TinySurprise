'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { WholesomeAtmosphere } from './wholesome-atmosphere'

export function LandingHowItWorks() {
  const reduceMotion = useReducedMotion()
  const steps = [
    {
      number: 1,
      title: 'Choose a template',
      description: 'Try a preview, then pick the surprise you want to make.',
    },
    {
      number: 2,
      title: 'Make it personal',
      description: 'Add your words, photos, and optional music. Preview it before sending.',
    },
    {
      number: 3,
      title: 'Save and send your surprise',
      description: 'Save the finished file to your device, then send it in the chat app you already use.',
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  }

  return (
    <section id="how-it-works" className="relative overflow-hidden bg-secondary/15 py-16 sm:py-24"><WholesomeAtmosphere contained density={6}/>
      <div className="container relative z-10 max-w-6xl mx-auto px-4">
        {/* Section heading */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-12 text-center sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">How it works</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Three simple steps to create a memorable moment
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial={reduceMotion ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-9 md:grid-cols-3 md:gap-12"
        >
          {steps.map((step) => {
            return (
              <motion.div
                key={step.number}
                variants={reduceMotion ? undefined : itemVariants}
                className="group relative"
              >
                <div className="h-full border-t border-border/70 pt-5 sm:pt-6">
                  <div className="mb-4 flex items-center gap-3 text-primary">
                    <span className="text-3xl font-medium tabular-nums tracking-[-.03em]">0{step.number}</span>
                  </div>

                  {/* Content */}
                  <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="max-w-[34ch] text-sm leading-7 text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
