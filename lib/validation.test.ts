import { describe, expect, it } from 'vitest'
import {
  validateAppearance,
  validateBasics,
  validateCatchTheHeart,
  validateChooseOurDate,
  validateContent,
  validateDelight,
  validateImageFile,
  validateImageSignature,
  validateMemoryQuiz,
  validateOpenWhen,
  validatePlaylist,
  validatePhotoPuzzle,
  validateStorybook,
} from "./validation";
import type {
  CatchTheHeartContent,
  ChooseOurDateContent,
  CozyPlaylistContent,
  LocalImage,
  MemoryQuizContent,
  OpenWhenContent,
  OurStorybookContent,
  PhotoPuzzleContent,
} from "./types";

const pngBytes = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0])

describe('local image validation', () => {
  it('accepts a matching MIME type, extension, and signature', async () => {
    const file = new File([pngBytes], 'photo.png', { type: 'image/png' })
    expect(validateImageFile(file).valid).toBe(true)
    expect((await validateImageSignature(file)).valid).toBe(true)
  })

  it('rejects a text file renamed as an image', async () => {
    const file = new File(['plain text'], 'not-really.png', { type: 'image/png' })
    expect((await validateImageSignature(file)).valid).toBe(false)
  })

  it('rejects files over 5 MB', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
    expect(validateImageFile(file).errors.some((error) => error.message.includes('5 MB'))).toBe(true)
  })
})

const memoryPhoto: LocalImage = {
  id: "photo-1",
  previewUrl: "data:image/png;base64,abc",
  name: "memory.png",
  mimeType: "image/png",
  size: 3,
};

const errorFields = (value: { errors: { field: string }[] }) =>
  value.errors.map((error) => error.field);

const validCatch = (): CatchTheHeartContent => ({
  hearts: [{ id: "heart-1", message: "A little memory" }],
  finalMessage: "A final note",
  soundEffects: false,
});

const validPuzzle = (): PhotoPuzzleContent => ({
  photo: memoryPhoto,
  difficulty: "easy",
  completionMessage: "You put us back together.",
  finalMessage: "I love this moment.",
});

const validOpenWhen = (count = 3): OpenWhenContent => ({
  envelopes: Array.from({ length: count }, (_, index) => ({
    id: `envelope-${index}`,
    title: `Open when ${index + 1}`,
    message: `A note for moment ${index + 1}`,
  })),
  finalMessage: "One last letter",
});

const validDate = (
  roundCount = 2,
  optionCount = 2,
): ChooseOurDateContent => ({
  introMessage: "Choose our next little adventure.",
  rounds: Array.from({ length: roundCount }, (_, roundIndex) => ({
    id: `round-${roundIndex}`,
    question: `Round ${roundIndex + 1}?`,
    options: Array.from({ length: optionCount }, (_, optionIndex) => ({
      id: `round-${roundIndex}-option-${optionIndex}`,
      title: `Choice ${optionIndex + 1}`,
      details: "A lovely plan",
    })),
  })),
  result: {
    title: "Our date",
    description: "The choices came together.",
    details: "Saturday at sunset.",
    invitation: "It is a date.",
  },
});

const validQuiz = (count = 3): MemoryQuizContent => ({
  questions: Array.from({ length: count }, (_, index) => ({
    id: `question-${index}`,
    prompt: `Question ${index + 1}?`,
    answers: ["This one", "That one", ""],
    correctIndex: 0,
    memoryNote: "",
  })),
  finalMessage: "You remember us beautifully.",
});

const validStorybook = (count = 2): OurStorybookContent => ({
  pages: Array.from({ length: count }, (_, index) => ({
    id: `page-${index}`,
    title: `Chapter ${index + 1}`,
    body: `Our story ${index + 1}`,
  })),
  finalMessage: "More chapters soon.",
});

const validPlaylist = (count = 2): CozyPlaylistContent => ({
  tracks: Array.from({ length: count }, (_, index) => ({
    id: `track-${index}`,
    title: `Our song ${index + 1}`,
    artist: "Someone special",
    why: "It feels like home",
    link: `https://example.com/song-${index + 1}`,
  })),
  finalMessage: "One more listen?",
});

