export const THEME_STORAGE_KEY = "cineai-theme";
export type Theme = "dark" | "light";

export function readTheme(): Theme {
  try { return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}
