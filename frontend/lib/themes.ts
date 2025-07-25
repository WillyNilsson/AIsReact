export const themes = {
  midnight: {
    name: "Midnight",
    primary: "#1a1b26",
    secondary: "#24283b",
    accent: "#7aa2f7",
    gradient: "from-indigo-500 to-purple-500",
  },
  aurora: {
    name: "Aurora",
    primary: "#0f172a",
    secondary: "#1e293b",
    accent: "#38bdf8",
    gradient: "from-cyan-400 via-blue-500 to-purple-600",
  },
  cosmic: {
    name: "Cosmic",
    primary: "#0a0a0a",
    secondary: "#1a1a1a",
    accent: "#c084fc",
    gradient: "from-purple-400 via-pink-500 to-red-500",
  },
  matrix: {
    name: "Matrix",
    primary: "#0d1117",
    secondary: "#161b22",
    accent: "#58a6ff",
    gradient: "from-green-400 to-blue-500",
  },
} as const;

export type ThemeName = keyof typeof themes;
