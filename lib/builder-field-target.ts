import type { CatchTheHeartContent, ChooseOurDateContent, CozyPlaylistContent, LocalAudio, LocalImage, LocalVideo, MemoryQuizContent, OpenWhenContent, OurStorybookContent, SurpriseData } from "./types";

export interface BuilderFieldTarget { step: number; inputId: string }
export type ReviewSection = "basics" | "content" | "appearance" | "delight" | "music";

/** Maps existing validation paths to existing editors, without another model
 * of section completion or any changes to validation/import boundaries. */
export function builderFieldTarget(data: SurpriseData, section: ReviewSection, field: string): BuilderFieldTarget {
  const fallback = { step: section === "basics" ? 1 : section === "content" ? 2 : section === "appearance" ? 3 : 4, inputId: "builder-step-fields" };
  const target = (inputId?: string) => ({ ...fallback, inputId: inputId || fallback.inputId });
  if (section === "basics") return target(({ senderName: "sender-name", recipientName: "recipient-name", openingMessage: "opening-message" } as Record<string, string>)[field]);
  if (section === "music") return target(field.includes("youtube") ? "shared-youtube-url" : "delivery-music");
  if (section === "appearance") return fallback;
  if (section === "delight") return target(field === "passphraseQuestion" ? "secret-question" : field.startsWith("passphraseChoices") || data.delight?.passphraseMode === "choice" ? "secret-choice-0" : "secret-answer");
  const parts = field.split(".");
  const parsedIndex = Number(parts[1]);
  const index = Number.isInteger(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0;
  const finalIds: Record<string, string> = { "catch-the-heart": "heart-finale", "photo-puzzle": "puzzle-final", "open-when": "envelope-final", "choose-our-date": "date-invitation", "memory-quiz": "quiz-final", "our-storybook": "storybook-final", "cozy-playlist": "playlist-final" };
  if (field === "finalMessage") return target(finalIds[data.template]);
  if (data.template === "catch-the-heart") {
    const heart = (data.content as CatchTheHeartContent).hearts[index];
    return field === "songUrl" ? { step: 4, inputId: "shared-youtube-url" } : target(heart ? `heart-note-${heart.id}` : undefined);
  }
  if (data.template === "photo-puzzle") return target(field === "photo" ? "puzzle-photo" : "puzzle-complete");
  if (data.template === "open-when") {
    const letter = (data.content as OpenWhenContent).envelopes[index];
    return target(letter ? `envelope-${parts[2] === "message" ? "message" : "title"}-${letter.id}` : undefined);
  }
  if (data.template === "choose-our-date") {
    const round = (data.content as ChooseOurDateContent).rounds[index];
    if (field === "introMessage") return target("date-intro");
    if (parts[0] === "result") return target(parts[1] === "invitation" ? "date-invitation" : ["title", "description", "details"].includes(parts[1]) ? `date-result-${parts[1]}` : "date-invitation");
    const option = round?.options[Number(parts[3] || 0)];
    return target(parts[2] === "options" && option ? `date-${parts[4] === "details" ? "details" : parts[4] === "photo" ? "photo" : "title"}-${option.id}` : round ? `date-question-${round.id}` : undefined);
  }
  if (data.template === "memory-quiz") {
    const question = (data.content as MemoryQuizContent).questions[index];
    return target(question ? parts[2] === "answers" || parts[2] === "correctIndex" ? `quiz-answer-${question.id}-${Number(parts[3] || 0)}` : parts[2] === "memoryNote" ? `quiz-note-${question.id}` : `quiz-question-${question.id}` : undefined);
  }
  if (data.template === "our-storybook") {
    const page = (data.content as OurStorybookContent).pages[index];
    return target(page ? `chapter-${parts[2] === "body" ? "body" : "title"}-${page.id}` : undefined);
  }
  if (data.template === "cozy-playlist") {
    if (field === "tracks.audio") {
      const track = (data.content as CozyPlaylistContent).tracks.find(track => track.audio);
      return target(track ? `track-audio-${track.id}` : undefined);
    }
    const track = (data.content as CozyPlaylistContent).tracks[index];
    const name = ["title", "artist", "why", "link", "audio"].includes(parts[2]) ? parts[2] : "title";
    return target(track ? `track-${name}-${track.id}` : undefined);
  }
  return fallback;
}

export function mediaFieldTarget(data: SurpriseData, id: string): BuilderFieldTarget {
  if (data.delight?.coverPhoto?.id === id) return { step: 4, inputId: "cover-photo" };
  if ([data.appearance.backgroundImage?.id, data.appearance.customBackgroundImage?.id].includes(id)) return { step: 3, inputId: "appearance-background" };
  if (data.music?.file?.id === id) return { step: 4, inputId: "delivery-music" };
  if (data.template === "photo-puzzle") return { step: 2, inputId: "puzzle-photo" };
  if (data.template === "choose-our-date") {
    const option = (data.content as ChooseOurDateContent).rounds.flatMap(round => round.options).find(option => option.photo?.id === id);
    if (option) return { step: 2, inputId: `date-photo-${option.id}` };
  }
  const c = data.content;
  // Use a shared structural view of the known media fields. An `in` check on
  // the inferred item union can narrow an undeclared property to unknown,
  // rather than to LocalAudio/LocalVideo.
  const groups: ReadonlyArray<{ photo?: LocalImage; audio?: LocalAudio; video?: LocalVideo }> =
    data.template === "catch-the-heart" ? (c as CatchTheHeartContent).hearts :
    data.template === "open-when" ? (c as OpenWhenContent).envelopes :
    data.template === "memory-quiz" ? (c as MemoryQuizContent).questions :
    data.template === "our-storybook" ? (c as OurStorybookContent).pages :
    data.template === "cozy-playlist" ? (c as CozyPlaylistContent).tracks : [];
  const index = groups.findIndex(item => item.photo?.id === id || item.audio?.id === id || item.video?.id === id);
  const fields: Record<string, string> = { "catch-the-heart": "hearts", "open-when": "envelopes", "memory-quiz": "questions", "our-storybook": "pages", "cozy-playlist": "tracks" };
  if (index >= 0) return builderFieldTarget(data, "content", `${fields[data.template]}.${index}.${data.template === "cozy-playlist" ? "audio" : "title"}`);
  return { step: 2, inputId: "builder-step-fields" };
}
