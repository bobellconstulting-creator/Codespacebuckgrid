import '@/globals.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BuckGrid Pro | Tactical Habitat Mapping',
  description: 'Elite Whitetail Habitat Planning & Consulting Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
