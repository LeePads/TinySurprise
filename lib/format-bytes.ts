/** Format byte counts using the app's existing megabyte display convention. */
export function formatBytes(bytes: number, decimals = 1): string {
  return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
}
