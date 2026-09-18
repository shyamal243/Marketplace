import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Robotik View palette
        "rv-bg": "#0a0e17",
        "rv-bg-alt": "#0f1420",
        "rv-panel": "#131a2b",
        "rv-cyan": "#00f0ff",
        "rv-magenta": "#ff2ea6",
        "rv-cyan-dim": "#0891a3",
        "rv-magenta-dim": "#a3157a",
        "rv-text": "#e6f1ff",
        "rv-text-dim": "#8a99b3",
        "rv-border": "rgba(0, 240, 255, 0.25)",
        "rv-success": "#39ff88",
        "rv-warning": "#ffb84d",
        "rv-danger": "#ff4d6a",
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