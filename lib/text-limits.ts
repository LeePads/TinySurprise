import type {
  SurpriseData, CatchTheHeartContent, PhotoPuzzleContent, OpenWhenContent,
  ChooseOurDateContent, MemoryQuizContent, OurStorybookContent, CozyPlaylistContent,
} from "./types";

/** UTF-16 input limits, matching existing Basics validation. Saved values are
 * never mutated by this policy; only the existing Basics limits block export. */
export const TEXT_LIMITS = {
  name: 60, profileSignOff: 60, recipientDetail: 40, libraryTitle: 120,
  welcome: 180, note: 300, dateIntro: 300, dateQuestion: 120,
  dateTitle: 80, dateDetails: 220, title: 120, question: 200,
  answer: 120, final: 500, opening: 500, signature: 120, description: 1000, body: 3000,
} as const;
export const countText = (value: string) => value.length;
export interface TextIssue {
  field: string;
  fieldPath: string;
  inputId?: string;
  step: number;
  count: number;
  budget: number;
  severity: "warning" | "error";
  message: string;
}

export function getAuthoringTextIssues(data: SurpriseData): TextIssue[] {
  const issues: TextIssue[] = [];
  const add = (fieldPath: string, field: string, value: unknown, budget: number, step: number, inputId?: string, severity: TextIssue["severity"] = "warning") => {
    if (typeof value !== "string" || countText(value) <= budget) return;
    const count = countText(value);
    issues.push({ fieldPath, field, inputId, step, count, budget, severity,
      message: `${field}: ${count} / ${budget} character units. ${severity === "error" ? "Shorten this before creating the surprise. Your saved text and editable backup are kept intact." : "Saved text exceeds the new input limit. You can shorten it, or keep the full text in your backup and export."}`,
    });
  };
  add("basics.senderName", "Sender name", data.basics.senderName, TEXT_LIMITS.name, 1, "sender-name", "error");
  add("basics.recipientName", "Recipient name", data.basics.recipientName, TEXT_LIMITS.name, 1, "recipient-name", "error");
  add("basics.openingMessage", "Opening message", data.basics.openingMessage, TEXT_LIMITS.opening, 1, "opening-message", "error");
  add("basics.senderSignOff", "Sender sign-off", data.basics.senderSignOff, TEXT_LIMITS.profileSignOff, 1);
  add("basics.recipientNickname", "Recipient nickname", data.basics.recipientNickname, TEXT_LIMITS.recipientDetail, 1);
  add("basics.recipientRelationship", "Recipient relationship", data.basics.recipientRelationship, TEXT_LIMITS.recipientDetail, 1);
  const c = data.content;
  if (data.template === "catch-the-heart") {
    const v = c as CatchTheHeartContent;
    v.hearts.forEach((h, i) => add(`content.hearts[${i}].message`, `Heart ${i + 1} note`, h.message, TEXT_LIMITS.note, 2, `heart-note-${h.id}`));
    add("content.finalMessage", "Final message", v.finalMessage, TEXT_LIMITS.final, 2, "heart-finale");
  } else if (data.template === "photo-puzzle") {
    const v = c as PhotoPuzzleContent;
    add("content.completionMessage", "Completion message", v.completionMessage, TEXT_LIMITS.final, 2, "puzzle-complete");
    add("content.finalMessage", "Final message", v.finalMessage, TEXT_LIMITS.final, 2, "puzzle-final");
  } else if (data.template === "open-when") {
    const v = c as OpenWhenContent;
    v.envelopes.forEach((e, i) => {
      add(`content.envelopes[${i}].title`, `Letter ${i + 1} title`, e.title, TEXT_LIMITS.title, 2, `envelope-title-${e.id}`);
      add(`content.envelopes[${i}].message`, `Letter ${i + 1} message`, e.message, TEXT_LIMITS.body, 2, `envelope-message-${e.id}`);
    });
    add("content.finalMessage", "Final message", v.finalMessage, TEXT_LIMITS.final, 2, "envelope-final");
  } else if (data.template === "choose-our-date") {
    const v = c as ChooseOurDateContent;
    add("content.introMessage", "Date intro", v.introMessage, TEXT_LIMITS.dateIntro, 2, "date-intro");
    v.rounds.forEach((r, i) => {
      add(`content.rounds[${i}].question`, `Round ${i + 1} question`, r.question, TEXT_LIMITS.dateQuestion, 2, `date-question-${r.id}`);
      r.options.forEach((o, n) => {
        add(`content.rounds[${i}].options[${n}].title`, `Round ${i + 1}, choice ${n + 1} title`, o.title, TEXT_LIMITS.dateTitle, 2, `date-title-${o.id}`);
        add(`content.rounds[${i}].options[${n}].details`, `Round ${i + 1}, choice ${n + 1} details`, o.details, TEXT_LIMITS.dateDetails, 2, `date-details-${o.id}`);
      });
    });
    add("content.result.title", "Reveal title", v.result.title, TEXT_LIMITS.title, 2, "date-result-title");
    add("content.result.description", "Reveal description", v.result.description, TEXT_LIMITS.description, 2, "date-result-description");
    add("content.result.details", "Plan details", v.result.details, TEXT_LIMITS.description, 2, "date-result-details");
    add("content.result.invitation", "Invitation", v.result.invitation, TEXT_LIMITS.final, 2, "date-invitation");
  } else if (data.template === "memory-quiz") {
    const v = c as MemoryQuizContent;
    v.questions.forEach((q, i) => {
      add(`content.questions[${i}].prompt`, `Question ${i + 1}`, q.prompt, TEXT_LIMITS.question, 2, `quiz-question-${q.id}`);
      q.answers.forEach((a, n) => add(`content.questions[${i}].answers[${n}]`, `Question ${i + 1}, answer ${n + 1}`, a, TEXT_LIMITS.answer, 2, `quiz-answer-${q.id}-${n}`));
      add(`content.questions[${i}].memoryNote`, `Question ${i + 1} memory`, q.memoryNote, TEXT_LIMITS.description, 2, `quiz-note-${q.id}`);
    });
    add("content.finalMessage", "Final message", v.finalMessage, TEXT_LIMITS.final, 2, "quiz-final");
  } else if (data.template === "our-storybook") {
    const v = c as OurStorybookContent;
    v.pages.forEach((p, i) => {
      add(`content.pages[${i}].title`, `Chapter ${i + 1} title`, p.title, TEXT_LIMITS.title, 2, `chapter-title-${p.id}`);
      add(`content.pages[${i}].body`, `Chapter ${i + 1} body`, p.body, TEXT_LIMITS.body, 2, `chapter-body-${p.id}`);
    });
    add("content.finalMessage", "Final message", v.finalMessage, TEXT_LIMITS.final, 2, "storybook-final");
  } else if (data.template === "cozy-playlist") {
    const v = c as CozyPlaylistContent;
    v.tracks.forEach((t, i) => {
      add(`content.tracks[${i}].title`, `Song ${i + 1} title`, t.title, TEXT_LIMITS.title, 2, `track-title-${t.id}`);
      add(`content.tracks[${i}].artist`, `Song ${i + 1} artist`, t.artist, TEXT_LIMITS.title, 2, `track-artist-${t.id}`);
      add(`content.tracks[${i}].why`, `Song ${i + 1} reason`, t.why, TEXT_LIMITS.description, 2, `track-why-${t.id}`);
    });
    add("content.finalMessage", "Final message", v.finalMessage, TEXT_LIMITS.final, 2, "playlist-final");
  }
  add("delight.coverMessage", "Welcome note", data.delight?.coverMessage, TEXT_LIMITS.welcome, 4, "cover-message");
  add("delight.passphraseQuestion", "Secret question", data.delight?.passphraseQuestion, TEXT_LIMITS.question, 4, "secret-question");
  const choiceMode = data.delight?.passphraseMode === "choice";
  const answerInput = choiceMode ? `secret-choice-${data.delight?.passphraseCorrectChoiceIndex ?? 0}` : "secret-answer";
  add("delight.passphrase", "Secret answer", data.delight?.passphrase, TEXT_LIMITS.answer, 4, answerInput);
  data.delight?.passphraseChoices?.forEach((value, i) => add(`delight.passphraseChoices[${i}]`, `Secret choice ${i + 1}`, value, TEXT_LIMITS.answer, 4, choiceMode ? `secret-choice-${i}` : undefined));
  data.delight?.passphraseAnswers?.forEach((value, i) => add(`delight.passphraseAnswers[${i}]`, `Accepted answer ${i + 1}`, value, TEXT_LIMITS.answer, 4, i === 0 ? answerInput : undefined));
  add("delight.closingMessage", "Closing message", data.delight?.closingMessage, TEXT_LIMITS.final, 4);
  add("delight.signature", "Signature", data.delight?.signature, TEXT_LIMITS.signature, 4);
  return issues;
}
