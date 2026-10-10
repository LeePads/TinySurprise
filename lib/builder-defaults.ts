import { createStableId } from "./local-media";
import { getTemplateExperienceDefinition } from "./template-experience-definitions";
import type {
  ChooseOurDateContent,
  CozyPlaylistContent,
  OurStorybookContent,
  SurpriseData,
  TemplateType,
  WishUponAStarContent,
} from "./types";

/**
 * Creates the initial editable content for a template.
 *
 * This module intentionally contains no React or persistence imports. Both
 * the builder hook and the library persistence layer need the same defaults,
 * so keeping them here avoids a dependency cycle between those modules.
 */
export const initialContent = (
  template: TemplateType,
): SurpriseData["content"] => {
  if (template === "catch-the-heart") {
    return {
      hearts: Array.from({ length: 3 }, () => ({
        id: createStableId("heart"),
        message: "",
      })),
      finalMessage: "",
      soundEffects: false,
      heartStyle: "classic",
    };
  }
  if (template === "photo-puzzle")
    return { difficulty: "easy", completionMessage: "", finalMessage: "" };
  if (template === "open-when")
    return {
      envelopes: Array.from({ length: 2 }, () => ({
        id: createStableId("envelope"),
        title: "",
        message: "",
      })),
      finalMessage: "",
    };
  if (template === "choose-our-date")
    return {
      introMessage: "",
      rounds: Array.from({ length: 2 }, (_, round) => ({
        id: createStableId("date-round"),
        question:
          round === 0
            ? "What kind of mood are you feeling?"
            : "Pick the finishing touch",
        options: Array.from({ length: 2 }, () => ({
          id: createStableId("date-option"),
          title: "",
          details: "",
        })),
      })),
      result: { title: "", description: "", details: "", invitation: "" },
    } as ChooseOurDateContent;
  if (template === "memory-quiz")
    return {
      questions: Array.from({ length: 3 }, () => ({
        id: createStableId("quiz"),
        prompt: "",
        answers: ["", "", ""],
        correctIndex: 0,
        memoryNote: "",
      })),
      finalMessage: "",
    };
  if (template === "our-storybook")
    return {
      pages: Array.from({ length: 2 }, (_, i) => ({
        id: createStableId("page"),
        title: `Chapter ${i + 1}`,
        body: "",
      })),
      finalMessage: "",
    } as OurStorybookContent;
  if (template === "wish-upon-a-star")
    return {
      stars: Array.from({ length: 5 }, () => ({
        id: createStableId("star"),
        wish: "",
        message: "",
        color: "#f8c96a",
      })),
      finalMessage: "",
    } as WishUponAStarContent;
  if (template === "cozy-playlist")
    return {
      tracks: Array.from({ length: 2 }, () => ({
        id: createStableId("track"),
        title: "",
        artist: "",
        why: "",
        link: "",
      })),
      finalMessage: "",
    } as CozyPlaylistContent;
  throw new Error(`Unsupported template: ${template}`);
};

export const initialData = (template: TemplateType): SurpriseData => {
  const definition =
    template === "wish-upon-a-star"
      ? undefined
      : getTemplateExperienceDefinition(template);
  const theme = definition?.defaultAppearance.theme || "soft-rose";
  return {
    template,
    basics: {
      senderName: "",
      recipientName: "",
      occasion: "",
      openingMessage: "",
    },
    content: initialContent(template),
    appearance: {
      theme,
      accentColor: undefined,
      backgroundStyle: definition?.defaultAppearance.backgroundStyle || "gradient",
      backgroundFilter: "balanced",
      fontPairing: "friendly",
      animationIntensity: "normal",
    },
    music: {
      loop: true,
      startMuted: false,
      volume: 60,
    },
    delivery: { expiration: "none" },
    delight: {
      coverEnabled: definition?.opening.showCoverWithoutMusic ?? true,
      coverMessage: "",
      openingStyle: definition?.opening.recommendedStyle || "gentle-fade",
      passphraseEnabled: false,
      passphrase: "",
      passphraseQuestion: "What is our little secret?",
      passphraseAnswers: ["", ""],
      passphraseMode: "choice",
      passphraseChoices: ["", "", ""],
      passphraseCorrectChoiceIndex: 0,
      closingMessage: "Made just for you",
      signature: "",
    },
  };
};
