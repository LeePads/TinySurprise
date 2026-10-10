import { describe, expect, it } from "vitest";
import { initialData } from "./builder-defaults";
import { countText, getAuthoringTextIssues, TEXT_LIMITS } from "./text-limits";
import { validateBasics } from "./validation";
import { summarizePackage } from "./viewer-summary";
import type { SurpriseData } from "./types";

describe("non-destructive authoring text guidance", () => {
  it("counts UTF-16 consistently and leaves long authored content untouched", () => {
    expect(countText("😀")).toBe(2);
    const data: SurpriseData = { ...initialData("catch-the-heart"),
      basics: { senderName: "😀".repeat(31), recipientName: "You", openingMessage: "Hello" },
      content: { hearts: [{ id: "one", message: "x".repeat(301) }], finalMessage: "😀\n".repeat(500), soundEffects: false },
    };
    const before = JSON.stringify(data);
    const issues = getAuthoringTextIssues(data);
    expect(issues.map(issue => [issue.field, issue.severity])).toEqual([
      ["Sender name", "error"], ["Heart 1 note", "warning"], ["Final message", "warning"],
    ]);
    expect(issues[0].count).toBe(62);
    expect(issues[0].budget).toBe(TEXT_LIMITS.name);
    expect(validateBasics(data.basics).valid).toBe(false);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("has prose guidance for all seven templates without treating URLs as prose", () => {
    const long = "a".repeat(3001);
    const cases: SurpriseData[] = [
      { ...initialData("catch-the-heart"), content: { hearts: [{ id: "h", message: long }], finalMessage: long, soundEffects: false } },
      { ...initialData("photo-puzzle"), content: { difficulty: "easy", completionMessage: long, finalMessage: long } },
      { ...initialData("open-when"), content: { envelopes: [{ id: "e", title: long, message: long }], finalMessage: long } },
      { ...initialData("choose-our-date"), content: { introMessage: long, rounds: [], result: { title: long, description: long, details: long, invitation: long } } },
      { ...initialData("memory-quiz"), content: { questions: [{ id: "q", prompt: long, answers: [long, "b"], correctIndex: 0, memoryNote: long }], finalMessage: long } },
      { ...initialData("our-storybook"), content: { pages: [{ id: "p", title: long, body: long }], finalMessage: long } },
      { ...initialData("cozy-playlist"), content: { tracks: [{ id: "t", title: long, artist: long, why: long, link: "https://example.com/" + long }], finalMessage: long } },
    ];
    for (const data of cases) {
      const issues = getAuthoringTextIssues(data);
      expect(issues.length).toBeGreaterThan(1);
      expect(issues.every(issue => issue.severity === "warning")).toBe(true);
      expect(issues.some(issue => issue.field.includes("link"))).toBe(false);
    }
    expect(summarizePackage(cases[6]).requiresInternetForExternalLinks).toBe(true);
    expect(summarizePackage(cases[6]).requiresInternetForYoutube).toBe(false);
  });
});
