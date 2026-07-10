import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // CryptoX accent palette — "yellow" kept as the token name so every
        // existing text-yellow / bg-yellow class picks up the new accent.
        yellow: {
          DEFAULT: "#ff3c02",
          50: "rgba(255, 60, 2, 0.08)",
          100: "rgba(255, 60, 2, 0.15)",
          200: "rgba(255, 60, 2, 0.35)",
          300: "#ffba86",
          400: "#fa7041",
          500: "#ff3c02",
          600: "#f45b31",
          700: "#fa7041",
          800: "#ffba86",
          900: "#ffd9c2",
        },
        amber: {
          200: "#ffd9c2",
          300: "#ffba86",
          400: "#fa7041",
          500: "#f45b31",
          600: "#ff3c02",
          700: "#ffba86",
          800: "#ffd9c2",
        },
        ink: {
          DEFAULT: "#0a0a0b",
          soft: "#141414",
          card: "#1c1d23",
          raise: "#1f1f1f",
        },
      },
      fontFamily: {
        sans: ["Inter Tight", "Manrope", "Helvetica", "Arial", "sans-serif"],
        serif: ["Inter Tight", "Manrope", "sans-serif"],
      },
    },
  },
  plugins: [typography],
};
