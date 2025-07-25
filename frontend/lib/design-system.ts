/**
 * Design System Configuration
 *
 * Central configuration for all design tokens including colors, typography,
 * spacing, animations, and more.
 */

export const designSystem = {
  // Color Palette - Dark Mode First
  colors: {
    // Base colors
    background: {
      primary: "#0D1117", // Main background
      secondary: "#161B22", // Cards, elevated surfaces
      tertiary: "#21262D", // Hover states
      inverse: "#FFFFFF", // Inverse for light elements
    },

    // Text colors
    text: {
      primary: "#E6EDF3", // Main text
      secondary: "#8B949E", // Muted text
      tertiary: "#6E7681", // Very muted
      inverse: "#0D1117", // Dark text on light bg
    },

    // Border colors
    border: {
      default: "#30363D", // Default borders
      muted: "#21262D", // Subtle borders
      emphasis: "#6E7681", // Emphasized borders
    },

    // Brand colors
    brand: {
      primary: "#2F81F7", // Primary brand blue
      secondary: "#1F6FEB", // Darker blue for hover
      tertiary: "#388BFD", // Lighter blue
    },

    // Semantic colors
    semantic: {
      success: "#238636",
      successLight: "#2EA043",
      successDark: "#196C2E",

      warning: "#9E6A03",
      warningLight: "#D29922",
      warningDark: "#7D4E00",

      error: "#DA3633",
      errorLight: "#F85149",
      errorDark: "#B62324",

      info: "#2F81F7",
      infoLight: "#58A6FF",
      infoDark: "#1F6FEB",
    },

    // AI Provider colors
    providers: {
      openai: "#10B981", // Emerald
      google: "#3B82F6", // Blue
      anthropic: "#F97316", // Orange
      xai: "#A855F7", // Purple
      deepseek: "#EF4444", // Red
    },

    // Overlay colors
    overlay: {
      backdrop: "rgba(1, 4, 9, 0.8)",
      light: "rgba(255, 255, 255, 0.1)",
      dark: "rgba(0, 0, 0, 0.5)",
    },
  },

  // Typography
  typography: {
    // Font families
    fonts: {
      sans: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    },

    // Font sizes
    sizes: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      "2xl": "1.5rem", // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem", // 36px
      "5xl": "3rem", // 48px
    },

    // Line heights
    lineHeights: {
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
      loose: "2",
    },

    // Font weights
    weights: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  // Spacing scale
  spacing: {
    0: "0",
    1: "0.25rem", // 4px
    2: "0.5rem", // 8px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    8: "2rem", // 32px
    10: "2.5rem", // 40px
    12: "3rem", // 48px
    16: "4rem", // 64px
    20: "5rem", // 80px
    24: "6rem", // 96px
  },

  // Border radius
  radius: {
    none: "0",
    sm: "0.125rem", // 2px
    base: "0.25rem", // 4px
    md: "0.375rem", // 6px
    lg: "0.5rem", // 8px
    xl: "0.75rem", // 12px
    "2xl": "1rem", // 16px
    full: "9999px",
  },

  // Shadows
  shadows: {
    none: "none",
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  },

  // Animations
  animations: {
    // Durations
    durations: {
      fast: "150ms",
      base: "200ms",
      slow: "300ms",
      slower: "500ms",
    },

    // Easings
    easings: {
      ease: "cubic-bezier(0.4, 0, 0.2, 1)",
      easeIn: "cubic-bezier(0.4, 0, 1, 1)",
      easeOut: "cubic-bezier(0, 0, 0.2, 1)",
      easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
  },

  // Breakpoints
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  // Z-index scale
  zIndex: {
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
} as const;

// Type exports
export type DesignSystem = typeof designSystem;
export type ColorScheme = keyof typeof designSystem.colors;
export type ColorValue = string;

// Helper functions
export const getColor = (path: string): string => {
  const keys = path.split(".");
  let value: unknown = designSystem.colors;

  for (const key of keys) {
    if (typeof value === "object" && value !== null && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return "";
    }
  }

  return typeof value === "string" ? value : "";
};

export const getSpacing = (key: keyof typeof designSystem.spacing): string => {
  return designSystem.spacing[key];
};

export const getFontSize = (
  key: keyof typeof designSystem.typography.sizes,
): string => {
  return designSystem.typography.sizes[key];
};
