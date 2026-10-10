#!/usr/bin/env node
// Cross-platform Gradle runner. `./gradlew` doesn't exist as a runnable
// command on Windows (needs `gradlew.bat`, and `.` isn't on PATH the way
// POSIX shells resolve it), so npm scripts that shell out to `./gradlew`
// fail under PowerShell/cmd. This picks the right wrapper for the current
// platform and forwards all arguments (e.g. `assembleDebug`, `bundleRelease`).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const androidDir = path.resolve(scriptDir, "..", "android");
const isWindows = process.platform === "win32";
const wrapper = isWindows ? "gradlew.bat" : "./gradlew";
const wrapperPath = path.join(androidDir, isWindows ? "gradlew.bat" : "gradlew");

if (!existsSync(androidDir)) {
  console.error(
    "android/ directory not found. Run `npx cap add android` first.",
  );
  process.exit(1);
}
if (!existsSync(wrapperPath)) {
  console.error(`Gradle wrapper not found at ${wrapperPath}.`);
  process.exit(1);
}
if (!isWindows) {
  try {
    // Ensure the wrapper is executable (git doesn't always preserve +x).
    spawnSync("chmod", ["+x", wrapperPath]);
  } catch {
    // Non-fatal; the spawn below will surface a clearer error if this matters.
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/android-gradle.mjs <gradle task...>");
  process.exit(1);
}

// On Windows, .bat files must run through a shell, and spawnSync's shell
// mode does not quote the command for us — a path containing spaces (very
// common under a user's home directory) would otherwise break in two.
const command = isWindows ? `"${wrapperPath}"` : wrapper;
const result = spawnSync(command, args, {
  cwd: androidDir,
  stdio: "inherit",
  shell: isWindows,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