describe("shared builder required details", () => {
  it("maps every required Basics field to its field key", () => {
    expect(errorFields(validateBasics({}))).toEqual([
      "senderName",
      "recipientName",
      "openingMessage",
    ]);
    expect(
      validateBasics({
        senderName: "Cai",
        recipientName: "Denyal",
        openingMessage: "I made this for you.",
      }).valid,
    ).toBe(true);
  });

  it("requires a feeling and motion choice", () => {
    expect(errorFields(validateAppearance({}))).toEqual([
      "theme",
      "animationIntensity",
    ]);
    expect(
      validateAppearance({
        theme: "soft-rose",
        animationIntensity: "normal",
      }).valid,
    ).toBe(true);
  });

  it("requires both fields only when the playful secret is enabled", () => {
    expect(validateDelight({ passphraseEnabled: false }).valid).toBe(true);
    expect(
      errorFields(
        validateDelight({
          passphraseEnabled: true,
          passphrase: "",
          passphraseQuestion: "",
        }),
      ),
    ).toEqual(["passphraseQuestion", "passphrase"]);
    expect(
      validateDelight({
        passphraseEnabled: true,
        passphrase: "strawberry",
        passphraseQuestion: "Our place?",
      }).valid,
    ).toBe(true);
  });
});

describe("Catch the Heart validation", () => {
  it("accepts a note or a photo for each heart, including photo-only memories", () => {
    expect(validateCatchTheHeart(validCatch()).valid).toBe(true);
    expect(
      validateCatchTheHeart({
        ...validCatch(),
        hearts: [{ id: "heart-1", message: "", photo: memoryPhoto }],
      }).valid,
    ).toBe(true);
  });

  it("maps a blank memory and finale to their field-level messages", () => {
    expect(
      errorFields(
        validateCatchTheHeart({
          hearts: [{ id: "heart-1", message: "   " }],
          finalMessage: "",
        }),
      ),
    ).toEqual(["hearts.0.message", "finalMessage"]);
  });

  it("enforces the 1 to 20 memory limit", () => {
    expect(errorFields(validateCatchTheHeart({ ...validCatch(), hearts: [] }))).toContain(
      "hearts",
    );
    expect(
      errorFields(
        validateCatchTheHeart({
          ...validCatch(),
          hearts: Array.from({ length: 21 }, (_, index) => ({
            id: `heart-${index}`,
            message: "A memory",
          })),
        }),
      ),
    ).toContain("hearts");
  });
});

describe("Photo Puzzle validation", () => {
  it("accepts a complete puzzle", () => {
    expect(validatePhotoPuzzle(validPuzzle()).valid).toBe(true);
  });

  it("maps every required puzzle field", () => {
    expect(
      errorFields(
        validatePhotoPuzzle({
          difficulty: "easy",
          completionMessage: "",
          finalMessage: "",
        }),
      ),
    ).toEqual(["photo", "completionMessage", "finalMessage"]);
  });
});

describe("Open When validation", () => {
  it("accepts three complete letters and maps every blank letter field", () => {
    expect(validateOpenWhen(validOpenWhen()).valid).toBe(true);
    expect(
      errorFields(
        validateOpenWhen({
          envelopes: Array.from({ length: 3 }, (_, index) => ({
            id: `envelope-${index}`,
            title: "",
            message: "",
          })),
          finalMessage: "",
        }),
      ),
    ).toEqual([
      "envelopes.0.title",
      "envelopes.0.message",
      "envelopes.1.title",
      "envelopes.1.message",
      "envelopes.2.title",
      "envelopes.2.message",
      "finalMessage",
    ]);
  });

  it("enforces the 2 to 6 letter limit", () => {
    expect(errorFields(validateOpenWhen(validOpenWhen(1)))).toContain(
      "envelopes",
    );
    expect(errorFields(validateOpenWhen(validOpenWhen(7)))).toContain(
      "envelopes",
    );
  });
});

describe("Choose Our Date validation", () => {
  it("accepts two complete rounds and maps every required nested field", () => {
    expect(validateChooseOurDate(validDate()).valid).toBe(true);
    const blank = validDate();
    blank.introMessage = "";
    blank.rounds.forEach((round) => {
      round.question = "";
      round.options.forEach((option) => {
        option.title = "";
        option.details = "";
      });
    });
    blank.result = { title: "", description: "", details: "", invitation: "" };
    expect(errorFields(validateChooseOurDate(blank))).toEqual([
      "introMessage",
      "rounds.0.question",
      "rounds.0.options.0.title",
      "rounds.0.options.1.title",
      "rounds.1.question",
      "rounds.1.options.0.title",
      "rounds.1.options.1.title",
      "result.invitation",
    ]);
  });

  it("enforces 2 to 5 rounds and 2 to 4 choices per round", () => {
    expect(errorFields(validateChooseOurDate(validDate(1)))).toContain(
      "rounds",
    );
    expect(errorFields(validateChooseOurDate(validDate(6)))).toContain(
      "rounds",
    );
    expect(errorFields(validateChooseOurDate(validDate(2, 1)))).toContain(
      "rounds.0.options",
    );
    expect(errorFields(validateChooseOurDate(validDate(2, 5)))).toContain(
      "rounds.0.options",
    );
  });
});

