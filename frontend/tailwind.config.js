/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        void: "#080810",
        surface: "#0f0f1a",
        panel: "#141428",
        border: "#1e1e38",
        accent: {
          DEFAULT: "#7c3aed",   // violet-600
          light: "#a78bfa",     // violet-400
          glow: "#5b21b6",
        },
        neon: {
          pink: "#f472b6",
          cyan: "#22d3ee",
          lime: "#a3e635",
        },
        muted: "#64648a",
        text: {
          primary: "#e2e2f0",
          secondary: "#9898b8",
          ghost: "#4a4a6a",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "noise": "url('/noise.svg')",
      },
      boxShadow: {
        "glow-violet": "0 0 30px rgba(124, 58, 237, 0.35)",
        "glow-pink": "0 0 20px rgba(244, 114, 182, 0.3)",
        "glow-cyan": "0 0 20px rgba(34, 211, 238, 0.3)",
        "card": "0 4px 40px rgba(0,0,0,0.6)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "wave": "wave 1.2s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};
