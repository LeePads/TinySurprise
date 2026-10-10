"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNativePlatform } from "@/lib/platform";
import { hapticTap } from "@/lib/native/haptics";
import { ANDROID_NAV_TABS } from "./android-nav-tabs";
import { BrandMark } from "@/components/brand";

/**
 * Landscape-phone / tablet counterpart to android-bottom-nav.tsx — same
 * tabs, a fixed left rail instead of a bottom bar so wide/short viewports
 * get the full content height back. Visibility is purely CSS-driven
 * (.android-nav-rail in app/globals.css, gated by the same breakpoint as
 * lib/use-media-query.ts's useAndroidWideLayout) rather than a JS check, so
 * there's no flash/mismatch while a resize crosses the breakpoint.
 */
export function AndroidNavRail() {
  const pathname = usePathname();
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativePlatform());
  }, []);

  if (!native || pathname.startsWith("/create/") || pathname.startsWith("/viewer"))
    return null;

  return (
    <nav
      aria-label="Main"
      className="android-nav-rail fixed inset-y-0 left-0 z-[80] w-20 flex-col items-center gap-1 border-r bg-card/95 pb-[env(safe-area-inset-bottom)] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl"
    >
      <BrandMark decorative className="mb-3 h-7 w-7" />
      <ul className="flex flex-1 flex-col items-center gap-1">
        {ANDROID_NAV_TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="w-full px-2">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => !active && void hapticTap()}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl text-[.65rem] font-semibold ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
              >
                <Icon className={`h-5 w-5 ${active ? "fill-current" : ""}`} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
