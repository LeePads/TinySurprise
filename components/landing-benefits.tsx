"use client";

import { motion, useReducedMotion } from "framer-motion";


const benefits = [
  {
    title: "No account",
    description: "Begin the moment inspiration arrives.",
  },
  {
    title: "Private by design",
    description: "Photos stay on your device and inside your file.",
  },
  {
    title: "Works offline by default",
    description: "Uploaded photos stay in the file; YouTube music needs internet.",
  },
  {
    title: "Made for every screen",
    description: "Comfortable on phones, tablets, and desktops.",
  },
  {
    title: "Easy to make yours",
    description: "Change every meaningful detail without design software.",
  },
  {
    title: "One sendable file",
    description: "Save it locally, then send it through chat, email, or storage.",
  },
];

export function LandingBenefits() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="landing-benefits py-16 sm:py-24">
      <div className="site-container mx-auto">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true }}
          className="landing-benefits__frame"
        >
          <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:gap-14">
            <div className="landing-benefits__editorial relative overflow-hidden rounded-[2rem] bg-primary bg-[linear-gradient(rgba(24,10,17,.84),rgba(24,10,17,.84)),url('/background/styles/page_2.png')] bg-cover bg-[center_20%] p-7 text-white sm:p-10">
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[38px] border-white/10"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-white/10 blur-2xl"
              />
              <h2 className="relative max-w-md text-balance text-3xl font-bold tracking-[-.035em] sm:text-4xl">
                The memories are personal. The process stays simple.
              </h2>
              <p className="relative mt-5 max-w-md text-pretty leading-7 text-white/85">
                Tiny Surprise gives you a polished little canvas without asking
                you or your recipient to create an account.
              </p>
            </div>

            <div className="landing-benefits__list grid gap-x-8 gap-y-5 sm:grid-cols-2 sm:gap-y-7">
              {benefits.map((benefit, index) => {
                return (
                  <motion.div
                    key={benefit.title}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    viewport={{ once: true }}
                    className="min-w-0 border-t border-border/70 pt-4"
                  >
                    <div>
                      <h3 className="font-bold">{benefit.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {benefit.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
