import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

export type ThemeName = "light" | "dark" | "terminal";

const THEME_STORAGE_KEY = "curlyq-theme";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = usePersistedState<ThemeName>(THEME_STORAGE_KEY, "light");

  // useLayoutEffect: applied before first paint, so a dark theme doesn't flash light.
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
