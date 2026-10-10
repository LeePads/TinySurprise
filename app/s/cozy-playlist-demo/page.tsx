import { CozyPlaylistExperience } from '@/components/experiences/cozy-playlist-experience'
import { TemplateDemoShell } from '@/components/template-demo-shell'
import { demoPhoto } from '@/lib/demo-assets'
import type { SurpriseData } from '@/lib/types'
const demo:SurpriseData={template:'cozy-playlist',basics:{senderName:'Me',recipientName:'You',openingMessage:'Three songs that feel a little like home.'},content:{tracks:[{id:'t1',title:'The first song',artist:'Our soundtrack',why:'For the beginning that still makes me smile.',photo:demoPhoto(3)},{id:'t2',title:'The rainy-day song',artist:'Our soundtrack',why:'For slow afternoons and nowhere else to be.',photo:demoPhoto(4)},{id:'t3',title:'The forever song',artist:'Our soundtrack',why:'For every lovely thing still ahead.',photo:demoPhoto(5)}],finalMessage:'Press play whenever you need a little piece of us.'},appearance:{theme:'peach-glow',animationIntensity:'normal'},delivery:{expiration:'none'}}
export default function Page(){return <TemplateDemoShell data={demo}><CozyPlaylistExperience data={demo}/></TemplateDemoShell>}
