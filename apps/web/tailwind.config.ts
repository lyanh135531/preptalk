import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#f5f7fb",
        surface: "#070b12",
        panel: "#101720",
        line: "#273447",
        cyan: {
          650: "#16a6c7"
        }
      },
      boxShadow: {
        soft: "0 18px 46px rgba(0, 0, 0, 0.38)"
      }
    }
  },
  plugins: []
} satisfies Config;
