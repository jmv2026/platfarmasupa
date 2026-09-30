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
        // Identidade Sermail: Verde Corporativo e Lima Vibrante
        "sermail-green": "#004d3d",
        "sermail-green-dark": "#00382b",
        "sermail-green-light": "#00634e",
        "sermail-lime": "#84cc16",
        "sermail-lime-vibrant": "#8ee000",
        "sermail-lime-light": "#f7fee7",
        "sermail-lime-border": "#a3e635",

        // Papeis Semânticos alinhados com a Identidade Sermail
        "primary": "#00382b",
        "primary-container": "#004d3d",
        "primary-fixed": "#e6f4ee",
        "primary-fixed-dim": "#a3d9c3",
        "on-primary": "#ffffff",
        "on-primary-container": "#dcfce7",

        "secondary": "#00684f",
        "secondary-container": "#dcfce7",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#004d3d",

        // Superfícies Límpidas e Arejadas (Adeus cinzentos escuros)
        "background": "#f8fafc",
        "surface": "#ffffff",
        "surface-bright": "#ffffff",
        "surface-dim": "#f1f5f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f8fafc",
        "surface-container": "#f1f5f9",
        "surface-container-high": "#e2e8f0",
        "surface-container-highest": "#cbd5e1",

        // Tipografia e Alto Contraste (Legibilidade WCAG AAA)
        "on-background": "#0f172a",
        "on-surface": "#0f172a",
        "on-surface-variant": "#334155",
        "outline": "#64748b",
        "outline-variant": "#e2e8f0",

        // Estados e Alertas
        "error": "#dc2626",
        "error-container": "#fef2f2",
        "on-error": "#ffffff",
        "on-error-container": "#991b1b"
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
