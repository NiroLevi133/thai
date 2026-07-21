/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'Heebo', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      colors: {
        /* פלטה שנגזרת מהאיור עצמו — קרם, לבבות אפרסק, כוכבי זהב */
        sand: {
          50: '#fdf8ee',
          100: '#f9efdb',
          200: '#f0e0c0',
          300: '#e3cb9e',
        },
        jungle: {
          400: '#6f8f7a',
          500: '#4f6128',
          600: '#355e4a',
          700: '#2a4a3a',
        },
        coral: {
          200: '#fbd5d0',
          400: '#f2a0a0',
          500: '#e87f7f',
          600: '#c85f5f',
          700: '#a84a4a',
        },
        gold: {
          300: '#f0d9a0',
          400: '#e8c77a',
          500: '#d4a94f',
          600: '#96701f',
        },
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'none' } },
        /* אנימציות שובבות ועדינות — כולן מכובות ב-prefers-reduced-motion */
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(0.8)' }, '70%': { transform: 'scale(1.06)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        twinkle: { '0%,100%': { opacity: '0.35', transform: 'scale(0.9)' }, '50%': { opacity: '1', transform: 'scale(1.1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        float: 'float 4s ease-in-out infinite',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        twinkle: 'twinkle 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
