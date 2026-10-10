import { CatchTheHeartExperience } from '@/components/experiences/catch-the-heart-experience'
import { TemplateDemoShell } from '@/components/template-demo-shell'
import type { SurpriseData } from '@/lib/types'
import { demoPhoto } from '@/lib/demo-assets'

const demo: SurpriseData = {
  template: 'catch-the-heart',
  basics: { senderName: 'Someone special', recipientName: 'You', openingMessage: 'A few little pieces of my heart are floating your way.' },
  content: { hearts: [
    { id: 'h1', message: 'A favorite little memory.', photo: demoPhoto(1) },
    { id: 'h2', message: 'One more moment worth keeping.', photo: demoPhoto(2) },
    { id: 'h3', message: 'The kind of day I would choose again.', photo: demoPhoto(3) },
    { id: 'h4', message: 'Us, exactly as I want to remember it.', photo: demoPhoto(4) },
    { id: 'h5', message: 'A tiny piece of our story.', photo: demoPhoto(5) },
  ], finalMessage: 'You caught every piece. I love you more than these words can hold.', soundEffects: false },
  appearance: { theme: 'soft-rose', animationIntensity: 'normal' },
  delivery: { expiration: 'none' },
  delight: { coverEnabled: false, coverMessage: '', openingStyle: 'gentle-fade', passphraseEnabled: false, passphrase: '', closingMessage: 'Made with care.', signature: 'Someone special' },
}

export default function Page() {
  return <TemplateDemoShell data={demo}><CatchTheHeartExperience data={demo}/></TemplateDemoShell>
}
