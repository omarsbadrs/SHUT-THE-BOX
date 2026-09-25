/**
 * App colour themes. Each theme sets the page background, the table felt and
 * the panel colour; game-specific surfaces (wood, chalkboard, lapis) stay.
 * Shared by the server layout (first paint) and the client picker.
 */

export const THEME_COOKIE = "s10_theme";

export interface AppTheme {
  id: string;
  /** Page background. */
  night: string;
  night2: string;
  glowTop: string;
  glowBottom: string;
  /** Felt table: highlight, base, edge. */
  feltHi: string;
  felt: string;
  feltDark: string;
  /** Sheets & panels. */
  panel: string;
}

export const THEMES: AppTheme[] = [
  { id: "emerald", night: "#07120d", night2: "#0d1f17", glowTop: "#1d4a33", glowBottom: "#12301f", feltHi: "#1f7a50", felt: "#17603f", feltDark: "#0f432c", panel: "#10231a" },
  { id: "mint", night: "#061413", night2: "#0b211f", glowTop: "#1f5a52", glowBottom: "#103a33", feltHi: "#3fb89a", felt: "#23967c", feltDark: "#136a56", panel: "#0f2724" },
  { id: "violet", night: "#0d0818", night2: "#160e28", glowTop: "#3b2266", glowBottom: "#22143f", feltHi: "#7b4fd0", felt: "#5c35ad", feltDark: "#3c2178", panel: "#1a1030" },
  { id: "crimson", night: "#140608", night2: "#210b0f", glowTop: "#5a1a22", glowBottom: "#3a0f15", feltHi: "#c0392f", felt: "#972a26", feltDark: "#661a1a", panel: "#2a0d11" },
  { id: "sunshine", night: "#141004", night2: "#211a08", glowTop: "#5a4610", glowBottom: "#3a2c08", feltHi: "#c9981f", felt: "#a07a14", feltDark: "#6e530b", panel: "#2a2008" },
  { id: "ocean", night: "#050d18", night2: "#0a1728", glowTop: "#173a66", glowBottom: "#0d2546", feltHi: "#2f78d0", felt: "#1f5aa8", feltDark: "#133c78", panel: "#0c1a30" },
  { id: "rose", night: "#16070f", night2: "#240c19", glowTop: "#5c1f40", glowBottom: "#3a1128", feltHi: "#d0508a", felt: "#a8356b", feltDark: "#74214a", panel: "#2a0d1c" },
  { id: "midnight", night: "#050507", night2: "#0d0d12", glowTop: "#23232e", glowBottom: "#15151c", feltHi: "#44445a", felt: "#30303f", feltDark: "#1c1c26", panel: "#16161d" },
];

export const DEFAULT_THEME = THEMES[0];

export function themeById(id: string | null | undefined): AppTheme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

/** CSS custom properties for a theme (applied on <html>). */
export function themeVars(t: AppTheme): Record<string, string> {
  return {
    "--color-night": t.night,
    "--color-night-2": t.night2,
    "--color-felt": t.felt,
    "--color-felt-dark": t.feltDark,
    "--felt-hi": t.feltHi,
    "--glow-top": t.glowTop,
    "--glow-bottom": t.glowBottom,
    "--panel": t.panel,
  };
}
