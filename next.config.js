/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://services.arcgisonline.com https://*.arcgisonline.com https://*.tile.openstreetmap.org",
      "connect-src 'self' https://api.open-meteo.com https://overpass-api.de https://nominatim.openstreetmap.org https://api.anthropic.com https://api.openai.com https://integrate.api.nvidia.com https://generativelanguage.googleapis.com https://services.arcgisonline.com https://epqs.nationalmap.gov https://nassgeodata.gmu.edu https://www.fws.gov",
      "frame-ancestors 'self'",
    ].join('; ')
  },
]

const nextConfig = {
  images: {
    unoptimized: true
  },
  webpack(config) {
    // @turf/buffer uses d3-geo's ESM index which references ./src/* not present in the npm build.
    // Alias to the CJS bundle so webpack resolves cleanly.
    config.resolve.alias = {
      ...config.resolve.alias,
      'd3-geo': require.resolve('d3-geo/build/d3-geo.js'),
    }
    return config
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  }
}

module.exports = nextConfig
