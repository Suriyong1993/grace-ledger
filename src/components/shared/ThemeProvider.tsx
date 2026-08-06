/**
 * Grace Ledger v2 — ThemeProvider
 *
 * Manages light/dark mode with:
 * - System preference detection (prefers-color-scheme)
 * - localStorage persistence
 * - Manual toggle via setTheme()
 * - className-based theming (".dark" class on <html>)
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  /** Resolved theme (always "light" or "dark", never "system") */
  resolvedTheme: "light" | "dark";
  /** Stored preference (may be "system") */
  theme: Theme;
  /** Set theme preference */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
  /** Whether dark mode is currently active */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "grace-ledger-theme";

/**
 * Read stored theme, falling back to "system".
 */
function getStoredTheme(fallback: Theme): Theme {
  if (typeof window === "undefined") return fallback;
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? fallback;
}

/**
 * Resolve "system" to actual light/dark based on prefers-color-scheme.
 */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Apply theme className to <html> element.
 */
function applyTheme(resolved: "light" | "dark"): void {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Optional initial theme (default: "system") */
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = "system" }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // On mount: read stored preference and system preference
  useEffect(() => {
    const stored = getStoredTheme(defaultTheme);
    setThemeState(stored);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    mediaQuery.addEventListener("change", handleChange);
    setMounted(true);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [defaultTheme]);

  // Apply theme whenever stored theme or system preference changes
  useEffect(() => {
    const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
    applyTheme(resolved);
  }, [theme, systemDark]);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  // Avoid flash of wrong theme — render nothing until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider
      value={{
        resolvedTheme,
        theme,
        setTheme,
        toggleTheme,
        isDark: resolvedTheme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