describe("Memory Quiz validation", () => {
  it("accepts complete questions without requiring memory notes", () => {
    expect(validateMemoryQuiz(validQuiz()).valid).toBe(true);
  });

  it("maps every required question field and ignores whitespace answers", () => {
    const blank = validQuiz();
    blank.questions.forEach((question) => {
      question.prompt = "";
      question.answers = ["   ", "", ""];
      question.correctIndex = 0;
    });
    blank.finalMessage = "";
    expect(errorFields(validateMemoryQuiz(blank))).toEqual([
      "questions.0.prompt",
      "questions.0.answers",
      "questions.0.correctIndex",
      "questions.1.prompt",
      "questions.1.answers",
      "questions.1.correctIndex",
      "questions.2.prompt",
      "questions.2.answers",
      "questions.2.correctIndex",
      "finalMessage",
    ]);
  });

  it("enforces the 3 to 8 question limit", () => {
    expect(errorFields(validateMemoryQuiz(validQuiz(2)))).toContain(
      "questions",
    );
    expect(errorFields(validateMemoryQuiz(validQuiz(9)))).toContain(
      "questions",
    );
  });
});

describe("Our Tiny Storybook validation", () => {
  it("accepts two complete chapters and maps every required field", () => {
    expect(validateStorybook(validStorybook()).valid).toBe(true);
    const blank = validStorybook();
    blank.pages.forEach((page) => {
      page.title = "";
      page.body = "";
    });
    blank.finalMessage = "";
    expect(errorFields(validateStorybook(blank))).toEqual([
      "pages.0.title",
      "pages.0.body",
      "pages.1.title",
      "pages.1.body",
      "finalMessage",
    ]);
  });

  it("enforces the 2 to 20 chapter limit", () => {
    expect(errorFields(validateStorybook(validStorybook(1)))).toContain(
      "pages",
    );
    expect(errorFields(validateStorybook(validStorybook(21)))).toContain(
      "pages",
    );
  });
});

describe("The Cozy Playlist validation", () => {
  it("accepts two complete songs and maps every required field", () => {
    expect(validatePlaylist(validPlaylist()).valid).toBe(true);
    const blank = validPlaylist();
    blank.tracks.forEach((track) => {
      track.title = "";
      track.artist = "";
      track.why = "";
    });
    blank.finalMessage = "";
    expect(errorFields(validatePlaylist(blank))).toEqual([
      "tracks.0.title",
      "tracks.0.artist",
      "tracks.0.why",
      "tracks.1.title",
      "tracks.1.artist",
      "tracks.1.why",
      "finalMessage",
    ]);
  });

  it("enforces the 2 to 12 song limit", () => {
    expect(errorFields(validatePlaylist(validPlaylist(1)))).toContain("tracks");
    expect(errorFields(validatePlaylist(validPlaylist(13)))).toContain(
      "tracks",
    );
  });

  it("rejects unsafe optional links before they can enter an export", () => {
    const playlist = validPlaylist();
    playlist.tracks[0].link = "javascript:alert(1)";
    expect(validatePlaylist(playlist).errors).toContainEqual(
      expect.objectContaining({ field: "tracks.0.link" }),
    );
  });
});

describe("active template routing", () => {
  it("routes every Version 1 template to its valid content validator", () => {
    expect(validateContent("catch-the-heart", validCatch()).valid).toBe(true);
    expect(validateContent("photo-puzzle", validPuzzle()).valid).toBe(true);
    expect(validateContent("open-when", validOpenWhen()).valid).toBe(true);
    expect(validateContent("choose-our-date", validDate()).valid).toBe(true);
    expect(validateContent("memory-quiz", validQuiz()).valid).toBe(true);
    expect(validateContent("our-storybook", validStorybook()).valid).toBe(true);
    expect(validateContent("cozy-playlist", validPlaylist()).valid).toBe(true);
  });
});
