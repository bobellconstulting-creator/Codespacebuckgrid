import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BuckGrid Pro',
    short_name: 'BuckGrid',
    description:
      'AI habitat intelligence for serious hunters. Tony AI analyzes your satellite map and tells you exactly where to place food plots, stands, and habitat features.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0E1410',
    theme_color: '#0E1410',
    categories: ['lifestyle', 'utilities', 'navigation'],
    icons: [
      {
        src: '/buckgrid-logo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
