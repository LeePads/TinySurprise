'use client'

import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock3, Gift, Heart, MapPin, Sparkles, Ticket, X } from 'lucide-react'
import { useState } from 'react'

type PreviewKind = 'coupons' | 'capsule' | 'treasure'

const previewCopy = {
  coupons: { eyebrow: 'Preview concept', title: 'A pocketful of promises', note: 'Tap a coupon to try the little redeem moment.' },
  capsule: { eyebrow: 'Preview concept', title: 'A memory saved for later', note: 'Open the capsule and uncover what was tucked inside.' },
  treasure: { eyebrow: 'Preview concept', title: 'Our little treasure hunt', note: 'Follow three clues to reach the final surprise.' },
} satisfies Record<PreviewKind, { eyebrow: string; title: string; note: string }>

export function ComingSoonPreview({ kind }: { kind: PreviewKind }) {
  const copy = previewCopy[kind]
  return (
    <main className={`concept-preview concept-${kind} min-h-svh overflow-hidden px-4 py-6 text-[#392c38] sm:px-6 sm:py-10`}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/templates" className="rounded-full border border-black/10 bg-white/75 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur transition hover:-translate-y-0.5">← All templates</Link>
          <span className="rounded-full bg-[#392c38] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.16em] text-white">Coming soon</span>
        </div>
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-black uppercase tracking-[.24em] text-[#b64e78]">{copy.eyebrow}</p>
          <h1 className="mt-3 text-balance text-4xl font-black sm:text-6xl">{copy.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty leading-7 text-[#6e596b]">{copy.note}</p>
        </header>
        <div className="mt-9">{kind === 'coupons' ? <CouponPreview /> : kind === 'capsule' ? <CapsulePreview /> : <TreasurePreview />}</div>
      </div>
    </main>
  )
}

const coupons = [
  { title: 'One slow Sunday', detail: 'Blankets, snacks, and absolutely no alarms.', color: '#ffd3df' },
  { title: 'Your pick for dinner', detail: 'You choose the place. I bring the dessert.', color: '#ffe0ad' },
  { title: 'A tiny adventure', detail: 'One mystery destination and a camera roll full of us.', color: '#cbe7de' },
]

function CouponPreview() {
  const [active, setActive] = useState<number | null>(null)
  return <>
    <div className="grid gap-4 md:grid-cols-3">
      {coupons.map((coupon, index) => <motion.button key={coupon.title} type="button" whileHover={{ y: -6, rotate: index - 1 }} whileTap={{ scale: .97 }} onClick={() => setActive(index)} className="relative min-h-56 overflow-hidden rounded-[2rem] border-2 border-dashed border-[#6b4a5d]/30 p-6 text-left shadow-[0_18px_45px_rgba(91,53,75,.12)]" style={{ background: coupon.color }}>
        <Ticket className="h-9 w-9"/><span className="mt-12 block text-xs font-black uppercase tracking-[.2em]">Promise no. {index + 1}</span><strong className="mt-2 block text-2xl leading-tight">{coupon.title}</strong><span className="mt-4 block text-sm font-semibold opacity-65">Tap to redeem ♥</span>
      </motion.button>)}
    </div>
    <AnimatePresence>{active !== null && <motion.div className="fixed inset-0 z-50 grid place-items-center bg-[#261b25]/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActive(null)}><motion.section initial={{ scale: .75, rotate: -4, y: 35 }} animate={{ scale: 1, rotate: 0, y: 0 }} exit={{ scale: .8, opacity: 0 }} transition={{ type: 'spring', bounce: .38 }} onClick={event => event.stopPropagation()} className="relative w-full max-w-md rounded-[2.25rem] border-4 border-double border-[#b64e78] bg-[#fffaf4] p-8 text-center shadow-2xl"><button aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 hover:bg-black/5" onClick={() => setActive(null)}><X/></button><Gift className="mx-auto h-14 w-14 text-[#b64e78]"/><p className="mt-5 text-xs font-black uppercase tracking-[.2em]">Consider it redeemed</p><h2 className="mt-2 text-3xl font-black">{coupons[active].title}</h2><p className="mt-4 leading-7 text-[#6e596b]">{coupons[active].detail}</p><div className="mt-6 text-3xl">♥ ✦ ♥</div></motion.section></motion.div>}</AnimatePresence>
  </>
}

function CapsulePreview() {
  const [open, setOpen] = useState(false)
  return <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-white/70 bg-white/55 p-5 shadow-[0_25px_70px_rgba(65,68,106,.16)] backdrop-blur sm:p-10">
    <AnimatePresence mode="wait">
      {!open ? <motion.button key="closed" type="button" exit={{ scale: .8, opacity: 0, rotate: 8 }} onClick={() => setOpen(true)} className="group mx-auto grid min-h-96 w-full place-items-center rounded-[2rem] border-2 border-dashed border-[#6468a6]/30 bg-[#e8e8ff]/75 p-8 text-center">
        <span><Clock3 className="mx-auto h-20 w-20 text-[#6468a6] transition group-hover:rotate-12"/><strong className="mt-6 block text-3xl">Open our time capsule</strong><span className="mt-3 block text-[#665c79]">Saved with love · ready today</span><span className="mx-auto mt-6 inline-flex rounded-full bg-[#6468a6] px-5 py-3 font-bold text-white">Break the seal</span></span>
      </motion.button> : <motion.section key="open" initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} className="text-center"><div className="grid gap-4 sm:grid-cols-2"><div className="relative min-h-72 overflow-hidden rounded-[1.75rem] shadow-lg"><Image src="/art/demo/memory-4.jpg" alt="A sample shared memory" fill className="object-cover" sizes="(min-width: 640px) 350px, 90vw"/></div><div className="flex flex-col justify-center rounded-[1.75rem] bg-[#fff8e7] p-7 text-left"><Sparkles className="h-8 w-8 text-[#d5855e]"/><p className="mt-5 font-serif text-2xl leading-relaxed">“I hope future us still laughs this loudly, takes the long way home, and saves the last bite for each other.”</p><p className="mt-5 text-sm font-bold text-[#9c664f]">— us, from a lovely little while ago</p></div></div><button onClick={() => setOpen(false)} className="mt-6 rounded-full border bg-white px-5 py-3 font-bold">Seal it again</button></motion.section>}
    </AnimatePresence>
  </div>
}

const clues = [
  { icon: '☕', title: 'Where our mornings begin', text: 'Look near the place that knows exactly how you take your favorite drink.' },
  { icon: '♫', title: 'The song that found us', text: 'Your next clue is hiding wherever our favorite chorus waits.' },
  { icon: '♥', title: 'You found the treasure', text: 'The prize was never a place. It was another little memory with you.' },
]

function TreasurePreview() {
  const [step, setStep] = useState(0)
  const clue = clues[step]
  return <div className="mx-auto max-w-2xl">
    <div className="mb-5 flex items-center justify-center gap-2">{clues.map((_, index) => <span key={index} className={`h-3 rounded-full transition-all ${index <= step ? 'w-10 bg-[#c56868]' : 'w-3 bg-white/70'}`}/>)}</div>
    <motion.section key={step} initial={{ opacity: 0, x: 45, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} className="relative overflow-hidden rounded-[2.5rem] border border-[#704d35]/20 bg-[#fffaf0] p-7 text-center shadow-[0_24px_70px_rgba(101,70,48,.18)] sm:p-12"><div aria-hidden className="absolute inset-4 rounded-[2rem] border-2 border-dashed border-[#c68b69]/35"/><span className="relative text-7xl">{clue.icon}</span><p className="relative mt-6 text-xs font-black uppercase tracking-[.25em] text-[#b86464]">Clue {step + 1} of {clues.length}</p><h2 className="relative mt-3 text-3xl font-black sm:text-4xl">{clue.title}</h2><p className="relative mx-auto mt-4 max-w-md text-lg leading-8 text-[#705e52]">{clue.text}</p>{step < clues.length - 1 ? <button onClick={() => setStep(value => value + 1)} className="relative mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c56868] px-6 font-extrabold text-white shadow-lg"><MapPin className="h-5 w-5"/> I found it</button> : <button onClick={() => setStep(0)} className="relative mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c56868] px-6 font-extrabold text-white shadow-lg"><Heart className="h-5 w-5 fill-current"/> Hunt again</button>}</motion.section>
  </div>
}
