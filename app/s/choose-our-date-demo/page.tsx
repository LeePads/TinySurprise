'use client'
import { ChooseOurDateExperience } from '@/components/experiences/choose-our-date-experience'
import { TemplateDemoShell } from '@/components/template-demo-shell'
import { demoPhoto } from '@/lib/demo-assets'
import type { SurpriseData } from '@/lib/types'

const demo:SurpriseData={template:'choose-our-date',basics:{senderName:'Someone special',recipientName:'Love',openingMessage:'I planned a few little possibilities for us.'},content:{introMessage:'Follow your heart through two tiny choices.',rounds:[{id:'r1',question:'What mood should we chase?',options:[{id:'d1',title:'Slow and dreamy',details:'A sunset, a blanket, and nowhere else to be.',photo:demoPhoto(1)},{id:'d2',title:'Playful and bright',details:'A tiny adventure with a surprise around every corner.',photo:demoPhoto(2)}]},{id:'r2',question:'Choose our finishing touch',options:[{id:'d3',title:'Favorite snacks',details:'A picnic basket filled with your favorites.',photo:demoPhoto(3)},{id:'d4',title:'Cozy dessert',details:'Something sweet to share at the end.',photo:demoPhoto(4)}]}],result:{title:'Our perfect little date',description:'Your choices made something that feels perfectly us.',details:'I’ll plan the place and bring the treats.',invitation:'It’s a date. I can’t wait.'}},appearance:{theme:'peach-glow',animationIntensity:'normal'},delivery:{expiration:'none'}}

export default function Page(){return <TemplateDemoShell data={demo}><ChooseOurDateExperience data={demo}/></TemplateDemoShell>}
