import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ---- Monochrome surface system ----
        void: "#050505", // primary background
        surface: "#0B0B0C", // secondary background
        card: "#121315", // card / panel base
        graphite: "#1A1B1D", // slightly raised surface (hover states, dividers)

        // ---- Text ----
        fog: "#DADADA", // secondary text
        muted: "#8E8E8E", // muted / tertiary text
        accent: "#F5F5F5", // near-white accent, used sparingly for emphasis
      },
      fontFamily: {
        display: ["\"Cormorant Garamond\"", "serif"],
        body: ["\"Inter\"", "sans-serif"],
        mono: ["\"JetBrains Mono\"", "monospace"],
      },
      letterSpacing: {
        wide2: "0.08em",
        widest2: "0.28em",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        card: "24px",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(255,255,255,0.18)",
        "glow-sm": "0 0 24px -6px rgba(255,255,255,0.14)",
        panel: "0 20px 60px -20px rgba(0,0,0,0.6)",
      },
      keyframes: {
        drift: {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "10%": { opacity: "0.35" },
          "90%": { opacity: "0.15" },
          "100%": { transform: "translateY(-120vh) translateX(14px)", opacity: "0" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
      },
      animation: {
        drift: "drift 18s linear infinite",
        "pulse-slow": "pulse-slow 10s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
