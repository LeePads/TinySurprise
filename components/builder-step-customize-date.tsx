"use client";
import { useReviewField } from "@/lib/review-field";
import { TEXT_LIMITS } from "@/lib/text-limits";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ImagePicker } from "./image-picker";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { createStableId } from "@/lib/local-media";
import type { ChooseOurDateContent, DateOption, DateRound } from "@/lib/types";
import { normalizeChooseOurDateIds } from "@/lib/choose-our-date";
import { BuilderWorkspace } from "./builder-workspace";
import { getTemplateExperienceDefinition } from "@/lib/template-experience-definitions";
import { BuilderItemActions } from "./builder-item-actions";

const newOption = (): DateOption => ({
  id: createStableId("date-option"),
  title: "",
  details: "",
});
const newRound = (): DateRound => ({
  id: createStableId("date-round"),
  question: "",
  options: [newOption(), newOption()],
});
const Missing = ({
  show,
  message,
  id,
}: {
  show: boolean;
  message: string;
  id?: string;
}) => (show ? <InlineFieldMessage id={id} message={message} /> : null);
const isCompleteRound = (round: DateRound) => Boolean(round.question.trim() && round.options.length >= 2 && round.options.every(option => option.title.trim()));

export function StepCustomizeDate({
  data,
  onUpdate,
}: {
  data: Partial<ChooseOurDateContent>;
  onUpdate: (value: Partial<ChooseOurDateContent>) => void;
}) {
  const content = normalizeChooseOurDateIds({
    introMessage: "",
    rounds: [],
    result: { title: "", description: "", details: "", invitation: "" },
    ...data,
  }) as ChooseOurDateContent;
  const [showErrors, setShowErrors] = useState(false);
  const [addedNotice, setAddedNotice] = useState("");
  const [activeRound, setActiveRound] = useState<string | null>(() => (content.rounds.find(round => !isCompleteRound(round)) || content.rounds[0])?.id ?? null);
  const [optionalChoices, setOptionalChoices] = useState<Set<string>>(new Set());
  const [revealDetailsOpen, setRevealDetailsOpen] = useState(false);
  const setChoiceDetails = (id: string, open: boolean) => setOptionalChoices(previous => {
    if (previous.has(id) === open) return previous;
    const next = new Set(previous);
    if (open) next.add(id); else next.delete(id);
    return next;
  });
  useReviewField(id => {
    const item = content.rounds.find(round => id.includes(round.id) || round.options.some(option => id.includes(option.id)));
    if (item) {
      setActiveRound(item.id);
      const option = item.options.find(option => id.includes(option.id));
      if (option && !id.startsWith("date-title-")) setChoiceDetails(option.id, true);
    }
    if (id.startsWith("date-result-")) setRevealDetailsOpen(true);
  });
  const roundLimits = getTemplateExperienceDefinition("choose-our-date").limits.nested?.rounds;
  const recommendedMaxRounds = roundLimits?.recommendedMax || 3;
  const compatibilityMaxRounds = roundLimits?.compatibilityMax || recommendedMaxRounds;
  const maxRounds = content.rounds.length > recommendedMaxRounds ? compatibilityMaxRounds : recommendedMaxRounds;
  useEffect(() => {
    const show = () => setShowErrors(true);
    window.addEventListener("tiny-validation-attempted", show);
    return () => window.removeEventListener("tiny-validation-attempted", show);
  }, []);
  useEffect(() => {
    const revealFirstInvalid = () => {
      const firstInvalid = content.rounds.find(
        (round) =>
          !isCompleteRound(round),
      );
      if (firstInvalid) setActiveRound(firstInvalid.id);
    };
    window.addEventListener("tiny-validation-attempted", revealFirstInvalid);
    return () =>
      window.removeEventListener(
        "tiny-validation-attempted",
        revealFirstInvalid,
      );
  }, [content.rounds]);
  const updateRound = (id: string, value: Partial<DateRound>) =>
    onUpdate({
      rounds: content.rounds.map((round) =>
        round.id === id ? { ...round, ...value } : round,
      ),
    });
  const updateOption = (
    roundId: string,
    id: string,
    value: Partial<DateOption>,
  ) =>
    onUpdate({
      rounds: content.rounds.map((round) =>
        round.id === roundId
          ? {
              ...round,
              options: round.options.map((option) =>
                option.id === id ? { ...option, ...value } : option,
              ),
            }
          : round,
      ),
    });
  const moveRound = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= content.rounds.length) return;
    const rounds = [...content.rounds];
    [rounds[index], rounds[target]] = [rounds[target], rounds[index]];
    onUpdate({ rounds });
  };
  return (
    <BuilderWorkspace className="builder-workspace--customize">
    <div className="space-y-7">
      <section className="border-b border-border/70 pb-5">
        <h3 className="text-lg font-semibold">Choose Our Date</h3>
        <p className="mt-1 text-sm text-muted-foreground">They pick one choice in each question, then see your invitation.</p>
      </section>
      <div>
        <label
          className="mb-2 block text-sm font-semibold"
          htmlFor="date-intro"
        >
          Opening invitation <span className="text-primary">*</span>
        </label>
        <Textarea textBudget={TEXT_LIMITS.dateIntro}
          id="date-intro"
          value={content.introMessage}

          onChange={(e) => onUpdate({ introMessage: e.target.value })}
          placeholder="I planned a little adventure for us..."
          aria-invalid={showErrors && !content.introMessage.trim()}
          aria-describedby={
            showErrors && !content.introMessage.trim()
              ? "date-intro-error"
              : undefined
          }
        />
        <p className="mt-2 text-sm text-muted-foreground">Welcome them to the date you have in mind.</p>
        <Missing
          show={showErrors && !content.introMessage.trim()}
          id="date-intro-error"
          message="Add an opening invitation."
        />
      </div>
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Your questions</h3>
        <p className="text-sm text-muted-foreground">Add at least two questions, with at least two choices each.</p>
        {content.rounds.map((round, roundIndex) => (
          <section
            key={round.id}
            className="space-y-4 border-t border-primary/20 py-5"
          >
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="min-h-12 min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-primary" aria-expanded={activeRound === round.id} aria-controls={`date-round-fields-${round.id}`} onClick={() => setActiveRound(activeRound === round.id ? null : round.id)}>
                <span className="block break-words font-semibold">Question {roundIndex + 1} · {round.question.trim() || "Add a question"}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{round.options.length} choices · {isCompleteRound(round) ? "Complete" : "Needs a question or choice names"}</span>
              </button>
              <BuilderItemActions
                itemLabel="Question"
                index={roundIndex}
                canMoveEarlier={roundIndex > 0}
                canMoveLater={roundIndex < content.rounds.length - 1}
                canRemove={content.rounds.length > 2}
                onMoveEarlier={() => moveRound(roundIndex, -1)}
                onMoveLater={() => moveRound(roundIndex, 1)}
                onRemove={() => {
                  onUpdate({
                    rounds: content.rounds.filter(
                      (item) => item.id !== round.id,
                    ),
                  });
                  if (activeRound === round.id) setActiveRound(null);
                }}
              />
            </div>
            <div id={`date-round-fields-${round.id}`} hidden={activeRound !== round.id} className="space-y-4">
            <div>
              <label
                className="mb-2 block text-sm font-semibold"
                htmlFor={`date-question-${round.id}`}
              >
                Question <span className="text-primary">*</span>
              </label>
              <Input textBudget={TEXT_LIMITS.dateQuestion}
                id={`date-question-${round.id}`}
                value={round.question}

                onChange={(e) =>
                  updateRound(round.id, { question: e.target.value })
                }
                placeholder="What kind of mood are you feeling?"
                aria-invalid={showErrors && !round.question.trim()}
                aria-describedby={
                  showErrors && !round.question.trim()
                    ? "date-question-error-" + round.id
                    : undefined
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">For example: “Where should we go?” with choices “A picnic” and “Our favorite café”.</p>
              <Missing
                show={showErrors && !round.question.trim()}
                id={"date-question-error-" + round.id}
                message="Add a question."
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {round.options.map((option, optionIndex) => (
                <article
                  key={option.id}
                  className="space-y-3 rounded-xl border border-border/70 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      Choice {optionIndex + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={round.options.length <= 2}
                      aria-label={`Remove choice ${optionIndex + 1} from question ${roundIndex + 1}`}
                      onClick={() =>
                        updateRound(round.id, {
                          options: round.options.filter(
                            (item) => item.id !== option.id,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      htmlFor={`date-title-${option.id}`}
                    >
                      Choice name <span className="text-primary">*</span>
                    </label>
                    <Input textBudget={TEXT_LIMITS.dateTitle}
                      id={`date-title-${option.id}`}
                      value={option.title}

                      onChange={(e) =>
                        updateOption(round.id, option.id, {
                          title: e.target.value,
                        })
                      }
                      placeholder="A slow, dreamy evening"
                      aria-invalid={showErrors && !option.title.trim()}
                      aria-describedby={
                        showErrors && !option.title.trim()
                          ? "date-title-error-" + option.id
                          : undefined
                      }
                    />
                    <Missing
                      show={showErrors && !option.title.trim()}
                      id={"date-title-error-" + option.id}
                      message="Add a choice name."
                    />
                  </div>
                  <details open={optionalChoices.has(option.id)} onToggle={event => setChoiceDetails(option.id, event.currentTarget.open)} className="border-t border-border/70 pt-1">
                    <summary className="min-h-12 cursor-pointer py-3 text-sm font-medium">Details &amp; photo <span className="font-normal text-muted-foreground">(optional){option.photo ? " · Photo attached" : ""}</span></summary>
                    <div className="space-y-3 pt-2">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      htmlFor={`date-details-${option.id}`}
                    >
                      What makes it special <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea textBudget={TEXT_LIMITS.dateDetails}
                      id={`date-details-${option.id}`}
                      value={option.details}

                      onChange={(e) =>
                        updateOption(round.id, option.id, {
                          details: e.target.value,
                        })
                      }
                      placeholder="A sunset, a blanket, and our favorite snacks."
                    />
                  </div>
                  <label className="flex min-h-12 items-center gap-3 rounded-xl bg-secondary/35 px-3 text-sm font-medium">
                    <input id={`date-decides-${option.id}`} type="checkbox" aria-describedby={`date-decides-help-${option.id}`} checked={option.kind === "recipient-decides"} onChange={(event) => updateOption(round.id, option.id, { kind: event.target.checked ? "recipient-decides" : "choice" })} />
                    Let them decide this part
                  </label>
                  <p id={`date-decides-help-${option.id}`} className="text-xs text-muted-foreground">This choice leaves the details up to them.</p>
                  <div id={`date-photo-${option.id}`} tabIndex={-1}>
                  <ImagePicker
                    label="Memory photo (optional)"
                    adjustLabel="Adjust memory photo"
                    frameAspect="16 / 9"
                    value={option.photo}
                    onChange={(photo) =>
                      updateOption(round.id, option.id, { photo: photo ? { ...photo, presentation: photo.presentation || { mode: "fill" } } : undefined })
                    }
                  />
                  </div>
                    </div>
                  </details>
                </article>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={round.options.length >= 4}
              onClick={() =>
                updateRound(round.id, {
                  options: [...round.options, newOption()],
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add choice
            </Button>
            </div>
          </section>
        ))}
      </div>
      <Missing
        show={showErrors && (content.rounds.length < 2 || content.rounds.length > maxRounds)}
        id="date-rounds-error"
        message={`Add between 2 and ${maxRounds} questions, each with at least two choices, before continuing.`}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={content.rounds.length >= maxRounds}
        onClick={() => {
          const round = newRound();
          onUpdate({ rounds: [...content.rounds, round] });
          setActiveRound(round.id);
          setAddedNotice("Question added.");
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add question
      </Button>
      {addedNotice && (
        <p className="text-sm text-primary" role="status" aria-live="polite">
          {addedNotice}
        </p>
      )}
      <section className="space-y-4 border-t border-primary/20 pt-5">
        <div>
          <h3 className="text-lg font-semibold">Final reveal</h3>
          <p className="mt-1 text-sm text-muted-foreground">They’ll see this invitation after choosing their answers.</p>
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="date-invitation"
          >
            Final invitation <span className="text-primary">*</span>
          </label>
          <Textarea textBudget={TEXT_LIMITS.final}
            id="date-invitation"
            value={content.result.invitation}
            onChange={(e) =>
              onUpdate({
                result: { ...content.result, invitation: e.target.value },
              })
            }
            placeholder="It’s a date. I can’t wait."
            aria-invalid={showErrors && !content.result.invitation.trim()}
            aria-describedby={
              showErrors && !content.result.invitation.trim()
                ? "date-invitation-error"
                : undefined
            }
          />
          <Missing
            show={showErrors && !content.result.invitation.trim()}
            id="date-invitation-error"
            message="Add the final invitation before continuing."
          />
        </div>
        <details open={revealDetailsOpen} onToggle={event => setRevealDetailsOpen(event.currentTarget.open)} className="rounded-2xl border border-border/70 p-4">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold">Reveal details <span className="font-normal text-muted-foreground">(optional)</span></summary>
          <div className="space-y-4 pt-3">
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="date-result-title"
          >
            Reveal title <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input textBudget={TEXT_LIMITS.title}
            id="date-result-title"
            value={content.result.title}
            onChange={(e) =>
              onUpdate({ result: { ...content.result, title: e.target.value } })
            }
            placeholder="Our perfect little date"
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="date-result-description"
          >
            Reveal description <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea textBudget={TEXT_LIMITS.description}
            id="date-result-description"
            value={content.result.description}
            onChange={(e) =>
              onUpdate({
                result: { ...content.result, description: e.target.value },
              })
            }
            placeholder="The choices are in—and this feels perfectly us."
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="date-result-details"
          >
            Plan details <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea textBudget={TEXT_LIMITS.description}
            id="date-result-details"
            value={content.result.details}
            onChange={(e) =>
              onUpdate({
                result: { ...content.result, details: e.target.value },
              })
            }
            placeholder="I’ll bring the snacks; you bring that smile."
          />
        </div>
          </div>
        </details>
      </section>
    </div>
    </BuilderWorkspace>
  );
}
