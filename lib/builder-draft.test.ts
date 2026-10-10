import { afterEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  BUILDER_DB_SCHEMA,
  clearBuilderDraft,
  LOCAL_MEDIA_STORE,
  loadBuilderDraft,
  withNamedTinySurpriseStores,
  isBuilderDraftRecord,
  restoreDraftMedia,
} from "./builder-draft";
import type { LocalImage, SurpriseData } from "./types";

afterEach(() => vi.restoreAllMocks());

const validDraftData: SurpriseData = {
  template: "catch-the-heart",
  basics: {
    senderName: "",
    recipientName: "",
    openingMessage: "",
    occasion: "",
  },
  content: {
    hearts: [{ id: "heart-1", message: "" }],
    finalMessage: "",
    soundEffects: false,
  },
  appearance: {
    theme: "soft-rose",
    animationIntensity: "normal",
    backgroundStyle: "gradient",
  },
  delivery: { expiration: "none" },
  delight: {
    coverEnabled: true,
    coverMessage: "",
    openingStyle: "gentle-fade",
    passphraseEnabled: false,
    passphrase: "",
    closingMessage: "",
    signature: "",
  },
};

describe("builder draft media recovery", () => {
  it("publishes and validates the browser database contract", () => {
    expect(BUILDER_DB_SCHEMA).toMatchObject({
      name: "tinysurprise-builder",
      version: 4,
      stores: {
        drafts: { recordVersion: 1 },
        creations: { recordVersion: 1 },
        "creation-drafts": { recordVersion: 1 },
        "local-media": { key: "owner:kind:media id", recordVersion: 1 },
      },
    });
    expect(
      isBuilderDraftRecord(
        {
          version: 1,
          step: 3,
          savedAt: Date.now(),
          data: validDraftData,
        },
        "catch-the-heart",
      ),
    ).toBe(true);
    expect(
      isBuilderDraftRecord(
        {
          version: 1,
          step: 2,
          savedAt: Date.now(),
          data: { ...validDraftData, template: "photo-puzzle" },
        },
        "catch-the-heart",
      ),
    ).toBe(false);
    expect(
      isBuilderDraftRecord(
        {
          version: 1,
          step: 2,
          savedAt: Date.now(),
          data: {
            ...validDraftData,
            appearance: { theme: "removed-theme" },
          },
        },
        "catch-the-heart",
      ),
    ).toBe(false);
    expect(
      isBuilderDraftRecord(
        {
          version: 1,
          step: 2,
          savedAt: Date.now(),
          data: { template: "catch-the-heart" },
        },
        "catch-the-heart",
      ),
    ).toBe(false);
    expect(isBuilderDraftRecord({ version: 99 }, "catch-the-heart")).toBe(false);
  });

  it("recreates browser URLs for uploaded photos and music", () => {
    let count = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:restored-${++count}`,
    );
    const photoFile = new File(["photo"], "memory.png", { type: "image/png" });
    const audioFile = new File(["audio"], "song.mp3", { type: "audio/mpeg" });
    const data: SurpriseData = {
      template: "catch-the-heart",
      basics: {
        senderName: "Me",
        recipientName: "You",
        openingMessage: "Hello",
      },
      content: {
        hearts: [
          {
            id: "heart-1",
            message: "",
            photo: {
              id: "photo-1",
              file: photoFile,
              previewUrl: "blob:expired",
              name: photoFile.name,
              mimeType: photoFile.type,
              size: photoFile.size,
              source: "upload",
            },
          },
        ],
        finalMessage: "Always",
        soundEffects: false,
        songFile: {
          id: "audio-1",
          file: audioFile,
          previewUrl: "blob:expired-audio",
          name: audioFile.name,
          mimeType: audioFile.type,
          size: audioFile.size,
        },
      },
      appearance: { theme: "soft-rose", animationIntensity: "normal" },
      delivery: { expiration: "none" },
    };

    const restored = restoreDraftMedia(data);
    expect(restored.content).toMatchObject({
      hearts: [{ photo: { previewUrl: "blob:restored-1" } }],
      songFile: { previewUrl: "blob:restored-2" },
    });
  });

  it("rehydrates a media record after the draft no longer contains its nested Blob", async () => {
    let count = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:durable-${++count}`,
    );
    const file = new File(["photo-bytes"], "memory.png", { type: "image/png" });
    const data = structuredClone({
      ...validDraftData,
      content: {
        ...validDraftData.content,
        hearts: [{ id: "heart-1", message: "A saved moment", photo: {
          id: "photo-durable",
          file,
          previewUrl: "blob:old",
          name: file.name,
          mimeType: file.type,
          size: file.size,
          source: "upload" as const,
        } }],
      },
    });
    const draftWithoutNestedBlob = structuredClone({
      ...data,
      content: {
        ...data.content,
        hearts: [{
          ...data.content.hearts[0],
          photo: (() => {
            const { file: _file, ...withoutFile } = data.content.hearts[0].photo!;
            return withoutFile;
          })(),
        }],
      },
    });
    await withNamedTinySurpriseStores(
      ["drafts", LOCAL_MEDIA_STORE],
      "readwrite",
      (stores) => {
        stores.drafts.put({ data: draftWithoutNestedBlob, step: 2, savedAt: Date.now(), version: 1 }, "catch-the-heart");
        stores[LOCAL_MEDIA_STORE].put({
          ownerKey: "catch-the-heart",
          kind: "image",
          mediaId: "photo-durable",
          name: file.name,
          mimeType: file.type,
          size: file.size,
          blob: file,
        }, "catch-the-heart:image:photo-durable");
      },
    );

    const restored = await loadBuilderDraft("catch-the-heart");
    const photo = (restored?.data.content as typeof data.content).hearts[0].photo as LocalImage | undefined;
    expect(photo?.file).toBeInstanceOf(File);
    expect(photo?.file?.name).toBe("memory.png");
    expect(photo?.file?.type).toBe("image/png");
    expect(photo?.previewUrl).toBe("blob:durable-1");
    expect(photo?.unavailable).toBe(false);
    await clearBuilderDraft("catch-the-heart");
  });
});
