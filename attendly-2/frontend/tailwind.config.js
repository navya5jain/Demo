/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#1e293b',
          900: '#0f172a',
          950: '#090d16',
        },
        brand: {
          purple: '#7c3aed',
          purpleDark: '#6d28d9',
          purpleLight: '#ede9fe',
        }
      }
    },
  },
  plugins: [],
}
