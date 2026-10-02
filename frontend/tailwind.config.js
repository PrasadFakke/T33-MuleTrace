/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#f8fafc',
          900: '#ffffff',
          850: '#f1f5f9',
          800: '#e2e8f0',
          700: '#cbd5e1',
          600: '#94a3b8',
        },
        brand: {
          blue: '#2563eb',
          royal: '#1d4ed8',
          sky: '#0284c7',
          cyan: '#0ea5e9',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#ef4444',
          indigo: '#6366f1',
          violet: '#8b5cf6'
        }
      },
      boxShadow: {
        'glow-blue': '0 0 24px -2px rgba(37, 99, 235, 0.3)',
        'glow-cyan': '0 0 24px -2px rgba(14, 165, 233, 0.3)',
        'glow-rose': '0 0 24px -2px rgba(239, 68, 68, 0.3)',
        'glow-amber': '0 0 24px -2px rgba(245, 158, 11, 0.3)',
        'glow-emerald': '0 0 24px -2px rgba(16, 185, 129, 0.3)',
        'card': '0 2px 10px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 12px 30px -4px rgba(37, 99, 235, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
      },
      fontFamily: {
        mono: ['"Times New Roman"', 'Times', 'serif'],
        sans: ['"Times New Roman"', 'Times', 'serif'],
        serif: ['"Times New Roman"', 'Times', 'serif'],
      }
    },
  },
  plugins: [],
}
