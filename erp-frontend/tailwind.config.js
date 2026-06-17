/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sidebar: { DEFAULT: '#1e2a3a', hover: '#263346', active: '#2fc6f6' },
        primary: { DEFAULT: '#2fc6f6', dark: '#1baee0' },
        accent: { DEFAULT: '#f59e0b' },
        success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
