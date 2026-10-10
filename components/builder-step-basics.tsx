'use client'
import { useReviewField } from '@/lib/review-field';
import { TextBudget } from './ui/text-budget';
import { TEXT_LIMITS } from "@/lib/text-limits";
import { validateBasics } from "@/lib/validation";

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Check, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { SurpriseBasics } from '@/lib/types'
import { InlineFieldMessage } from './ui/inline-field-message'
import { RecipientPicker, type RecipientSelection } from './recipient-picker'
import { isNativePlatform } from '@/lib/platform'
import { readSenderProfile } from '@/lib/sender-profile'
import { BuilderWorkspace } from './builder-workspace'

export function StepBasics({data,onUpdate}:{data:Partial<SurpriseBasics>;onUpdate:(v:Partial<SurpriseBasics>)=>void}){
 const b=data as SurpriseBasics
 const [showErrors,setShowErrors]=useState(false)
 const [native,setNative]=useState(false)
 useEffect(()=>{setNative(isNativePlatform())},[])
 useEffect(()=>{const show=()=>setShowErrors(true);window.addEventListener('tiny-validation-attempted',show);return()=>window.removeEventListener('tiny-validation-attempted',show)},[])
 // Prefill "From" once from the saved sender profile, only when this
 // surprise doesn't already have a sender name — never overwrites an
 // in-progress edit or an already-started draft.
 useEffect(()=>{
  if(!native||b.senderName?.trim())return
  const profile=readSenderProfile()
  if(profile)onUpdate({senderName:profile.displayName,senderProfileId:profile.id,senderSignOff:profile.defaultSignOff})
 },[native]) // eslint-disable-line react-hooks/exhaustive-deps
 const change=(field:keyof SurpriseBasics,value:string)=>onUpdate({[field]:value})
 const complete=validateBasics(b).valid
 const required=(value?:string)=>!value?.trim()

 if(native) return <NativeStepBasics b={b} showErrors={showErrors} complete={complete} onUpdate={onUpdate} change={change}/>

  return <BuilderWorkspace preview={<div className="builder-context-note"><p className="text-sm font-semibold text-primary">The first impression</p><p className="mt-3 text-lg font-semibold leading-snug">{b.recipientName?.trim() || "Their name"} will open a small moment made by {b.senderName?.trim() || "you"}.</p><p className="builder-helper mt-3 text-muted-foreground">Your opening words set the tone. Keep them honest, specific, and easy to feel.</p></div>}>
  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-7">
  <div className="border-b border-border/70 pb-5"><h3 className="builder-section-title">Who is this little moment for?</h3><p className="builder-helper mt-2 text-muted-foreground">A few details help us make the reveal feel personal.</p></div>
  <Field id="sender-name" label="Your name" missing={showErrors&&required(b.senderName)}><Input textBudget={TEXT_LIMITS.name} budgetRequired id="sender-name" placeholder="The name they know you by" value={b.senderName||''} onChange={e=>change('senderName',e.target.value)} aria-invalid={showErrors&&required(b.senderName)} aria-describedby={showErrors&&required(b.senderName)?'sender-name-error':undefined}/></Field>
  <Field id="recipient-name" label="Their name" missing={showErrors&&required(b.recipientName)}><Input textBudget={TEXT_LIMITS.name} budgetRequired id="recipient-name" placeholder="Who will open this?" value={b.recipientName||''} onChange={e=>change('recipientName',e.target.value)} aria-invalid={showErrors&&required(b.recipientName)} aria-describedby={showErrors&&required(b.recipientName)?'recipient-name-error':undefined}/></Field>
  <Field id="opening-message" label="Opening message" missing={showErrors&&required(b.openingMessage)}><p className="mb-2 text-sm text-muted-foreground">A short note they&apos;ll see first.</p><Textarea textBudget={TEXT_LIMITS.opening} budgetRequired id="opening-message" rows={4} placeholder="I made this little surprise for you…" value={b.openingMessage||''} onChange={e=>change('openingMessage',e.target.value)} aria-invalid={showErrors&&required(b.openingMessage)} aria-describedby={showErrors&&required(b.openingMessage)?'opening-message-error':undefined}/></Field>
  {complete&&<p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Check className="h-4 w-4" aria-hidden="true" /> Ready to continue</p>}
 </motion.div>
 </BuilderWorkspace>
}
function Field({id,label,missing,children}:{id:string;label:string;missing:boolean;children:React.ReactNode}){return <div><label htmlFor={id} className="builder-field-label mb-2 block font-semibold">{label} <span className="text-primary">*</span></label>{children}<InlineFieldMessage id={`${id}-error`} message={missing?`Add ${label.toLowerCase()} before continuing.`:undefined}/></div>}

