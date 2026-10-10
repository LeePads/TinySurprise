import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'
import { SiteMusic } from '@/components/site-music'
import { NativeAppShell } from '@/components/native-app-shell'
import { AndroidBottomNav } from '@/components/android-bottom-nav'
import { AndroidNavRail } from '@/components/android-nav-rail'
import { SITE_THEME_BOOTSTRAP } from '@/lib/site-theme'

export const metadata: Metadata = {
  metadataBase: new URL('https://tinysurprise.vercel.app'),
  title: { default: 'Tiny Surprise — A little experience for someone special', template: '%s | Tiny Surprise' },
  description: 'Create a little interactive experience with your messages and photos—privately in your browser, with no account or upload.',
  applicationName: 'Tiny Surprise',
  appleWebApp: { capable: true, title: 'Tiny Surprise', statusBarStyle: 'default' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Tiny Surprise',
    description: 'Create a little experience for someone special.',
    type: 'website',
    siteName: 'Tiny Surprise',
    images: [
      {
        url: '/icons/tiny-surprise-app-light-1024.png',
        width: 1024,
        height: 1024,
        alt: 'Tiny Surprise',
      },
    ],
  },
  icons: {
    icon: [{ url: '/icons/favicon-64.png', sizes: '64x64', type: 'image/png' }],
    shortcut: '/icons/favicon-64.png',
    apple: [
      {
        url: '/icons/tiny-surprise-app-light-1024.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F8F2EB' }, { media: '(prefers-color-scheme: dark)', color: '#282124' }],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SITE_THEME_BOOTSTRAP }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <NativeAppShell />
        <SiteMusic />
        <PwaRegister />
        <AndroidBottomNav />
        <AndroidNavRail />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
