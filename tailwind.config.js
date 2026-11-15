/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderWidth: {
        '3': '3px',
      },
      scale: {
        '98': '0.98',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-short': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out forwards',
        'bounce-short': 'bounce-short 0.6s ease-in-out infinite',
      },
      colors: {
        elder: {
          dark: '#0f172a',
          card: '#ffffff',
          cardMuted: '#f8fafc',
          border: '#e2e8f0',
          accent: '#0284c7',
          danger: '#e11d48',
          warning: '#d97706',
          success: '#059669',
          surface: '#f1f5f9'
        }
      }
    },
  },
  plugins: [],
}
