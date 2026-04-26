import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        bg: "#FAFAFA",
        surface: "#FFFFFF",
        "surface-2": "#F5F5F7",
        border: "#D1D1D6",
        "border-soft": "#E5E5EA",
        text: "#1D1D1F",
        "text-secondary": "#6E6E73",
        "text-tertiary": "#8E8E93",
        mint: {
          DEFAULT: "#5AD2C7",
          bright: "#4ECDC4",
          deep: "#00B5A8",
          soft: "#DAF2EE",
          tint: "#ECFAF6",
        },
        danger: "#FF3B30",
        success: "#34C759",
        divider: "#E5E5EA",
      },
      borderRadius: {
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
