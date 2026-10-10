import Link from 'next/link'
import { ResumeSurpriseLink } from '@/components/resume-surprise-link'
import { FloatingDecorations } from '@/components/floating-decorations'
import { Header } from '@/components/header'
import { LandingBenefits } from '@/components/landing-benefits'
import { LandingCTA } from '@/components/landing-cta'
import { LandingFeaturedTemplates } from '@/components/landing-featured-templates'
import { LandingHero } from '@/components/landing-hero'
import { LandingHowItWorks } from '@/components/landing-how-it-works'
import { SiteIntro } from '@/components/site-intro'
import { BrandLogo } from '@/components/brand'
import { SITE_LINKS } from '@/lib/site-links'

export function LandingPage() {
  return (
    <>
      <SiteIntro />
      <FloatingDecorations count={4} className="hidden lg:block" />
      <Header />
      <main>
        <LandingHero />
        <ResumeSurpriseLink />
        <LandingHowItWorks />
        <LandingFeaturedTemplates />
        <LandingBenefits />
        <LandingCTA />
      </main>
      <footer className="border-t bg-card/55 px-4 py-8 text-center text-sm text-muted-foreground backdrop-blur">
        <BrandLogo decorative className="mx-auto h-7 w-[8.75rem]" />
        <p className="mt-1">Create a little experience for someone you care about.</p>
        <div className="mt-3 flex justify-center gap-4">
          <Link href="/templates" className="hover:text-foreground">
            Templates
          </Link>
          <Link href="/#how-it-works" className="hover:text-foreground">
            How it works
          </Link>
        </div>
        <nav aria-label="More projects" className="landing-more-projects mx-auto mt-6 max-w-2xl border-t border-border/70 pt-5">
          <h2 className="text-sm font-semibold text-foreground">More Projects</h2>
          <ul className="mt-3 flex flex-wrap items-start justify-center gap-x-7 gap-y-4">
            {SITE_LINKS.projects.map((project) => (
              <li key={project.label}>
                {project.url ? (
                  <a className="landing-external-link inline-flex min-h-12 items-center font-medium text-foreground underline decoration-border underline-offset-4 hover:text-primary" href={project.url} target="_blank" rel="noopener noreferrer">{project.label}</a>
                ) : (
                  <span className="flex min-h-12 flex-col justify-center gap-1"><span className="font-medium text-foreground">{project.label}</span><span className="text-xs">Link coming soon</span></span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </>
  )
}
