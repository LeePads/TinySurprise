"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  Menu,
  MoreHorizontal,
  Moon,
  Palette,
  Sun,
  Monitor,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { AndroidTopBar } from "@/components/android-top-bar";
import { BrandLogo } from "@/components/brand";
import { SiteMusicHeaderControl } from "@/components/site-music";
import { isNativePlatform } from "@/lib/platform";
import { requestBuilderExit } from "@/lib/builder-exit";
import {
  applySiteTheme,
  normalizeSiteTheme,
  readSiteTheme,
  SITE_THEME_STORAGE_KEY,
  type SiteTheme,
} from "@/lib/site-theme";

// Dispatches to the compact native top bar on Android — the marketing
// header (site nav links, "Create a surprise" CTA, website theme switcher)
// must never render inside the native shell per the product's native/web
// navigation split. Call sites are unchanged (every page just renders
// <Header/>), so this stays a single choke point.
export function Header() {
  const [native, setNative] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);
  return native ? <AndroidTopBar /> : <MarketingHeader builderRoute={pathname.startsWith("/create/")} />;
}

function MarketingHeader({ builderRoute = false }: { builderRoute?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<SiteTheme>("follow-device");
  const [open, setOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const utilityMenu = useRef<HTMLDivElement>(null);
  const themeMenu = useRef<HTMLDivElement>(null);
  const apply = useCallback((next: SiteTheme, persist = true) => {
    applySiteTheme(next, persist);
    setMode(next);
  }, []);
  useEffect(() => {
    const restore = () => apply(readSiteTheme(), false);
    const syncStorage = (event: StorageEvent) => {
      if (event.key === SITE_THEME_STORAGE_KEY)
        apply(normalizeSiteTheme(event.newValue), false);
    };
    restore();
    window.addEventListener("pageshow", restore);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("storage", syncStorage);
    };
  }, [apply]);
  useEffect(() => {
    if (mode !== "follow-device") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      apply("follow-device", false);
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [apply, mode]);
  useEffect(() => {
    if (!utilityOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!utilityMenu.current?.contains(event.target as Node)) {
        setUtilityOpen(false);
        setThemeOpen(false);
      }
    };
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUtilityOpen(false);
        setThemeOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeWithKeyboard);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [utilityOpen]);
  useEffect(() => {
    if (!themeOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!themeMenu.current?.contains(event.target as Node))
        setThemeOpen(false);
    };
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThemeOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeWithKeyboard);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [themeOpen]);
  const ModeIcon =
    mode === "warm-paper"
      ? Sun
      : mode === "evening-cocoa"
        ? Moon
        : mode === "follow-device"
          ? Monitor
          : Palette;
  const choices: {
    value: SiteTheme;
    label: string;
    description: string;
    icon: typeof Sun;
  }[] = [
    {
      value: "warm-paper",
      label: "Warm Paper",
      description: "Soft cream and dusty coral",
      icon: Sun,
    },
    {
      value: "evening-cocoa",
      label: "Evening Cocoa",
      description: "Warm charcoal and softened coral",
      icon: Moon,
    },
    {
      value: "follow-device",
      label: "Follow device",
      description: "Match this device automatically",
      icon: Monitor,
    },
  ];
  return (
    <header className={`sticky top-0 z-50 border-b border-border/70 bg-background/95 supports-[backdrop-filter]:bg-background/90 supports-[backdrop-filter]:backdrop-blur-md ${builderRoute ? "builder-site-header" : ""}`}>
      <div className="site-container mx-auto flex min-h-16 items-center justify-between gap-1.5 px-1 sm:gap-3">
        <Link
          href="/"
          onClick={(event) => { if (builderRoute) { event.preventDefault(); requestBuilderExit(() => router.push("/")); } }}
          aria-label="Tiny Surprise home"
          className="group flex min-h-11 min-w-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
        >
          <BrandLogo
            decorative
            priority
            className="site-logo-wrap w-[7.75rem] shrink-0 min-[360px]:w-[8.75rem] sm:w-[10rem]"
            sizes="(min-width: 640px) 160px, (min-width: 360px) 140px, 124px"
          />
        </Link>
        {builderRoute && (
          <Link
            href="/templates"
            onClick={(event) => {
              event.preventDefault();
              requestBuilderExit(() => router.push("/templates"));
            }}
            className="mr-auto inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 sm:ml-1 sm:px-3"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden min-[420px]:inline">Exit builder</span>
          </Link>
        )}
        {!builderRoute && (
          <nav
            className="hidden items-center gap-7 md:flex"
            aria-label="Main navigation"
          >
            <Link
              aria-current={pathname === "/templates" ? "page" : undefined}
              href="/templates"
              className="rounded-lg text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              Explore Templates
            </Link>
            <Link href="/library" aria-current={pathname === "/library" ? "page" : undefined} className="min-h-12 content-center rounded-lg text-sm font-semibold hover:text-primary">My Surprises</Link>
            <Link
              href="/#how-it-works"
              className="rounded-lg text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              How It Works
            </Link>
          </nav>
        )}
        {builderRoute && <Link className="hidden min-h-12 items-center rounded-xl px-3 text-sm font-semibold md:inline-flex" href="/library" onClick={(event) => { event.preventDefault(); requestBuilderExit(() => router.push("/library")); }}>My Surprises</Link>}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="relative" ref={utilityMenu}>
            <button
              type="button"
              className="flex min-h-12 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:px-3"
              aria-haspopup="true"
              aria-expanded={utilityOpen}
              aria-label="More preferences"
              onClick={() => setUtilityOpen((value) => !value)}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="hidden sm:inline">More</span>
            </button>
            {utilityOpen && (
              <div className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-[min(19rem,calc(100vw-1rem))] rounded-2xl border bg-popover p-2 text-popover-foreground shadow-2xl max-md:max-h-[calc(100svh-5rem)] max-md:overflow-y-auto">
                <p className="px-3 pb-2 pt-1 text-xs font-semibold text-muted-foreground">
                  Preferences
                </p>
                <PwaInstallButton />
                <div className="relative" ref={themeMenu}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-secondary"
                    aria-haspopup="menu"
                    aria-expanded={themeOpen}
                    aria-label={`Site appearance: ${choices.find((choice) => choice.value === mode)?.label ?? "Follow device"}`}
                    onClick={() => setThemeOpen((value) => !value)}
                  >
                    <Palette className="h-4 w-4 text-primary" />
                    <span className="flex-1">Appearance</span>
                    <ModeIcon className="h-4 w-4" />
                  </button>
                  {themeOpen && (
                    <div
                      role="menu"
                      className="mt-1 w-full rounded-2xl border bg-popover p-2 text-popover-foreground shadow-lg sm:absolute sm:top-0 sm:mt-0 sm:right-auto sm:left-[calc(100%+.5rem)] sm:w-[min(18rem,calc(100vw-1rem))] sm:shadow-2xl"
                    >
                      {choices.map((choice) => {
                        const Icon = choice.icon;
                        return (
                          <button
                            role="menuitemradio"
                            aria-checked={mode === choice.value}
                            type="button"
                            key={choice.value}
                            onClick={() => {
                              apply(choice.value);
                              setThemeOpen(false);
                              setUtilityOpen(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-secondary"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block text-sm">
                                {choice.label}
                              </strong>
                              <span className="block text-xs text-muted-foreground">
                                {choice.description}
                              </span>
                            </span>
                            {mode === choice.value && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <SiteMusicHeaderControl />
              </div>
            )}
          </div>
          {!builderRoute && (
            <Button
              asChild
              size="sm"
              className="hidden shadow-warm md:inline-flex"
            >
              <Link href="/templates">Create a surprise</Link>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile navigation"
          className="border-t bg-card p-3 md:hidden"
        >
          <div className="site-container mx-auto grid gap-2">
            <Link href="/library" aria-current={pathname === "/library" ? "page" : undefined} className="flex min-h-12 items-center rounded-xl px-3 font-semibold hover:bg-secondary" onClick={(event) => { setOpen(false); if (builderRoute) { event.preventDefault(); requestBuilderExit(() => router.push("/library")); } }}>My Surprises</Link>
            {!builderRoute && (
              <>
                <Link
                  onClick={() => setOpen(false)}
                  href="/templates"
                  className="flex min-h-12 items-center rounded-xl px-3 hover:bg-secondary"
                >
                  Explore Templates
                </Link>
                <Link
                  onClick={() => setOpen(false)}
                  href="/#how-it-works"
                  className="flex min-h-12 items-center rounded-xl px-3 hover:bg-secondary"
                >
                  How It Works
                </Link>
                <Button asChild>
                  <Link onClick={() => setOpen(false)} href="/templates">
                    Create a surprise
                  </Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
