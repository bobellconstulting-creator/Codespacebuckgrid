import './globals.css'
import 'leaflet/dist/leaflet.css'
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0E1410',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://codespacebuckgrid.vercel.app'),
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BuckGrid Pro',
  },
  title: 'BuckGrid Pro — AI Habitat Intelligence for Serious Hunters',
  description: 'Tony AI analyzes your satellite map and tells you exactly where to place food plots, stands, and habitat features. Expert land management advice 24/7 — less than a tank of gas per month.',
  keywords: ['deer habitat management', 'food plot planning', 'hunting land management', 'AI hunting app', 'satellite map hunting', 'whitetail habitat', 'deer stand placement'],
  openGraph: {
    title: 'BuckGrid Pro — AI Habitat Intelligence',
    description: 'Satellite-grade habitat analysis powered by Tony AI. Know exactly where to plant, build, and hunt.',
    type: 'website',
    siteName: 'BuckGrid Pro',
    images: [{ url: '/buckgrid-logo.png', width: 1200, height: 630, alt: 'BuckGrid Pro' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BuckGrid Pro — AI Habitat Intelligence',
    description: 'Tony AI analyzes your land and tells you exactly what to do. Expert advice 24/7.',
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
          href="https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
