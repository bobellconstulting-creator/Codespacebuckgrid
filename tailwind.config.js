/** @type {import('tailwindcss').Config} */
// WildLogic v2 — Design Token Config
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1E2122',
          900: '#111415',
          800: '#1E2122',
          700: '#2E3335',
          600: '#3A4042',
        },
        bone: {
          DEFAULT: '#D8D3C5',
          900: '#D8D3C5',
          800: '#C8C3B5',
          700: '#A8A39A',
          600: '#8A8580',
        },
        moss: {
          DEFAULT: '#7A8F62',
          900: '#4A5A3A',
          800: '#5A6E48',
          700: '#6B7A57',
          600: '#7A8F62',
          500: '#8BAA72',
          400: '#9BBC82',
        },
        brass: {
          DEFAULT: '#B8923A',
          900: '#8A6A28',
          800: '#A07830',
          700: '#B8923A',
          600: '#C8A24A',
          500: '#D8B25A',
        },
        terra: '#C47B3C',
      },
      fontFamily: {
        display: ['Teko', 'Oswald', 'sans-serif'],
        mono: ['Share Tech Mono', 'monospace'],
        body: ['Inter', 'Barlow Condensed', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
