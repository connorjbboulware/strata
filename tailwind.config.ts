import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-instrument-serif)', 'ui-serif', 'serif'],
        sans: ['var(--font-geist)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // RGB-triplet form so Tailwind's opacity modifiers (bg-accent/10) work.
        // Hex equivalents in :root remain available for direct CSS usage.
        surface: 'rgb(var(--bg-rgb) / <alpha-value>)',
        panel: 'rgb(var(--bg-elevated-rgb) / <alpha-value>)',
        rule: 'rgb(var(--border-rgb) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          faint: 'rgb(var(--text-tertiary-rgb) / <alpha-value>)',
        },
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        positive: 'rgb(var(--positive-rgb) / <alpha-value>)',
        negative: 'rgb(var(--negative-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

export default config;
