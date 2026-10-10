'use client'

import Image from 'next/image'
import { Check } from 'lucide-react'
import { HEART_STYLES } from '@/lib/design-assets'
import type { HeartStyle } from '@/lib/types'

export function HeartStylePicker({value,onChange}:{value:HeartStyle;onChange:(style:HeartStyle)=>void}){
  return <section className="rounded-[2rem] border border-border/70 bg-card/70 p-5"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Choose the falling hearts</p><h3 className="mt-1 text-lg font-semibold">What should they catch?</h3></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{(Object.entries(HEART_STYLES) as [HeartStyle,(typeof HEART_STYLES)[HeartStyle]][]).map(([id,item])=>{const selected=value===id;return <button type="button" key={id} aria-pressed={selected} onClick={()=>onChange(id)} className={`relative flex min-h-36 flex-col items-center justify-center rounded-2xl border bg-card/80 p-3 text-center transition hover:-translate-y-1 hover:shadow-lg ${selected?'border-primary ring-4 ring-primary/15':'border-border/70'}`}><Image src={item.src} alt="" width={72} height={72} className="h-16 w-16 object-contain"/><strong className="mt-2 text-sm">{item.label}</strong><span className="mt-1 text-[11px] text-muted-foreground">{item.description}</span>{selected&&<span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5"/></span>}</button>})}</div></section>
}
