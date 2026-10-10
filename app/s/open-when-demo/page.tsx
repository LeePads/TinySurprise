import { OpenWhenExperience } from '@/components/experiences/open-when-experience'
import { TemplateDemoShell } from '@/components/template-demo-shell'
import { demoPhoto } from '@/lib/demo-assets'
import type { SurpriseData } from '@/lib/types'

const demo:SurpriseData={template:'open-when',basics:{senderName:'Someone special',recipientName:'You',openingMessage:'A few little notes and memories for whenever you need them.'},content:{envelopes:[{id:'e1',title:'Open when you miss me',message:'Keep this memory close until we make another one.',photo:demoPhoto(1)},{id:'e2',title:'Open when you need a smile',message:'Here is a moment that still makes me happy.',photo:demoPhoto(2)},{id:'e3',title:'Open when today feels heavy',message:'You are loved more than you know.',photo:demoPhoto(3)},{id:'e4',title:'Open when you need courage',message:'I will always be cheering for you.',photo:demoPhoto(4)}],finalMessage:'Every note leads back to the same thing: I’m here for you.'},appearance:{theme:'soft-rose',animationIntensity:'normal'},delivery:{expiration:'none'}}

export default function Page(){return <TemplateDemoShell data={demo}><OpenWhenExperience data={demo}/></TemplateDemoShell>}
