import './globals.css'
import 'leaflet/dist/leaflet.css'
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0F2218',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://codespacebuckgrid.vercel.app'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BuckGrid Pro',
  },
  title: 'BuckGrid Pro — You Know Your Land. Tony Knows Deer.',
  description: 'Tell Tony what you\'re seeing — where deer are bedding, how they\'re moving, what\'s working. BuckGrid Pro puts a habitat consultant in your pocket. Get a tactical game plan built around your actual terrain.',
  keywords: ['deer habitat management', 'food plot planning', 'hunting land management', 'AI hunting app', 'satellite map hunting', 'whitetail habitat', 'deer stand placement', 'BuckGrid Pro'],
  openGraph: {
    title: 'BuckGrid Pro — Habitat Intelligence for Serious Hunters',
    description: 'You know your land. Tony knows deer. Tell Tony what you\'re seeing and get a tactical habitat game plan built around your property.',
    type: 'website',
    siteName: 'BuckGrid Pro',
    images: [{ url: '/buckgrid-logo.png', width: 1200, height: 630, alt: 'BuckGrid Pro' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BuckGrid Pro — Habitat Intelligence for Serious Hunters',
    description: 'Tell Tony what you\'re seeing. Get a tactical game plan built around your actual terrain. Start free.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/buckgrid-logo.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/buckgrid-logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Teko:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
