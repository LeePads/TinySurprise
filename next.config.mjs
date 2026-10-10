import { fileURLToPath } from "node:url";
import path from "node:path";

// Set by the `build:android` script only. The Vercel/web build never sets
// this, so it keeps its normal SSR-capable output and optimized images.
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

// A sibling pnpm-lock.yaml above this repo (e.g. in a parent Desktop
// folder) makes Next.js guess the wrong workspace root. Pin it explicitly
// so both the Vercel build and the Capacitor static export always resolve
// relative to this project, not whatever lockfile happens to be higher up.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: projectRoot,
  },
  ...(isCapacitorBuild
    ? { output: "export", trailingSlash: true }
    : {}),
  images: isCapacitorBuild
    ? { unoptimized: true }
    : {
        formats: ["image/avif", "image/webp"],
        minimumCacheTTL: 86400,
        qualities: [60, 72, 75, 82, 90],
      },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "geolocation=(), microphone=(), payment=(), usb=()",
      },
    ];

    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          ...securityHeaders,
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
