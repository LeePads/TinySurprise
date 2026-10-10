export interface BuilderExitRequest {
  flush?: () => Promise<boolean>;
}

/**
 * Lets the mounted builder settle its durable draft before a controlled
 * navigation unmounts it. Callers continue immediately when no builder is
 * mounted; a failed flush keeps the caller on the builder.
 */
export function requestBuilderExit(navigate: () => void): void {
  if (typeof window === "undefined") {
    navigate();
    return;
  }
  const detail: BuilderExitRequest = {};
  window.dispatchEvent(
    new CustomEvent<BuilderExitRequest>("tiny-builder-before-exit", {
      detail,
    }),
  );
  if (!detail.flush) {
    navigate();
    return;
  }
  void detail.flush().then((canLeave) => {
    if (canLeave) navigate();
  });
}
