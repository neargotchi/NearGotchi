export type Theme = "light" | "dark";

export const THEME_KEY = "neargotchi-theme";
/** Browser chrome colour: the scene colours of app/hero-header.css (--scene-color). */
export const THEME_COLORS: Record<Theme, string> = { light: "#fffaf0", dark: "#0a0a0a" };

/**
 * Runs in <head> before paint (app/layout.tsx): saved choice wins, else the system preference.
 * Sets data-theme on <html> and the browser chrome colour, so there is no flash of the wrong theme.
 */
export const themeInitScript = `(function(){try{var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="light"&&t!=="dark")t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)})}catch(e){}})();`;

export function readSavedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked (private mode etc.): the choice lasts for this page only
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}
