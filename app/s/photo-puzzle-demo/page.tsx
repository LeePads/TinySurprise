
import { PhotoPuzzleExperience } from '@/components/experiences/photo-puzzle-experience'
import { TemplateDemoShell } from '@/components/template-demo-shell'
import { DEMO_PHOTO_PATHS } from '@/lib/demo-assets'
import type { SurpriseData } from '@/lib/types'

const base: SurpriseData = {
  template: 'photo-puzzle',
  basics: { senderName: 'Alex', recipientName: 'Jordan', occasion: 'birthday', openingMessage: 'I turned a few favorite moments into a puzzle for you.' },
  content: { photoUrl: DEMO_PHOTO_PATHS[0], difficulty: 'medium', completionMessage: 'You brought this memory back together!', finalMessage: 'Some moments are always worth keeping.' },
  appearance: { theme: 'soft-rose', animationIntensity: 'medium' },
  delivery: { expiration: 'none' },
}

export default function PhotoPuzzleDemoPage() {
  return <TemplateDemoShell data={base}><PhotoPuzzleExperience data={base}/></TemplateDemoShell>
}
