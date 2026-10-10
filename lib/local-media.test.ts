import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectLocalImages,
  revokeImagesRemovedFromState,
} from "./local-media";
import type { LocalImage, SurpriseData } from "./types";

const image = (id: string): LocalImage => ({
  id,
  file: new File(["x"], `${id}.png`, { type: "image/png" }),
  previewUrl: `blob:${id}`,
  name: `${id}.png`,
  mimeType: "image/png",
  size: 1,
});

const data = (
  images: [LocalImage | undefined, LocalImage | undefined],
): SurpriseData => ({
  template: "catch-the-heart",
  basics: {
    senderName: "A",
    recipientName: "B",
    openingMessage: "Hi",
  },
  content: {
    hearts: [
      { id: "heart-a", message: "A", photo: images[0] },
      { id: "heart-b", message: "B", photo: images[1] },
      { id: "heart-c", message: "C" },
    ],
    finalMessage: "Done",
    soundEffects: false,
  },
  appearance: { theme: "soft-rose", animationIntensity: "normal" },
  delivery: { expiration: "none" },
});

describe("stable local media association", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps images associated by stable IDs and revokes only a removed image", () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { revokeObjectURL: revoke });
    const first = image("first");
    const second = image("second");
    const previous = data([first, second]);
    const next = data([undefined, second]);

    revokeImagesRemovedFromState(previous, next);

    expect(collectLocalImages(next).map((item) => item.id)).toEqual(["second"]);
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:first");
  });
});
