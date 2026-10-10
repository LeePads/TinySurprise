"use client";
import { useReviewField } from "@/lib/review-field";
import { TEXT_LIMITS } from "@/lib/text-limits";

import { Brain, CheckCircle2, Circle, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ImagePicker } from "./image-picker";
import { createStableId } from "@/lib/local-media";
import type { MemoryQuizContent, QuizQuestion } from "@/lib/types";
import { useValidationAttempted } from "@/lib/use-validation-attempted";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { BuilderWorkspace } from "./builder-workspace";
import { getTemplateExperienceDefinition } from "@/lib/template-experience-definitions";
import { BuilderItemActions } from "./builder-item-actions";
export function StepCustomizeQuiz({
  data,
  onUpdate,
}: {
  data: Partial<MemoryQuizContent>;
  onUpdate: (v: Partial<MemoryQuizContent>) => void;
}) {
  const c = { questions: [], finalMessage: "", ...data };
  const showErrors = useValidationAttempted();
  const limits = getTemplateExperienceDefinition("memory-quiz").limits;
  const recommendedMax = limits.recommendedMax || 6;
  const compatibilityMax = limits.compatibilityMax || recommendedMax;
  const maxQuestions = c.questions.length > recommendedMax ? compatibilityMax : recommendedMax;
  const [addedNotice, setAddedNotice] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | undefined>(
    undefined,
  );
  const addQuestionRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<string | "add" | undefined>(undefined);
  const activeId =
    activeQuestion && c.questions.some((question) => question.id === activeQuestion)
      ? activeQuestion
      : undefined;
  const expandedId = activeId || c.questions[0]?.id;
  useReviewField(id => { const item = c.questions.find(item => id.includes(item.id)); if (item) setActiveQuestion(item.id); });
  useEffect(() => {
    const revealFirstInvalid = () => {
      const firstInvalid = c.questions.find(
        (question) =>
          !question.prompt.trim() ||
          question.answers.filter((answer) => answer.trim()).length < 2 ||
          !question.answers[question.correctIndex]?.trim(),
      );
      if (firstInvalid) setActiveQuestion(firstInvalid.id);
    };
    window.addEventListener("tiny-validation-attempted", revealFirstInvalid);
    return () =>
      window.removeEventListener(
        "tiny-validation-attempted",
        revealFirstInvalid,
      );
  }, [c.questions]);
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      if (target === "add") {
        addQuestionRef.current?.focus();
      } else {
        const questionField = document.getElementById(`quiz-question-${target}`);
        if (questionField) questionField.focus();
        else return;
      }
      pendingFocusRef.current = undefined;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, c.questions]);
  const update = (id: string, v: Partial<QuizQuestion>) =>
    onUpdate({
      questions: c.questions.map((q) => (q.id === id ? { ...q, ...v } : q)),
    });
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= c.questions.length) return;
    const questions = [...c.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    onUpdate({ questions });
  };
  return (
    <BuilderWorkspace className="builder-workspace--customize">
    <div className="space-y-6">
      <section className="flex gap-3 border-b border-border/70 pb-4">
        <Brain className="text-primary" />
        <div>
          <h3 className="font-semibold">
            Turn shared moments into a playful quiz
          </h3>
          <p className="text-sm text-muted-foreground">
            Add at least two answers per question, then mark the correct one.
          </p>
        </div>
      </section>
      {c.questions.map((q, index) => (
        <section
          key={q.id}
          className="space-y-4 border-t border-border/70 pt-5"
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <button type="button" className="min-h-12 min-w-0 flex-1 text-left font-semibold [overflow-wrap:anywhere]" aria-expanded={expandedId === q.id} onClick={() => setActiveQuestion(expandedId === q.id ? undefined : q.id)}>Question {index + 1} · {q.prompt.trim() || "Add a question"}</button>
            <BuilderItemActions
              itemLabel="Question"
              index={index}
              canMoveEarlier={index > 0}
              canMoveLater={index < c.questions.length - 1}
              canRemove={c.questions.length > 3}
              onMoveEarlier={() => move(index, -1)}
              onMoveLater={() => move(index, 1)}
              onRemove={() => {
                const questions = c.questions.filter(
                  (_, candidateIndex) => candidateIndex !== index,
                );
                const fallback =
                  questions[index] || questions[index - 1] || questions[0];
                pendingFocusRef.current = fallback?.id || "add";
                setActiveQuestion(fallback?.id);
                onUpdate({ questions });
              }}
            />
          </div>
          {expandedId === q.id && <>
          <label
            className="block text-sm font-medium"
            htmlFor={`quiz-question-${q.id}`}
          >
            Question {index + 1} <span className="text-primary">*</span>
          </label>
          <Input textBudget={TEXT_LIMITS.question}
            id={`quiz-question-${q.id}`}
            value={q.prompt}
            onChange={(e) => update(q.id, { prompt: e.target.value })}
            placeholder="Where did we first meet?"
            aria-invalid={showErrors && !q.prompt.trim()}
            aria-describedby={
              showErrors && !q.prompt.trim()
                ? "quiz-question-error-" + q.id
                : undefined
            }
          />
          {showErrors && !q.prompt.trim() && (
            <InlineFieldMessage
              id={"quiz-question-error-" + q.id}
              message={`Add question ${index + 1} before continuing.`}
            />
          )}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Question {index + 1} answer choices{" "}
              <span className="text-primary">*</span>
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {q.answers.map((answer, i) => {
                const selected = q.correctIndex === i;
                return (
                  <div
                    key={i}
                    className={`rounded-xl p-3 ${selected ? "border border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-secondary/20"}`}
                  >
                    <label
                      className="block text-xs font-medium"
                      htmlFor={`quiz-answer-${q.id}-${i}`}
                    >
                      Answer {i + 1}
                    </label>
                    <Input textBudget={TEXT_LIMITS.answer}
                      id={`quiz-answer-${q.id}-${i}`}
                      className="mt-2"
                      value={answer}
                      onChange={(e) =>
                        update(q.id, {
                          answers: q.answers.map((x, n) =>
                            n === i ? e.target.value : x,
                          ),
                        })
                      }
                      aria-invalid={
                        showErrors &&
                        q.answers.filter((value) => value.trim()).length < 2 &&
                        !answer.trim()
                      }
                      aria-describedby={
                        showErrors &&
                        q.answers.filter((value) => value.trim()).length < 2 &&
                        !answer.trim()
                          ? "quiz-answers-error-" + q.id
                          : undefined
                      }
                    />
                    <button
                      type="button"
                      onClick={() => update(q.id, { correctIndex: i })}
                      aria-pressed={selected}
                      aria-describedby={
                        showErrors &&
                        !q.answers[q.correctIndex]?.trim() &&
                        Boolean(answer.trim()) &&
                        i === q.answers.findIndex((value) => value.trim())
                          ? "quiz-correct-error-" + q.id
                          : undefined
                      }
                      className={`mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ${selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
                    >
                      {selected ? <CheckCircle2 /> : <Circle />}
                      {selected ? "Correct answer" : "Mark as correct"}
                    </button>
                  </div>
                );
              })}
            </div>
            {showErrors && q.answers.filter((answer) => answer.trim()).length < 2 && (
              <InlineFieldMessage
                id={"quiz-answers-error-" + q.id}
                message={`Add at least two answer choices for question ${index + 1}.`}
              />
            )}
            {showErrors && !q.answers[q.correctIndex]?.trim() && (
              <InlineFieldMessage
                id={"quiz-correct-error-" + q.id}
                message={`Mark a filled answer as correct for question ${index + 1}.`}
              />
            )}
          </fieldset>
          <label
            className="block text-sm font-medium"
            htmlFor={`quiz-note-${q.id}`}
          >
            Message after question {index + 1} (optional)
          </label>
          <Textarea textBudget={TEXT_LIMITS.description}
            id={`quiz-note-${q.id}`}
            value={q.memoryNote}
            onChange={(e) => update(q.id, { memoryNote: e.target.value })}
            placeholder="The sweet story shown after they answer…"
          />
          <ImagePicker
            adjustLabel="Adjust quiz photo"
            frameAspect="4 / 3"
            label={`Question ${index + 1} photo (optional)`}
            value={q.photo}
            onChange={(photo) => update(q.id, { photo })}
          />
          </>}
        </section>
      ))}
      {showErrors && (c.questions.length < 3 || c.questions.length > maxQuestions) && (
        <InlineFieldMessage
          id="quiz-count-error"
          message={`Add between 3 and ${maxQuestions} questions before continuing.`}
        />
      )}
      <Button
        type="button"
        variant="outline"
        ref={addQuestionRef}
        disabled={c.questions.length >= maxQuestions}
        onClick={() => {
          const id = createStableId("quiz");
          pendingFocusRef.current = id;
          setActiveQuestion(id);
          onUpdate({
            questions: [
              ...c.questions,
              {
                id,
                prompt: "",
                answers: ["", "", ""],
                correctIndex: 0,
                memoryNote: "",
              },
            ],
          });
          setAddedNotice("Question added. Write your question and answers.");
        }}
      >
        <Plus className="mr-2" />
        Add question
      </Button>
      {addedNotice && (
        <p className="text-sm text-primary" role="status" aria-live="polite">
          {addedNotice}
        </p>
      )}
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="quiz-final">
          Final quiz message <span className="text-primary">*</span>
        </label>
        <Textarea textBudget={TEXT_LIMITS.final}
          id="quiz-final"
          value={c.finalMessage}
          onChange={(e) => onUpdate({ finalMessage: e.target.value })}
          placeholder="Final message after the quiz"
          aria-invalid={showErrors && !c.finalMessage.trim()}
          aria-describedby={
            showErrors && !c.finalMessage.trim()
              ? "quiz-final-error"
              : undefined
          }
        />
        {showErrors && !c.finalMessage.trim() && (
          <InlineFieldMessage
            id="quiz-final-error"
            message="Add the final quiz message before continuing."
          />
        )}
      </div>
    </div>
    </BuilderWorkspace>
  );
}
