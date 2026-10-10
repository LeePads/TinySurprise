"use client";

import { useEffect, useState } from "react";
import { LandingPage } from "@/components/landing-page";
import { AndroidHome } from "@/components/android-home";
import { isNativePlatform } from "@/lib/platform";

export default function Page() {
  // Defaults to the marketing landing page so the static export always has
  // real content (useful for the web build and for a brief instant before
  // hydration on native, which is covered by the native splash screen
  // anyway). Swaps to the app-focused home only once we know we're running
  // inside the Capacitor shell — the Android build must never show the
  // marketing page per the product's native/web split.
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativePlatform());
  }, []);

  return native ? <AndroidHome /> : <LandingPage />;
}
