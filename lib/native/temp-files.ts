import { pendingImportPaths } from "./pending-import-store";
export const TINY_SURPRISE_IMPORT_PREFIX = "tiny-surprise-import-";
export const TINY_SURPRISE_IMPORT_SUFFIX = ".html";

function isTinySurpriseImportFile(name: string): boolean {
  return (
    name.startsWith(TINY_SURPRISE_IMPORT_PREFIX) &&
    name.endsWith(TINY_SURPRISE_IMPORT_SUFFIX)
  );
}

/**
 * Removes only Tiny Surprise's generated native HTML-import files from the
 * app-private cache. User exports live in Documents and are never selected.
 */
export async function clearTinySurpriseTempFiles(): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { files } = await Filesystem.readdir({
    path: "",
    directory: Directory.Cache,
  });
  const retained = new Set(pendingImportPaths().map(path => path.split("/").pop()));
  await Promise.all(
    files
      .filter((file) => file.type === "file" && isTinySurpriseImportFile(file.name) && !retained.has(file.name))
      .map((file) =>
        Filesystem.deleteFile({ path: file.name, directory: Directory.Cache }),
      ),
  );
}

/** Compatibility cleanup for imports created before the durable native inbox. */
export async function releaseLegacyImportFile(path: string): Promise<void> {
  const name = path.split("/").pop() || "";
  if (!isTinySurpriseImportFile(name)) return;
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  // Resolve the owned cache basename; never trust an arbitrary supplied path.
  await Filesystem.deleteFile({ path: name, directory: Directory.Cache });
}
