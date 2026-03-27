/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        bg: '#F8FAFC',
        bg2: '#F1F5F9',
        bg3: '#E2E8F0',
        card: '#FFFFFF',
        card2: '#F8FAFC',
        border: '#E2E8F0',
        border2: '#CBD5E1',
        accent: '#250099',
        accent2: '#ef0379',
        amber: '#F59E0B',
        danger: '#EF4444',
        hot: '#F97316',
        purple: '#6D28D9',
        txt: '#0F172A',
        txt2: '#334155',
        txt3: '#64748B',
      },

    },
  },
  plugins: [],
}
