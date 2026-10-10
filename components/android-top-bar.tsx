"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { ANDROID_ROOT_PATHS } from "@/components/android-nav-tabs";
import { requestBuilderExit } from "@/lib/builder-exit";

/**
 * Native-only compact top bar — swapped in for the marketing <Header/> on
 * Android (see header.tsx) so the app never shows "Explore Templates / How
 * It Works / Create a Surprise" as desktop-style navigation. Root screens
 * (the four bottom-nav/rail tabs) get just the wordmark since switching
 * tabs is the nav's job; nested screens (builder, viewer, template demos)
 * get a Back control instead.
 */
export function AndroidTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = ANDROID_ROOT_PATHS.has(pathname);
  const isBuilder = pathname.startsWith("/create/");

  return (
    <header
      className="android-top-bar sticky top-0 z-50 flex min-h-14 items-center gap-2 border-b border-border/70 bg-background/95 px-2 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {isRoot ? (
        <BrandLogo decorative className="ml-1 h-7 w-[8.75rem]" />
      ) : (
        <button
          type="button"
          onClick={() =>
            isBuilder
              ? requestBuilderExit(() => router.push("/templates"))
              : router.back()
          }
          className="flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {isBuilder ? "Exit builder" : "Back"}
        </button>
      )}
    </header>
  );
}
