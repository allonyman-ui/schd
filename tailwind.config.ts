import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        alex: '#93c5fd',      // blue-300
        itan: '#86efac',      // green-300
        ami: '#fda4af',       // rose-300
        danil: '#c4b5fd',     // violet-300
        assaf: '#fcd34d',     // amber-300
      },
    },
  },
  plugins: [],
}
export default config
