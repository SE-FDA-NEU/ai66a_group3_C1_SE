import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

import { readTheme, THEME_STORAGE_KEY, type Theme } from "./themeStorage.ts";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); }
    catch { /* In-memory themes still work when browser storage is unavailable. */ }
  }, [theme]);
  const value = useMemo(() => ({ theme, toggle: () => setTheme(t => t === "dark" ? "light" : "dark") }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const value = useContext(ThemeContext);
  if (!value) return null;
  return <button type="button" className="theme-toggle button-secondary"
    aria-label={`Switch to ${value.theme === "dark" ? "light" : "dark"} theme`}
    onClick={value.toggle}>
    <span aria-hidden="true">{value.theme === "dark" ? "☀" : "☾"}</span>
    <span>{value.theme === "dark" ? "Light" : "Dark"}</span>
  </button>;
}
