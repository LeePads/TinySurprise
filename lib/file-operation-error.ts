import { TinySurprisePackageError } from "./export/tinysurprise-package";
import { NativeShareError } from "./export/native-share";
import { localSaveFailureMessage } from "./local-save-error";

/** Map known failures to recovery advice; never forward raw paths or platform errors. */
export function fileOperationFailureMessage(reason: unknown, fallback: string): string {
  const storageMessage = localSaveFailureMessage(reason, fallback);
  if (storageMessage !== fallback) return storageMessage;
  if (reason instanceof NativeShareError) return reason.message;
  const message = reason instanceof Error ? reason.message.toLowerCase() : "";
  if (/unsupported.*version|future.*version|version.*not supported|newer.*version|incompatible.*version/.test(message))
    return "This file uses an unsupported version of Tiny Surprise. Update the app or ask for a new copy.";
  if (/too large|over \d+ mb|larger than|exceeds? .*(limit|budget)|size ceiling/.test(message))
    return "This file is too large. Use fewer or smaller photos, songs or videos, then try again.";
  if (/manifest.*missing|missing.*manifest/.test(message))
    return "This isn’t an app copy. If it’s a ZIP browser copy, extract it and open the HTML file inside.";
  if (/missing from|missing media|missing.*entry/.test(message))
    return "Parts of this file are missing. Choose the original file or ask the sender for a new copy.";
  if (/cut off|truncated/.test(message))
    return "This file was cut off while sending. Choose the complete original file or ask for a new copy.";
  if (/unavailable|original.*(missing|no longer|not available)|original bytes|choose.*again before sharing|reselect/.test(message))
    return "Some original media is unavailable. Choose those photos or songs again, then retry. Your saved work is kept.";
  if (/corrupt|altered|checksum|doesn.t match|do not match|different files share|non-empty photo|decode|overlapping|unsafe|malformed|invalid.*(data|photo|image|media)|unsupported.*(photo|image|media|format)/.test(message))
    return "This file or its media could not be read safely. Choose the original files or ask for a new copy.";
  if (/incomplete|complete.*before|add .*before|conflicting media/.test(message))
    return "Some required details or media are missing. Return to your surprise, review them, then try again.";
  if (reason instanceof TinySurprisePackageError)
    return "This surprise file is damaged or unsupported. Choose the original file or ask for a new copy.";
  const name = reason && typeof reason === "object" && "name" in reason ? reason.name : undefined;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Storage access was blocked. Keep your work open, allow access if asked, then retry.";
  if (name === "NotReadableError" || name === "InvalidStateError" || name === "AbortError" || name === "UnknownError")
    return "The file or saved data could not be read or written. Keep your work open and try again.";
  return fallback;
}
