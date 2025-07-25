import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Background colors
        "background-primary": "var(--background-primary)",
        "background-secondary": "var(--background-secondary)",
        "background-tertiary": "var(--background-tertiary)",

        // Text colors
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",

        // Brand colors
        "brand-primary": "var(--brand-primary)",
        "brand-secondary": "var(--brand-secondary)",
        "brand-tertiary": "var(--brand-tertiary)",

        // Semantic colors
        success: "var(--success)",
        "success-light": "var(--success-light)",
        warning: "var(--warning)",
        "warning-light": "var(--warning-light)",
        error: "var(--error)",
        "error-light": "var(--error-light)",
        info: "var(--info)",
        "info-light": "var(--info-light)",

        // Provider colors
        "provider-openai": "var(--provider-openai)",
        "provider-google": "var(--provider-google)",
        "provider-anthropic": "var(--provider-anthropic)",
        "provider-xai": "var(--provider-xai)",
        "provider-deepseek": "var(--provider-deepseek)",

        // Component colors
        border: "var(--border)",
        "border-muted": "var(--border-muted)",
        "border-emphasis": "var(--border-emphasis)",
        ring: "var(--ring)",
        accent: "var(--accent)",

        // Mapped colors for compatibility
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Menlo", "Monaco", "Consolas", "monospace"],
      },

      borderRadius: {
        DEFAULT: "var(--radius)",
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
        "fade-out": "fade-out 0.15s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        "slide-out": "slide-out 0.2s ease-out",
        "pulse-subtle": "pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        "float-smooth": "float-smooth 6s ease-in-out infinite",
        "mesh-shift": "mesh-shift 20s ease-in-out infinite",
        "holographic-shift": "holographic-shift 8s ease infinite",
        wave: "wave 1.5s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 3s ease infinite",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "slide-in": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-out": {
          from: { transform: "translateY(0)", opacity: "1" },
          to: { transform: "translateY(-10px)", opacity: "0" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "float-smooth": {
          "0%, 100%": {
            transform: "translateY(0) translateZ(0) rotateX(0) rotateY(0)",
          },
          "33%": {
            transform:
              "translateY(-8px) translateZ(10px) rotateX(2deg) rotateY(-2deg)",
          },
          "66%": {
            transform:
              "translateY(-4px) translateZ(5px) rotateX(-1deg) rotateY(1deg)",
          },
        },
        "mesh-shift": {
          "0%, 100%": {
            backgroundPosition: "0% 0%, 100% 0%, 0% 50%, 100% 50%, 0% 100%",
          },
          "25%": {
            backgroundPosition: "50% 0%, 50% 0%, 50% 50%, 50% 50%, 50% 100%",
          },
          "50%": {
            backgroundPosition: "100% 0%, 0% 0%, 100% 50%, 0% 50%, 100% 100%",
          },
          "75%": {
            backgroundPosition: "50% 0%, 50% 0%, 50% 50%, 50% 50%, 50% 100%",
          },
        },
        "holographic-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        wave: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};

export default config;
