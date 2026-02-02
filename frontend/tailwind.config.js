export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'color-mix(in srgb, var(--color-primary) 10%, white 90%)',
          100: 'color-mix(in srgb, var(--color-primary) 20%, white 80%)',
          200: 'color-mix(in srgb, var(--color-primary) 30%, white 70%)',
          300: 'color-mix(in srgb, var(--color-primary) 50%, white 50%)',
          400: 'color-mix(in srgb, var(--color-primary) 70%, white 30%)',
          500: 'color-mix(in srgb, var(--color-primary) 85%, white 15%)',
          600: 'var(--color-primary)',
          700: 'color-mix(in srgb, var(--color-primary) 85%, black 15%)',
          800: 'color-mix(in srgb, var(--color-primary) 70%, black 30%)',
          900: 'color-mix(in srgb, var(--color-primary) 50%, black 50%)',
        },
        secondary: {
          500: 'var(--color-secondary)',
          600: 'color-mix(in srgb, var(--color-secondary) 85%, black 15%)',
        }
      }
    },
  },
  plugins: [],
};
