"use client";

import { Capacitor } from "@capacitor/core";

/**
 * Single choke point for native/web branching. Components should call these
 * helpers instead of importing @capacitor/core directly, so native checks
 * stay in one place.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroidPlatform(): boolean {
  return Capacitor.getPlatform() === "android";
}
