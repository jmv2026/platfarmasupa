import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-secondary": "#ffffff",
        "tertiary-fixed-dim": "#f8b6b6",
        "surface-dim": "#d9dadb",
        "on-tertiary-fixed-variant": "#68393b",
        "on-secondary-fixed-variant": "#00513d",
        "secondary-fixed-dim": "#73d9b5",
        "inverse-primary": "#a2d1b7",
        "on-error": "#ffffff",
        "surface-container-highest": "#e1e3e4",
        "on-secondary-container": "#007257",
        "on-primary-container": "#6f9c84",
        "surface-container-high": "#e7e8e9",
        "outline": "#717973",
        "on-background": "#191c1d",
        "surface-tint": "#3b6751",
        "on-tertiary-container": "#be8283",
        "primary": "#001b0f",
        "secondary-container": "#8ff6d0",
        "primary-fixed-dim": "#a2d1b7",
        "tertiary": "#2d0a0d",
        "surface-container-lowest": "#ffffff",
        "background": "#f8f9fa",
        "primary-fixed": "#bdedd2",
        "on-surface-variant": "#414943",
        "on-primary": "#ffffff",
        "outline-variant": "#c1c8c2",
        "on-primary-fixed-variant": "#234f3b",
        "surface-variant": "#e1e3e4",
        "primary-container": "#013220",
        "on-error-container": "#93000a",
        "inverse-surface": "#2e3132",
        "surface-container": "#edeeef",
        "tertiary-fixed": "#ffdad9",
        "inverse-on-surface": "#f0f1f2",
        "secondary-fixed": "#8ff6d0",
        "secondary": "#006c52",
        "on-tertiary-fixed": "#340f12",
        "on-surface": "#191c1d",
        "on-primary-fixed": "#002113",
        "tertiary-container": "#471e20",
        "surface-container-low": "#f3f4f5",
        "on-tertiary": "#ffffff",
        "on-secondary-fixed": "#002117",
        "surface-bright": "#f8f9fa",
        "surface": "#f8f9fa",
        "error": "#ba1a1a",
        "error-container": "#ffdad6"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      },
      fontFamily: {
        headline: ["var(--font-manrope)", "Manrope", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "sans-serif"],
        label: ["var(--font-inter)", "Inter", "sans-serif"]
      }
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ],
};

export default config;
