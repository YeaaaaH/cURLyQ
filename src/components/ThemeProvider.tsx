import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

export type ThemeName = "light" | "dark" | "terminal";

const THEME_STORAGE_KEY = "curlyq-theme";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Centralizes the theme value so any component (not just ThemeSwitcher) can
// read which palette is active — needed once a theme starts changing more
// than CSS custom properties (e.g. the terminal search box swapping its icon
// and placeholder text, which can't be expressed as a token). Persisted to
// localStorage so the chosen palette survives a reload.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = usePersistedState<ThemeName>(THEME_STORAGE_KEY, "light");

  // useLayoutEffect (not useEffect) so the class lands before the browser's
  // first paint — with useEffect, a persisted non-light theme flashes light
  // for one frame on load, since the effect only runs after that frame is
  // already painted.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("theme-terminal", theme === "terminal");
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