/**
 * Android's version of Step 1 — asks for recipient/sender exactly once via
 * a saved-people picker instead of a plain text field every time (Phase 8,
 * Section G). Every later step reads data.basics.senderName/recipientName
 * unchanged, so nothing downstream needed to change.
 */
function NativeStepBasics({b,showErrors,complete,onUpdate,change}:{b:SurpriseBasics;showErrors:boolean;complete:boolean;onUpdate:(v:Partial<SurpriseBasics>)=>void;change:(field:keyof SurpriseBasics,value:string)=>void}){
 const [pickerOpen,setPickerOpen]=useState(false)
 const [editingSender,setEditingSender]=useState(false)
 useReviewField(id=>{if(id === "sender-name")setEditingSender(true)})
 const required=(value?:string)=>!value?.trim()

 const selectRecipient=(recipient:RecipientSelection)=>{
  onUpdate({
   recipientName:recipient.displayName,
   recipientId:recipient.id,
   recipientNickname:recipient.nickname,
   recipientRelationship:recipient.relationship,
  })
 }

 return <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
  <div>
   <h3 className="text-xl font-semibold">Who is this for?</h3>
   <p className="mt-1 text-sm text-muted-foreground">Add their name, your name, and a short opening note.</p>
  </div>

  <div>
   <label htmlFor="recipient-name" className="mb-1.5 block text-sm font-semibold">Their name <span className="text-primary">*</span></label>
   <button
    type="button"
    id="recipient-name"
    onClick={()=>setPickerOpen(true)}
    aria-invalid={showErrors&&required(b.recipientName)}
    data-invalid={showErrors&&required(b.recipientName) ? "true" : undefined}
    aria-describedby="native-recipient-error native-recipient-budget"
    className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-3 text-left"
   >
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
     <User className="h-4 w-4" aria-hidden="true"/>
    </span>
    <span className="min-w-0 flex-1 truncate font-medium">
     {b.recipientName?.trim()||'Add their name'}
    </span>
   </button>
   <TextBudget id="native-recipient-budget" value={b.recipientName} budget={TEXT_LIMITS.name} required />
   <InlineFieldMessage id="native-recipient-error" message={showErrors&&required(b.recipientName)?'Add their name before continuing.':undefined}/>
  </div>

  <div>
   <label htmlFor="sender-name" className="mb-1.5 block text-sm font-semibold">Your name <span className="text-primary">*</span></label>
   {editingSender?(
    <Input textBudget={TEXT_LIMITS.name} budgetRequired id="sender-name" autoFocus value={b.senderName||''} onChange={e=>change('senderName',e.target.value)} onBlur={()=>setEditingSender(false)} placeholder="The name they know you by" aria-invalid={showErrors&&required(b.senderName)} aria-describedby={showErrors&&required(b.senderName)?'native-sender-error':undefined}/>
   ):(
    <button
     type="button"
     id="sender-name"
     aria-describedby="native-sender-error"
     aria-invalid={showErrors&&required(b.senderName)}
     onClick={()=>setEditingSender(true)}
     aria-label={b.senderName?.trim()?`From ${b.senderName}. Edit sender name`:'Add your name'}
     className="flex min-h-14 w-full items-center rounded-xl border bg-secondary/30 px-3 py-2.5 text-left font-medium transition hover:border-primary/40 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
     {b.senderName?.trim()||'Add your name'}
    </button>
   )}
   <InlineFieldMessage id="native-sender-error" message={showErrors&&required(b.senderName)?'Add your name before continuing.':undefined}/>
  </div>

  <div>
   <label htmlFor="opening-message" className="mb-1.5 block text-sm font-semibold">Opening message <span className="text-primary">*</span></label>
   <p className="mb-2 text-sm text-muted-foreground">A short note they&apos;ll see first.</p>
   <Textarea textBudget={TEXT_LIMITS.opening} budgetRequired id="opening-message" rows={3} placeholder="I made this little surprise for you…" value={b.openingMessage||''} onChange={e=>change('openingMessage',e.target.value)} aria-invalid={showErrors&&required(b.openingMessage)} aria-describedby={showErrors&&required(b.openingMessage)?'native-opening-error':undefined}/>
   <InlineFieldMessage id="native-opening-error" message={showErrors&&required(b.openingMessage)?'Add an opening message before continuing.':undefined}/>
  </div>

  {complete&&<div role="status" className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm text-primary"><strong>Ready to continue.</strong></div>}

  <RecipientPicker open={pickerOpen} onClose={()=>setPickerOpen(false)} onSelect={selectRecipient}/>
 </motion.div>
}
