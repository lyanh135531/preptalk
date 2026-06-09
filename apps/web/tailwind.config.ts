import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["'Outfit'", "sans-serif"],
      },
      colors: {
        ink: "#f5f7fb",
        surface: "#070b12",
        panel: "#101720",
        line: "#273447",
        cyan: {
          650: "#16a6c7",
          500: "#06b6d4",
          400: "#22d3ee",
          300: "#67e8f9",
          200: "#a5f3fc",
          100: "#cffafe",
        }
      },
      boxShadow: {
        soft: "0 18px 46px rgba(0, 0, 0, 0.38)",
        glow: "0 0 20px rgba(22, 166, 199, 0.25)",
        "glow-lg": "0 0 40px rgba(22, 166, 199, 0.35), 0 0 80px rgba(22, 166, 199, 0.15)",
        "glow-sm": "0 0 12px rgba(22, 166, 199, 0.2)",
      },
    }
  },
  plugins: []
} satisfies Config;
