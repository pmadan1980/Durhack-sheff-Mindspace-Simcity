import type { District } from "./simulation";

// Soft clay pigments. District UI accents still use the brighter simulation colors.
export const voicePalette = {
  A: { light: "#ffe6a2", clay: "#e5ae55", shade: "#a75c38", cheek: "#c77b4f" },
  C: { light: "#ffd3cd", clay: "#db8298", shade: "#a3486b", cheek: "#bf5976" },
  D: { light: "#d5edff", clay: "#82a9d7", shade: "#49608e", cheek: "#7690ba" },
  R: { light: "#e2f4cb", clay: "#9ec5a2", shade: "#547e70", cheek: "#7ca788" },
} satisfies Record<District, { light: string; clay: string; shade: string; cheek: string }>;
