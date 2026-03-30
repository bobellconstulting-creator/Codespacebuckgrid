/** @type {import('tailwindcss').Config} */
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
        'neural-noir': {
          primary: '#0A0E17',
          secondary: '#1A1E29',
          accent: '#FF3E3E',
          text: '#E5E7EB',
          highlight: '#FF6B6B',
        },
        'field': {
          bg: '#080F07',
          panel: '#0D1A0B',
          card: '#111F0E',
          border: '#243020',
          accent: '#E8840A',
          orange: '#FF6B00',
          green: '#3A7D2B',
          text: '#D4C9A8',
          muted: '#7A8A68',
          dim: '#4A5A3A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'neural-gradient': 'linear-gradient(to right, #0A0E17, #1A1E29)',
      },
      boxShadow: {
        'neural-bold': '0 10px 30px -15px rgba(255, 62, 62, 0.5)',
      },
      borderRadius: {
        'neural': '12px',
      },
    },
  },
  plugins: [],
}
