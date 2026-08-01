import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "light" | "dark" | "terminal";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Centralizes the theme value so any component (not just ThemeSwitcher) can
// read which palette is active — needed once a theme starts changing more
// than CSS custom properties (e.g. the terminal search box swapping its icon
// and placeholder text, which can't be expressed as a token). Not persisted
// yet — resets to "light" on reload.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
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
