export const SITE_THEME_STORAGE_KEY = "tinysurprise-theme";

export const SITE_THEME_VALUES = [
  "warm-paper",
  "evening-cocoa",
  "follow-device",
] as const;

export type SiteTheme = (typeof SITE_THEME_VALUES)[number];

const LEGACY_THEME_MAP: Record<string, SiteTheme> = {
  honey: "warm-paper",
  light: "warm-paper",
  cocoa: "evening-cocoa",
  dark: "evening-cocoa",
  midnight: "evening-cocoa",
  forest: "evening-cocoa",
  candy: "warm-paper",
  cotton: "warm-paper",
  doodle: "warm-paper",
  pixel: "warm-paper",
  system: "follow-device",
  "warm-paper": "warm-paper",
  "evening-cocoa": "evening-cocoa",
  "follow-device": "follow-device",
};

export function normalizeSiteTheme(value: string | null): SiteTheme {
  return value ? LEGACY_THEME_MAP[value] ?? "follow-device" : "follow-device";
}

export function readSiteTheme(): SiteTheme {
  if (typeof window === "undefined") return "follow-device";
  try {
    const stored = window.localStorage.getItem(SITE_THEME_STORAGE_KEY);
    const normalized = normalizeSiteTheme(stored);
    if (stored !== normalized) {
      window.localStorage.setItem(SITE_THEME_STORAGE_KEY, normalized);
    }
    return normalized;
  } catch {
    return "follow-device";
  }
}

export function applySiteTheme(theme: SiteTheme, persist = true): void {
  if (typeof document === "undefined") return;
  const dark =
    theme === "evening-cocoa" ||
    (theme === "follow-device" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.dataset.siteTheme = theme;
  root.style.colorScheme = dark ? "dark" : "light";
  if (!persist) return;
  try {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies for this page when storage is blocked.
  }
}

// Runs before React hydrates so a stored theme never flashes or falls back.
export const SITE_THEME_BOOTSTRAP = `try{var k='${SITE_THEME_STORAGE_KEY}',v=localStorage.getItem(k)||'follow-device',m={honey:'warm-paper',light:'warm-paper',cocoa:'evening-cocoa',dark:'evening-cocoa',midnight:'evening-cocoa',forest:'evening-cocoa',candy:'warm-paper',cotton:'warm-paper',doodle:'warm-paper',pixel:'warm-paper',system:'follow-device','warm-paper':'warm-paper','evening-cocoa':'evening-cocoa','follow-device':'follow-device'};v=m[v]||'follow-device';localStorage.setItem(k,v);var d=v==='evening-cocoa'||(v==='follow-device'&&matchMedia('(prefers-color-scheme: dark)').matches),r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);r.dataset.siteTheme=v;r.style.colorScheme=d?'dark':'light'}catch(e){}`;
