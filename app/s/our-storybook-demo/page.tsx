import { OurStorybookExperience } from '@/components/experiences/storybook-experience'
import { TemplateDemoShell } from '@/components/template-demo-shell'
import { demoPhoto } from '@/lib/demo-assets'
import type { SurpriseData } from '@/lib/types'
const demo:SurpriseData={template:'our-storybook',basics:{senderName:'Me',recipientName:'You',openingMessage:'A few favorite pages from our story.'},content:{pages:[{id:'p1',title:'The hello',body:'One small hello became a chapter I never wanted to end.',photo:demoPhoto(1)},{id:'p2',title:'The laughter',body:'Then came all the ordinary moments that somehow became my favorites.',photo:demoPhoto(2)},{id:'p3',title:'The next page',body:'The best part is knowing there are still blank pages waiting for us.',photo:demoPhoto(3)}],finalMessage:'To be continued—with so much love.'},appearance:{theme:'soft-rose',animationIntensity:'normal'},delivery:{expiration:'none'}}
export default function Page(){return <TemplateDemoShell data={demo}><OurStorybookExperience data={demo}/></TemplateDemoShell>}
