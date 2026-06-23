import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  // Required so Next can resolve OG/Twitter images from relative paths without warnings.
  // Supports both local runs and hosted deployments (set NEXT_PUBLIC_SITE_URL when hosted).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL
      ?? "http://localhost:3000"
  ),
  title: 'Pokemon Emulator Tracker',
  description: 'Live emulator and save progress dashboard for Pokemon games',
  openGraph: {
    title: 'Pokemon Emulator Tracker',
    description: 'Live emulator and save progress dashboard for Pokemon games',
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
    description: 'Live emulator and save progress dashboard for Pokemon games',
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
