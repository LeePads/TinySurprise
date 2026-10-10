/** Browser "Save As" download used by the web build wherever a File needs to reach disk. */
export function downloadFile(file: File): boolean {
  try {
    const legacyNavigator = navigator as Navigator & {
      msSaveOrOpenBlob?: (blob: Blob, name?: string) => boolean;
    };
    if (legacyNavigator.msSaveOrOpenBlob) {
      legacyNavigator.msSaveOrOpenBlob(file, file.name);
      return true;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    if (typeof a.download === "string") a.click();
    else window.location.assign(url);
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    return false;
  }
}
