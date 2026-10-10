"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNativePlatform } from "@/lib/platform";
import { hapticTap } from "@/lib/native/haptics";
import { ANDROID_NAV_TABS } from "./android-nav-tabs";

/**
 * Native-only app shell chrome — hidden entirely on the web build and
 * inside focused-work flows (builder, viewer). Portrait-phone variant of
 * the app's primary navigation; android-nav-rail.tsx is the landscape/
 * tablet counterpart, toggled purely by CSS (.android-nav-bottom /
 * .android-nav-rail in app/globals.css) so both can mount unconditionally
 * without a layout-thrashing JS breakpoint check.
 */
export function AndroidBottomNav() {
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
      className="android-nav-bottom fixed inset-x-0 bottom-0 z-[80] border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between">
        {ANDROID_NAV_TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => !active && void hapticTap()}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[.68rem] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
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
