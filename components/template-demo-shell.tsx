import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'
import { RecipientPreview } from './recipient-preview'
import { SiteMusicPreviewSlot } from './site-music'
import type { SurpriseData } from '@/lib/types'
import { TEMPLATES } from '@/lib/config'

export function TemplateDemoShell({ data, children }: { data: SurpriseData; children: React.ReactNode }) {
  return (
    <main className="template-demo-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-3 pb-2 pt-[calc(.5rem+env(safe-area-inset-top))] sm:px-6">
        <Button asChild variant="ghost" className="min-h-12">
          <Link href="/templates" aria-label="Back to templates"><ArrowLeft className="mr-2 h-4 w-4" />Templates</Link>
        </Button>
        {TEMPLATES[data.template]?.isAvailable && <Button asChild className="min-h-12"><Link href={`/create/${data.template}`}>Make my own</Link></Button>}
      </header>
      <SiteMusicPreviewSlot />
      <div className="recipient-preview-viewport min-h-0 flex-1 overflow-auto pb-[env(safe-area-inset-bottom)]">
        <div className="flex min-h-full flex-col [&>*]:min-h-0 [&>*]:flex-1">
          <RecipientPreview data={data} fillHeight presentationMode="viewport">{children}</RecipientPreview>
        </div>
      </div>
    </main>
  )
}
