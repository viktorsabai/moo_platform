/** @type {import('tailwindcss').Config} */
module.exports = {
  // The app lets guests pick light/dark explicitly (stored in localStorage,
  // applied as the `dark` class on <html> — see the inline script in
  // src/app/layout.tsx). Without this, Tailwind's `dark:` variant defaults to
  // the `prefers-color-scheme` media query and ignores that in-app choice,
  // so a `dark:` utility can disagree with every CSS-var-driven color on the
  // same page whenever the OS theme differs from the user's chosen theme.
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
    },
  },
  plugins: [],
}




