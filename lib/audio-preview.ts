export const AUDIO_PREVIEW_START_EVENT = "tiny-audio-preview-start";

export interface AudioPreviewStartDetail {
  owner: string;
}

/** Claim the single user-preview audio slot for the current page/WebView. */
export function claimAudioPreview(owner: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AudioPreviewStartDetail>(AUDIO_PREVIEW_START_EVENT, {
      detail: { owner },
    }),
  );
}

/** Register an HTML media element with the one-active-preview contract. */
export function bindExclusiveAudioPreview(
  element: HTMLMediaElement,
  owner: string,
): () => void {
  const claim = () => claimAudioPreview(owner);
  const pauseWhenAnotherStarts = (event: Event) => {
    const detail = (event as CustomEvent<AudioPreviewStartDetail>).detail;
    if (detail?.owner !== owner) element.pause();
  };

  element.addEventListener("play", claim);
  window.addEventListener(AUDIO_PREVIEW_START_EVENT, pauseWhenAnotherStarts);

  return () => {
    element.removeEventListener("play", claim);
    window.removeEventListener(
      AUDIO_PREVIEW_START_EVENT,
      pauseWhenAnotherStarts,
    );
    element.pause();
  };
}
