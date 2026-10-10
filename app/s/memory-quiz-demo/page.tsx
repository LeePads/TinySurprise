'use client'
import { MemoryQuizExperience } from '@/components/experiences/memory-quiz-experience'
import { TemplateDemoShell } from '@/components/template-demo-shell'
import { demoPhoto } from '@/lib/demo-assets'
import type { SurpriseData } from '@/lib/types'
const demo:SurpriseData={template:'memory-quiz',basics:{senderName:'Someone special',recipientName:'You',openingMessage:'Let’s see which tiny moments stayed with us.'},content:{questions:[{id:'q1',prompt:'What always makes our conversations last longer?',answers:['One more story','Checking the time','Being sensible'],correctIndex:0,memoryNote:'There is somehow always one more story.',photo:demoPhoto(1)},{id:'q2',prompt:'What is our unofficial comfort food?',answers:['Something fancy','Fries to share','Plain toast'],correctIndex:1,memoryNote:'The best bites are always stolen from your plate.',photo:demoPhoto(2)},{id:'q3',prompt:'What should we make more of?',answers:['Plans','Memories','Excuses'],correctIndex:1,memoryNote:'Definitely memories—and a few wonderfully unnecessary photos.',photo:demoPhoto(3)}],finalMessage:'You remembered enough to prove what I already knew: our little moments matter.'},appearance:{theme:'lavender-dream',animationIntensity:'normal'},delivery:{expiration:'none'}}
export default function Page(){return <TemplateDemoShell data={demo}><MemoryQuizExperience data={demo}/></TemplateDemoShell>}
