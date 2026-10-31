import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "rv-bg": "rgb(var(--rv-bg-rgb) / <alpha-value>)",
        "rv-bg-alt": "rgb(var(--rv-bg-alt-rgb) / <alpha-value>)",
        "rv-panel": "rgb(var(--rv-panel-rgb) / <alpha-value>)",
        "rv-cyan": "rgb(var(--rv-cyan-rgb) / <alpha-value>)",
        "rv-magenta": "rgb(var(--rv-magenta-rgb) / <alpha-value>)",
        "rv-cyan-dim": "rgb(var(--rv-cyan-dim-rgb) / <alpha-value>)",
        "rv-magenta-dim": "rgb(var(--rv-magenta-dim-rgb) / <alpha-value>)",
        "rv-text": "rgb(var(--rv-text-rgb) / <alpha-value>)",
        "rv-text-dim": "rgb(var(--rv-text-dim-rgb) / <alpha-value>)",
        "rv-border": "var(--rv-border)",
        "rv-success": "rgb(var(--rv-success-rgb) / <alpha-value>)",
        "rv-warning": "rgb(var(--rv-warning-rgb) / <alpha-value>)",
        "rv-danger": "rgb(var(--rv-danger-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-orbitron)", "sans-serif"],
        body: ["var(--font-plex)", "sans-serif"],
      },
      backgroundImage: {
        "hex-grid":
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'%3E%3Cpath d='M28 0L56 16.5V49.5L28 66L0 49.5V16.5Z' fill='none' stroke='%2300f0ff' stroke-opacity='0.06' stroke-width='1'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        "hud-glow": "0 0 8px rgba(0,240,255,0.4), 0 0 24px rgba(0,240,255,0.15)",
        "hud-glow-magenta": "0 0 8px rgba(255,46,166,0.4), 0 0 24px rgba(255,46,166,0.15)",
      },
      keyframes: {
        "hud-scan": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "hud-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "hud-scan": "hud-scan 3s linear infinite",
        "hud-pulse": "hud-pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;