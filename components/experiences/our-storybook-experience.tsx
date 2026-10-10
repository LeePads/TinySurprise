"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OurStorybookContent, SurpriseData } from "@/lib/types";
import { PresentationImage } from "@/components/presentation-image";
import { createExperienceProgress } from "@/lib/experience-progress";
import { resolveExperienceCompletion } from "@/lib/experience-completion";
import {
  isPlayableStorybookContent,
  normalizeStorybookContent,
  resolveStoryPageComposition,
} from "@/lib/storybook";
import { useRecipientReducedMotion } from "@/lib/recipient-motion";

export function OurStorybookExperience({data}:{data:SurpriseData}) {
  const normalizedContent=normalizeStorybookContent(data.content)
  const d=normalizedContent as OurStorybookContent
  const pages=Array.isArray(d.pages)?d.pages:[]
  const playable=isPlayableStorybookContent(normalizedContent,'compatibility')
  const [i,setI]=useState(0)
  const [indexOpen,setIndexOpen]=useState(false)
  const reduce=useRecipientReducedMotion(data.appearance.animationIntensity)
  const completion=resolveExperienceCompletion(data)
  const backCover=i>=pages.length
  const p=pages[Math.min(i,Math.max(0,pages.length-1))]
  const nextPage=!backCover?pages[i+1]:undefined
  const pointer=useRef<{id:number;x:number;y:number}|undefined>(undefined)
  const pendingFocus=useRef<'page'|'back-cover'|'chapters'|undefined>(undefined)
  const pageHeadingRef=useRef<HTMLHeadingElement>(null)
  const backCoverHeadingRef=useRef<HTMLHeadingElement>(null)
  const firstChapterRef=useRef<HTMLButtonElement>(null)
  const progress=createExperienceProgress('our-storybook',Math.min(i+1,pages.length),pages.length)
  const visiblePages=backCover?[]:[p,nextPage].filter(Boolean) as OurStorybookContent['pages']
  useEffect(()=>{
    const target=pendingFocus.current
    if(!playable||!target)return
    let attempts=0
    let frame=0
    const focusTarget=()=>{
      if(target==='chapters'){
        if(firstChapterRef.current?.isConnected){firstChapterRef.current.focus();pendingFocus.current=undefined;return}
      }else if(target==='back-cover'){
        if(backCoverHeadingRef.current?.isConnected){backCoverHeadingRef.current.focus();pendingFocus.current=undefined;return}
      }else if(pageHeadingRef.current?.isConnected&&pageHeadingRef.current.dataset.storyPageId===p?.id){
        pageHeadingRef.current.focus();pendingFocus.current=undefined;return
      }
      if(attempts++<20)frame=window.requestAnimationFrame(focusTarget)
    }
    frame=window.requestAnimationFrame(focusTarget)
    return()=>window.cancelAnimationFrame(frame)
  },[i,indexOpen,p?.id,playable])
  const turn=(direction:number)=>setI(value=>{
    const next=Math.min(pages.length,Math.max(0,value+direction))
    pendingFocus.current=next>=pages.length?'back-cover':'page'
    return next
  })
  if(!playable)return <div role="alert" className="flex min-h-[430px] items-center justify-center rounded-[2rem] bg-[var(--experience-surface)] p-8 text-center">This Storybook could not be opened because its pages are incomplete.</div>
  return <div className="storybook-root mx-auto max-w-5xl space-y-5 text-center" style={{touchAction:'pan-y'}} onPointerDown={event=>{if(event.isPrimary)pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY}}} onPointerUp={event=>{const start=pointer.current;pointer.current=undefined;if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x;const dy=event.clientY-start.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy))turn(dx<0?1:-1)}} onPointerCancel={()=>{pointer.current=undefined}}>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{backCover?'Back cover':progress.announce}</p>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <p className="text-sm font-semibold text-primary">{backCover?'The back cover':progress.label}</p>
      {pages.length>8&&<Button type="button" size="sm" variant="ghost" onClick={()=>setIndexOpen(value=>{const next=!value;if(next)pendingFocus.current='chapters';return next})} aria-expanded={indexOpen}><List className="mr-2 h-4 w-4"/>Chapters</Button>}
    </div>
    {indexOpen&&<nav className="flex flex-wrap justify-center gap-2 rounded-2xl bg-[var(--experience-surface-elevated)] p-3" aria-label="Story chapters">{pages.map((page,index)=><Button ref={index===0?firstChapterRef:undefined} key={page.id} type="button" size="sm" variant={i===index?'default':'ghost'} aria-current={i===index?'page':undefined} onClick={()=>{pendingFocus.current='page';setI(index);setIndexOpen(false)}}>{index+1}. {page.title}</Button>)}</nav>}
    <AnimatePresence mode="wait">
      {backCover?<motion.section key="back-cover" initial={reduce?false:{opacity:0,rotateY:-8}} animate={reduce?undefined:{opacity:1,rotateY:0}} className="mx-auto flex min-h-[430px] max-w-2xl flex-col items-center justify-center rounded-[2rem] bg-[var(--experience-surface)] p-8 shadow-warm @[640px]/recipient-preview:p-12"><BookOpen className="h-10 w-10 text-primary"/><h2 ref={backCoverHeadingRef} tabIndex={-1} className="mt-5 text-3xl font-bold outline-none">{completion.title}</h2><p className="mt-5 whitespace-pre-wrap text-lg leading-8">{completion.finalMessage}</p>{completion.closingMessage&&<p className="mt-4 font-medium">{completion.closingMessage}</p>}{completion.signature&&<p className="mt-3 text-sm italic text-[var(--experience-muted)]">{completion.signature}</p>}<div className="mt-7 flex flex-wrap justify-center gap-3"><Button type="button" onClick={()=>{pendingFocus.current='page';setIndexOpen(false);setI(0)}}>Read again</Button><Button type="button" variant="outline" onClick={()=>{pendingFocus.current='chapters';setI(0);setIndexOpen(true)}}>Browse chapters</Button></div></motion.section>:
      <motion.div key={p.id} initial={reduce?false:{opacity:0,x:24,rotateY:-4}} animate={reduce?undefined:{opacity:1,x:0,rotateY:0}} exit={reduce?undefined:{opacity:0,x:-18}} transition={{duration:reduce?0:.28,ease:'easeOut'}} className="storybook-spread grid overflow-hidden rounded-[2rem] bg-[var(--experience-surface-elevated)] p-2 shadow-warm">
        {visiblePages.map((page,index)=>{const composition=resolveStoryPageComposition(page);return <article key={page.id} className={`storybook-page storybook-page--${composition} flex min-h-[430px] flex-col bg-[var(--experience-surface)] p-5 text-left @[640px]/recipient-preview:p-8 ${index===1?'storybook-page--adjacent':''}`}>
          {page.photo&&<PresentationImage image={{...page.photo,presentation:composition==='photo-led'?(page.photo.presentation||{mode:'fill'}):page.photo.presentation}} alt={page.title?`Memory for ${page.title}`:'Story memory'} aspectRatio={composition==='photo-led'?'3 / 4':'4 / 3'} frameClassName={`w-full rounded-2xl bg-muted ${composition==='note-focused'?'max-h-48':'mb-5'}`} loading="lazy"/>}
          <p className="mt-4 text-sm font-semibold text-primary">Page {i+index+1}</p><h2 ref={index===0?pageHeadingRef:undefined} data-story-page-id={index===0?page.id:undefined} tabIndex={index===0?-1:undefined} className="mt-2 [overflow-wrap:anywhere] text-3xl font-bold outline-none">{page.title}</h2><p className="mt-5 whitespace-pre-wrap [overflow-wrap:anywhere] text-lg leading-relaxed text-[var(--experience-muted)]">{page.body}</p>
        </article>})}
      </motion.div>}
    </AnimatePresence>
    {!backCover&&<div className="flex flex-wrap justify-center gap-3"><Button type="button" variant="outline" className="min-h-12" disabled={!i} onClick={()=>turn(-1)}>Previous page</Button><Button type="button" className="min-h-12" onClick={()=>turn(1)}>{i===pages.length-1?'Close the book':'Turn the page'}</Button></div>}
  </div>
}
