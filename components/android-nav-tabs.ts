import { Heart, LayoutGrid, Settings, Sparkles } from "lucide-react";

export const ANDROID_NAV_TABS = [
  { href: "/", label: "Home", icon: Heart, match: (path: string) => path === "/" },
  {
    href: "/templates",
    label: "Templates",
    icon: LayoutGrid,
    match: (path: string) => path.startsWith("/templates"),
  },
  {
    href: "/library",
    label: "My Surprises",
    icon: Sparkles,
    match: (path: string) => path.startsWith("/library"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    match: (path: string) => path.startsWith("/settings"),
  },
] as const;

/** Canonical exact-path set for Android shell roots and hardware Back. */
export const ANDROID_ROOT_PATHS = new Set<string>(
  ANDROID_NAV_TABS.map((tab) => tab.href),
);
