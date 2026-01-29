import '../src/globals.css'
import 'leaflet/dist/leaflet.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BuckGrid Pro — Elite Whitetail Habitat Intelligence',
  description: 'Professional-grade whitetail habitat mapping, audit, and management platform. Map your property. Plan your plots. Dominate the season.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
