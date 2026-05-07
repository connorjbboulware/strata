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
        surface: 'var(--bg)',
        panel: 'var(--bg-elevated)',
        rule: 'var(--border)',
        ink: {
          DEFAULT: 'var(--text-primary)',
          muted: 'var(--text-secondary)',
          faint: 'var(--text-tertiary)',
        },
        accent: 'var(--accent)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
      },
    },
  },
  plugins: [],
};

export default config;
