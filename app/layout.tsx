import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  // Required so Next can resolve OG/Twitter images from relative paths without warnings.
  // Supports both local runs and hosted deployments (set NEXT_PUBLIC_SITE_URL when hosted).
  metadataBase: new URL(siteUrl),
  title: 'Pokemon Emulator Tracker',
  description: 'Track Pokemon Red, Blue, Yellow, Gold, Silver, Crystal, Ruby, Sapphire, Emerald, FireRed, and LeafGreen saves and live mGBA memory.',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Pokemon Emulator Tracker',
    title: 'Pokemon Emulator Tracker',
    description: 'Inspect Pokemon save files and track live mGBA memory across supported Gen 1-3 games.',
    images: [
      {
        url: '/pokemon-emulator-tracker-wallpaper.png',
        width: 1536,
        height: 1024,
        alt: 'Pokemon Emulator Tracker project artwork',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pokemon Emulator Tracker',
    description: 'Inspect Pokemon save files and track live mGBA memory across supported Gen 1-3 games.',
    images: ['/pokemon-emulator-tracker-wallpaper.png'],
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background" suppressHydrationWarning>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
