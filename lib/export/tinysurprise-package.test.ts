import { describe, expect, it } from "vitest";
import {
  createTinySurprisePackage,
  createTinySurprisePackageDetailed,
  readTinySurprisePackage,
  readTinySurprisePackageDetailed,
  TinySurprisePackageError,
  TINYSURPRISE_PACKAGE_VERSION,
  DRAFT_BACKUP_VERSION,
} from "./tinysurprise-package";
import { createZipArchive, readZipArchive } from "./zip";
import type { CatchTheHeartContent, SurpriseData } from "../types";

const baseData: SurpriseData = {
  template: "catch-the-heart",
  basics: {
    senderName: "Me",
    recipientName: "You",
    openingMessage: "Hello",
    occasion: "love",
  },
  content: {
    hearts: [{ id: "heart-1", message: "A memory" }],
    finalMessage: "Always",
    soundEffects: false,
  },
  appearance: { theme: "soft-rose", animationIntensity: "normal" },
  music: { loop: true, startMuted: false, volume: 60 },
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

function withPhoto(): SurpriseData {
  const photoFile = new File(["photo-bytes"], "memory.png", {
    type: "image/png",
  });
  return {
    ...baseData,
    content: {
      ...baseData.content,
      hearts: [
        {
          id: "heart-1",
          message: "A memory",
          photo: {
            id: "photo-1",
            file: photoFile,
            previewUrl: "blob:local",
            name: photoFile.name,
            mimeType: photoFile.type,
            size: photoFile.size,
            source: "upload",
          },
        },
      ],
    },
  } as SurpriseData;
}

function audioRef(id: string, name: string) {
  const audioFile = new File(["song-bytes"], name, { type: "audio/mpeg" });
  return {
    id,
    file: audioFile,
    previewUrl: "blob:local-audio",
    name: audioFile.name,
    mimeType: audioFile.type,
    size: audioFile.size,
  };
}

/** Catch-the-heart draft carrying legacy content.songFile — normalized to music.file at the package boundary. */
function withSong(): SurpriseData {
  return {
    ...baseData,
    content: { ...baseData.content, songFile: audioRef("song-1", "our-song.mp3") },
  } as SurpriseData;
}

function buildManifestZip(manifest: unknown, extraEntries: { name: string; data: Uint8Array }[] = []) {
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  return new Blob([
    new Uint8Array(
      createZipArchive([{ name: "manifest.json", data: bytes }, ...extraEntries]),
    ),
  ]);
}

describe(".tinysurprise package round-trip", () => {
  it("packages and reimports a draft with a photo, dropping the live blob URL", async () => {
    const data = withPhoto();
    const file = await createTinySurprisePackage(data);
    expect(file.name).toMatch(/\.tinysurprise$/);
    const imported = await readTinySurprisePackage(file);
    expect(imported.template).toBe("catch-the-heart");
    const photo = (imported.content as CatchTheHeartContent).hearts[0].photo;
    expect(photo?.file).toBeInstanceOf(File);
    expect(photo?.name).toBe("memory.png");
  });

  it("keeps two same-named photos as distinct, non-overwriting entries", async () => {
    const data = withPhoto();
    const secondPhoto = new File(["other-bytes"], "memory.png", {
      type: "image/png",
    });
    (data.appearance as { backgroundImage?: unknown }).backgroundImage = {
      id: "photo-2",
      file: secondPhoto,
      previewUrl: "blob:local-2",
      name: secondPhoto.name,
      mimeType: secondPhoto.type,
      size: secondPhoto.size,
      source: "upload",
    };
    const file = await createTinySurprisePackage(data);
    const imported = await readTinySurprisePackage(file);
    const heartPhoto = (imported.content as CatchTheHeartContent).hearts[0].photo;
    const bgPhoto = (imported.appearance as { backgroundImage?: { file?: File } })
      .backgroundImage;
    expect(await heartPhoto?.file?.text()).toBe("photo-bytes");
    expect(await bgPhoto?.file?.text()).toBe("other-bytes");
  });

  // Regression: the exporter strips `file` from every media ref before
  // serializing the manifest, and the reader validates the data shape before
  // re-attaching blobs. isLocalAudio required a live Blob unconditionally, so
  // every package carrying local audio failed its own import with "invalid or
  // corrupted data". Photos/video were unaffected, which is why only these
  // three cases catch it.
  it("packages and reimports a catch-the-heart song file", async () => {
    const file = await createTinySurprisePackage(withSong());
    const imported = await readTinySurprisePackage(file);
    const song = imported.music?.file;
    expect(song?.file).toBeInstanceOf(File);
    expect(song?.name).toBe("our-song.mp3");
    expect(song?.mimeType).toBe("audio/mpeg");
    expect(await song?.file?.text()).toBe("song-bytes");
  });

  it("packages and reimports background music (music.file)", async () => {
    const data = {
      ...baseData,
      music: { ...baseData.music, file: audioRef("music-1", "background.mp3") },
    } as SurpriseData;
    const imported = await readTinySurprisePackage(
      await createTinySurprisePackage(data),
    );
    expect(imported.music?.file?.file).toBeInstanceOf(File);
    expect(await imported.music?.file?.file?.text()).toBe("song-bytes");
  });

  it("packages and reimports open-when music alongside an envelope video", async () => {
    const videoFile = new File(["video-bytes"], "clip.mp4", { type: "video/mp4" });
    const data = {
      ...baseData,
      template: "open-when",
      content: {
        envelopes: [
          {
            id: "env-1",
            title: "Open when you miss me",
            message: "I miss you too",
            video: {
              id: "video-1",
              file: videoFile,
              previewUrl: "blob:local-video",
              name: videoFile.name,
              mimeType: videoFile.type,
              size: videoFile.size,
              source: "upload",
            },
          },
          {
            id: "env-2",
            title: "Open when you need a little courage",
            message: "I am cheering for you too",
          },
        ],
        musicFile: audioRef("music-2", "open-when.mp3"),
        finalMessage: "Always",
      },
    } as unknown as SurpriseData;
    const imported = await readTinySurprisePackage(
      await createTinySurprisePackage(data),
    );
    const content = imported.content as {
      envelopes: { video?: { file?: File } }[];
    };
    expect(await imported.music?.file?.file?.text()).toBe("song-bytes");
    expect(await content.envelopes[0].video?.file?.text()).toBe("video-bytes");
  });

  it("still rejects a package whose song entry is missing", async () => {
    const { file } = await createTinySurprisePackageDetailed(withSong());
    const entries = readZipArchive(new Uint8Array(await file.arrayBuffer()));
    const stripped = new Blob([
      new Uint8Array(
        createZipArchive(entries.filter((entry) => !entry.name.startsWith("media/"))),
      ),
    ]);
    await expect(readTinySurprisePackageDetailed(stripped)).rejects.toBeInstanceOf(
      TinySurprisePackageError,
    );
  });
});

describe(".tinysurprise package validation", () => {
  it("rejects a file that is not a ZIP archive at all", async () => {
    await expect(
      readTinySurprisePackage(new Blob(["not a zip"])),
    ).rejects.toThrow(TinySurprisePackageError);
  });

  it("rejects a ZIP missing manifest.json", async () => {
    const zip = new Blob([
      new Uint8Array(
        createZipArchive([{ name: "media/x.png", data: new Uint8Array([1]) }]),
      ),
    ]);
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(
      "missing its manifest",
    );
  });

  it("rejects an unsupported/future package version", async () => {
    const zip = buildManifestZip({
      package: "tinysurprise",
      version: DRAFT_BACKUP_VERSION + 1,
      data: baseData,
    });
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(
      /newer or incompatible/,
    );
  });

  it("rejects a manifest that isn't valid SurpriseData", async () => {
    const zip = buildManifestZip({
      package: "tinysurprise",
      version: 1,
      data: { template: "not-a-real-template" },
    });
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(
      /invalid or corrupted/,
    );
  });

  it("rejects __proto__ / constructor / prototype keys anywhere in the manifest", async () => {
    const poisoned = JSON.parse(
      `{"package":"tinysurprise","version":1,"data":{"template":"catch-the-heart","__proto__":{"polluted":true}}}`,
    );
    const zip = buildManifestZip(poisoned);
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(/unsafe field/);
  });

  it("rejects path traversal entries", async () => {
    const zip = buildManifestZip(
      { package: "tinysurprise", version: 1, data: baseData },
      [{ name: "media/../../etc/passwd", data: new Uint8Array([1]) }],
    );
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(/traversal/);
  });

  it("rejects absolute path entries", async () => {
    const zip = buildManifestZip(
      { package: "tinysurprise", version: 1, data: baseData },
      [{ name: "/etc/passwd", data: new Uint8Array([1]) }],
    );
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(/absolute path/);
  });

  it("rejects duplicate entry names", async () => {
    const zip = new Blob([
      new Uint8Array(
        createZipArchive([
          {
            name: "manifest.json",
            data: new TextEncoder().encode(
              JSON.stringify({ package: "tinysurprise", version: 1, data: baseData }),
            ),
          },
          { name: "manifest.json", data: new Uint8Array([1]) },
        ]),
      ),
    ]);
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(/duplicate/);
  });

  it("rejects disallowed executable-looking media entries", async () => {
    const zip = buildManifestZip(
      { package: "tinysurprise", version: 1, data: baseData },
      [{ name: "media/payload.exe", data: new Uint8Array([1]) }],
    );
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(
      /disallowed file type/,
    );
  });

  it("rejects unexpected top-level entries outside manifest/media", async () => {
    const zip = buildManifestZip(
      { package: "tinysurprise", version: 1, data: baseData },
      [{ name: "config/evil.json", data: new Uint8Array([1]) }],
    );
    await expect(readTinySurprisePackage(zip)).rejects.toThrow(/unexpected file/);
  });

  it("rejects a media entry whose declared MIME type is not image/video/audio", async () => {
    const data = withPhoto();
    const heart = (data.content as { hearts: Array<{ photo?: { mimeType: string } }> })
      .hearts[0];
    if (heart.photo) heart.photo.mimeType = "text/html";
    const file = await createTinySurprisePackage(data);
    await expect(readTinySurprisePackage(file)).rejects.toThrow(
      /unsupported file type/,
    );
  });

  it("rejects a package larger than the size ceiling", async () => {
    const oversized = new Blob([new Uint8Array(31 * 1024 * 1024)]);
    await expect(readTinySurprisePackage(oversized)).rejects.toThrow(
      /too large to import/,
    );
  });
});

describe(".tinysurprise content fingerprint", () => {
  it("produces the same contentHash for identical content packaged twice", async () => {
    const first = await createTinySurprisePackageDetailed(withPhoto());
    const second = await createTinySurprisePackageDetailed(withPhoto());
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a different contentHash when data changes", async () => {
    const original = await createTinySurprisePackageDetailed(baseData);
    const changed = await createTinySurprisePackageDetailed({
      ...baseData,
      basics: { ...baseData.basics, recipientName: "Someone else" },
    });
    expect(original.contentHash).not.toBe(changed.contentHash);
  });

  it("produces a different contentHash when media bytes change", async () => {
    const a = await createTinySurprisePackageDetailed(withPhoto());
    const withDifferentPhoto = withPhoto();
    (
      (withDifferentPhoto.content as CatchTheHeartContent).hearts[0]
        .photo as { file?: File }
    ).file = new File(["different-bytes"], "memory.png", { type: "image/png" });
    const b = await createTinySurprisePackageDetailed(withDifferentPhoto);
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it("round-trips the contentHash and sourceCreationId through readTinySurprisePackageDetailed", async () => {
    const { file } = await createTinySurprisePackageDetailed(withPhoto(), {
      sourceCreationId: "creation-abc",
    });
    const result = await readTinySurprisePackageDetailed(file);
    expect(result.sourceCreationId).toBe("creation-abc");
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const expected = await createTinySurprisePackageDetailed(withPhoto());
    expect(result.contentHash).toBe(expected.contentHash);
  });

  it("backfills a contentHash for older packages that predate the field", async () => {
    // Build a real, valid package, then strip contentHash to simulate one
    // made before that field existed — a hand-built manifest risks drifting
    // out of sync with isSurpriseDataRecord's actual requirements.
    const { file } = await createTinySurprisePackageDetailed(withPhoto());
    const entries = readZipArchive(new Uint8Array(await file.arrayBuffer()));
    const manifestEntry = entries.find((entry) => entry.name === "manifest.json")!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));
    delete manifest.contentHash;
    const rebuilt = new Blob([
      new Uint8Array(
        createZipArchive([
          {
            name: "manifest.json",
            data: new TextEncoder().encode(JSON.stringify(manifest)),
          },
          ...entries.filter((entry) => entry.name !== "manifest.json"),
        ]),
      ),
    ]);
    const result = await readTinySurprisePackageDetailed(rebuilt);
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
