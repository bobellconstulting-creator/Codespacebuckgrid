/** @type {import('tailwindcss').Config} */
// BuckGrid Pro — Tactical Heritage
// Tokens live in app/globals.css under @theme (Tailwind v4).
// This file just declares content paths and a few legacy aliases
// so older components that reference `field.*` keep compiling.
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:    '#0E1410',
        'ink-2':'#161C17',
        'ink-3':'#1F2620',
        bone:   '#F5F1E8',
        'bone-2':'#E8E2D2',
        moss:   '#3D5141',
        olive:  '#6B7A4F',
        stone:  '#8B8678',
        brass:  '#B8923A',
        copper: '#B86B3A',
        blood:  '#7A1F1F',
        // Legacy aliases — keep old `field.*` callsites compiling
        field: {
          bg:     '#0E1410',
          panel:  '#161C17',
          card:   '#1F2620',
          border: 'rgba(184,146,58,0.25)',
          accent: '#B8923A',
          orange: '#B86B3A',
          green:  '#3D5141',
          text:   '#F5E1E8',
          muted:  '#8B8678',
          dim:    '#6B7A4F',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Stardos Stencil"', 'Impact', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
