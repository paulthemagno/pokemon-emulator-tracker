import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
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
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
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
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-background">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
