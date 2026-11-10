/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        payu: {
          50: '#F0FDF8',
          100: '#E1FAF0',
          200: '#B8F4DD',
          300: '#7FE8C3',
          400: '#34D399',
          500: '#00C48C',   // PayU Emerald / Green
          600: '#00A375',
          700: '#008271',   // PayU Teal
          800: '#005C51',
          900: '#00383D',   // PayU Signature Dark Teal
          950: '#002124',   // PayU Deep Forest Dark
        },
        brand: {
          dark: '#002225',      // PayU Sidebar Background
          darkHover: '#003136',
          teal: '#00383D',      // PayU Primary Brand Dark
          green: '#00C48C',     // PayU Standard Mint
          accent: '#00FE89',    // PayU Electric Lime/Mint Accent
          lime: '#A6C307',      // PayU Signature Lime
          surface: '#F5F7F8',   // PayU Soft Canvas Background
          border: '#E2E8F0',
        },
        tier: {
          0: '#00C48C',
          1: '#008271',
          2: '#F59E0B',
          3: '#EA580C',
          4: '#DC2626',
          5: '#002124',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
