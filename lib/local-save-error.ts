/** Keep storage failures actionable without exposing browser error strings. */
export function localSaveFailureMessage(reason: unknown, fallback: string): string {
  if (typeof reason === "object" && reason !== null && "name" in reason && reason.name === "QuotaExceededError") {
    return "There isn’t enough storage to save. Keep this page open, free up space, then try again. Don’t clear TinySurprise’s saved data.";
  }
  return fallback;
}
