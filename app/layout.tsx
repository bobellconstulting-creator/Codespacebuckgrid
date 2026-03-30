import './globals.css'
import 'leaflet/dist/leaflet.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BuckGrid Pro — AI Habitat Consultant for Serious Hunters',
  description: 'Tony analyzes your satellite map and tells you exactly where to put food plots, bedding, and stands. Expert habitat advice for your specific land — 24/7, no consultant fees.',
  openGraph: {
    title: 'BuckGrid Pro — Your Land\'s AI Habitat Consultant',
    description: 'Stop guessing. Tony sees your land via satellite and draws your habitat plan in under a minute.',
    type: 'website',
    url: 'https://codespacebuckgrid.vercel.app',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;600;700;800&family=Roboto+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
