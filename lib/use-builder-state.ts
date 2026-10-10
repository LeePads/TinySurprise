"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TEMPLATES } from "./config";
import {
  collectLocalAudio,
  collectLocalImages,
  collectLocalVideos,
  createStableId,
  revokeImagesRemovedFromState,
  revokeLocalAudio,
  revokeLocalImage,
  revokeLocalVideo,
} from "./local-media";
import { initialData } from "./builder-defaults";
import type {
  CatchTheHeartContent,
  ChooseOurDateContent,
  MemoryQuizContent,
  OpenWhenContent,
  PhotoPuzzleContent,
  SurpriseAppearance,
  SurpriseBasics,
  SurpriseData,
  SurpriseDelight,
  SurpriseDelivery,
  SurpriseMusic,
  TemplateType,
  OurStorybookContent,
  WishUponAStarContent,
  CozyPlaylistContent,
} from "./types";
import {
  validateAppearance,
  validateBasics,
  validateContent,
  validateDelight,
} from "./validation";
import {
  DraftConflictError,
  commitEditSession,
  createOrLoadEditSession,
  createCreation,
  discardEditSession,
  deleteCreation,
  getCreationDeletionGuard,
  DraftDeletionConflictError,
  getCreation,
  loadCreationDraft,
  resetCreationDraft,
  restoreDraftBackup,
  resetEditSessionDraft,
  saveCreationDraft,
  saveEditSessionDraft,
} from "./creations";
import type { BuilderEntryMode, DraftWriteGuard } from "./creations";
import { hapticTap } from "./native/haptics";
import { localSaveFailureMessage } from "./local-save-error";
import type { ContentLimitPolicy } from "./template-experience-definitions";

const DRAFT_SAVE_DELAY_MS = 1400;

/**
 * Take the creator straight to the field that actually failed.
 *
 * Two things used to send this to the top of the step instead:
 *
 *  - It only ever looked for `[role="alert"]`. An invalid control inside a
 *    collapsed disclosure (Delivery's "Optional extras", which hides the whole
 *    secret-question block) renders no alert at all, so nothing was found.
 *  - When nothing was found it fell back to `section.querySelector("input,
 *    textarea, select, button")` — the first control in the entire step. That
 *    fallback *was* the reported "scrolls to the top" behaviour.
 *
 * Now `aria-invalid="true"` is the primary anchor, the alert is only a
 * secondary hint, and there is no scroll-to-top fallback: if no invalid field
 * is on screen we leave the viewport where the creator left it.
 */
function focusFirstInvalidField() {
  const section = document.querySelector<HTMLElement>(".builder-step-content");
  if (!section) return;

  const isVisible = (element: HTMLElement) =>
    element.getClientRects().length > 0 &&
    window.getComputedStyle(element).visibility !== "hidden";
  const invalid = Array.from(
    section.querySelectorAll<HTMLElement>(
      '[aria-invalid="true"]:not([aria-invalid="false"])',
    ),
  ).find(isVisible);
  const alert = Array.from(
    section.querySelectorAll<HTMLElement>('[role="alert"]'),
  ).find(isVisible);
  const describedField = alert?.id
    ? Array.from(
        section.querySelectorAll<HTMLElement>("[aria-describedby]"),
      ).find((element) =>
        element
          .getAttribute("aria-describedby")
          ?.split(/\s+/)
          .includes(alert.id),
      )
    : undefined;
  const field = invalid || describedField;
  const scrollTarget = field || alert;
  if (!scrollTarget) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  // block:"center" keeps the field clear of both the sticky step header and
  // the sticky bottom nav (and, on Android, the on-screen keyboard) without
  // hard-coding an offset for either.
  scrollTarget.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "center",
  });
  if (
    field &&
    !field.hasAttribute("disabled") &&
    typeof field.focus === "function"
  ) {
    field.focus({ preventScroll: true });
  }
}

export function useBuilderState(
  templateId: string,
  options?: { creationId?: string; onCreationId?: (id: string) => void },
) {
  const template = TEMPLATES[templateId];
  const templateType = templateId as TemplateType;
  const requestedCreationId = options?.creationId;
  const onCreationId = options?.onCreationId;
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<SurpriseData>(() =>
    initialData(templateType),
  );
  const dataRef = useRef(data);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState<
    "loading" | "restored" | "saving" | "saved" | "unavailable"
  >("loading");
  const [draftSavedAt, setDraftSavedAt] = useState<number>();
  const [validationPolicy, setValidationPolicy] =
    useState<ContentLimitPolicy>("recommended");
  const [activeCreationId, setActiveCreationId] = useState<string>();
  const [entryMode, setEntryMode] = useState<BuilderEntryMode>("new");
  const [entryError, setEntryError] = useState<string>();
  const [draftError, setDraftError] = useState<string>();
  const activeCreationIdRef = useRef<string | undefined>(undefined);
  const editSessionCommittedRef = useRef(false);
  const currentStepRef = useRef(currentStep);
  const mountedRef = useRef(true);
  const logicalRevisionRef = useRef(0);
  const writeGuardRef = useRef<DraftWriteGuard>({ revision: 0 });
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [saveConflict, setSaveConflict] = useState(false);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const onCreationIdRef = useRef(onCreationId);
  useEffect(() => {
    onCreationIdRef.current = onCreationId;
  }, [onCreationId]);
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Every builder session operates on exactly one "My Surprises" creation.
  // If the page didn't already know which one (a fresh "Create" tap), a
  // creation is minted here and its id is reported back via onCreationId so
  // the URL can be updated — every save after that targets a stable record
  // instead of silently overwriting whatever else used this template.
  useEffect(() => {
    let cancelled = false;
    setDraftReady(false);
    setDraftStatus("loading");
    setEntryError(undefined);
    setDraftError(undefined);
    setEntryMode("new");
    setValidationPolicy("recommended");
    editSessionCommittedRef.current = false;
    logicalRevisionRef.current += 1;

    const resolve = async () => {
      if (!requestedCreationId) {
        const created = await createCreation(templateType);
        return {
          id: created.id,
          draft: undefined as Awaited<ReturnType<typeof loadCreationDraft>>,
          mode: "new" as const,
        };
      }
      const creation = await getCreation(requestedCreationId);
      if (!creation)
        throw new Error(
          "This surprise is unavailable or damaged. Return to My Surprises and choose another one.",
        );
      if (creation.templateId !== templateType)
        throw new Error(
          "This surprise belongs to a different template. Return to My Surprises to open it safely.",
        );
      if (creation.status === "imported")
        throw new Error(
          "Received surprises stay view-only here. Use Save and edit from My Surprises to make a separate copy.",
        );
      if (creation.status === "completed") {
        const session = await createOrLoadEditSession(requestedCreationId);
        return {
          id: requestedCreationId,
          draft: session,
          mode: "edit-created" as const,
        };
      }
      const draft = await loadCreationDraft(requestedCreationId);
      if (!draft)
        throw new Error(
          "This saved draft could not be restored safely. Return to My Surprises and try another surprise.",
        );
      return {
        id: requestedCreationId,
        draft,
        mode: "draft" as const,
      };
    };

    void resolve()
      .then(({ id, draft, mode }) => {
        if (cancelled) {
          if (mode === "new") {
            void getCreationDeletionGuard(id).then(guard => {
              if (guard.status !== "draft" || guard.revision !== 0) return;
              return deleteCreation(id, guard);
            }).catch(() => undefined);
          }
          if (draft) {
            collectLocalImages(draft.data).forEach(revokeLocalImage);
            collectLocalVideos(draft.data).forEach(revokeLocalVideo);
            collectLocalAudio(draft.data).forEach(revokeLocalAudio);
          }
          return;
        }
        writeGuardRef.current = { revision: draft?.revision ?? 0, sessionId: draft && "sessionId" in draft ? draft.sessionId : undefined };
        setSaveConflict(false);
        activeCreationIdRef.current = id;
        setActiveCreationId(id);
        setEntryMode(mode);
        editSessionCommittedRef.current = false;
        if (id !== requestedCreationId) onCreationIdRef.current?.(id);
        if (draft) {
          setValidationPolicy("compatibility");
          revokeImagesRemovedFromState(dataRef.current, draft.data);
          dataRef.current = draft.data;
          setData(draft.data);
          setCurrentStep(Math.min(5, Math.max(1, draft.step)));
          setDraftSavedAt(Date.now());
          setDraftStatus(mode === "edit-created" ? "restored" : "restored");
        } else {
          setValidationPolicy("recommended");
          const next = initialData(templateType);
          revokeImagesRemovedFromState(dataRef.current, next);
          dataRef.current = next;
          setData(next);
          setCurrentStep(1);
          setDraftStatus("saved");
        }
        setDraftReady(true);
      })
      .catch((reason) => {
        if (!cancelled) {
          setEntryError(
            localSaveFailureMessage(reason, reason instanceof Error
              ? reason.message
              : "This builder entry could not be opened safely. Your original surprise was not changed."),
          );
          setDraftStatus("unavailable");
          setDraftReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [templateType, requestedCreationId]);
  const isEditSession = entryMode === "edit-created";
  const persistSnapshot = useCallback(
    async (snapshot: SurpriseData, step: number, revision: number) => {
      if (
        !draftReady ||
        !activeCreationIdRef.current ||
        editSessionCommittedRef.current
      )
        return false;
      if (mountedRef.current) setDraftStatus("saving");
      if (mountedRef.current) setDraftError(undefined);
      try {
        const ownerId = activeCreationIdRef.current;
        const guard = writeGuardRef.current;
        const operation = saveQueueRef.current.catch(() => undefined).then(async () => {
          const savedAt = isEditSession
            ? await saveEditSessionDraft(ownerId, snapshot, step, { ...guard })
            : await saveCreationDraft(ownerId, snapshot, step, { ...guard });
          guard.revision += 1;
          return savedAt;
        });
        saveQueueRef.current = operation;
        const savedAt = await operation;
        if (mountedRef.current && revision === logicalRevisionRef.current) {
          setDraftSavedAt(savedAt);
          setDraftStatus("saved");
        }
        return true;
      } catch (error) {
        if (mountedRef.current && error instanceof DraftConflictError) setSaveConflict(true);
        if (mountedRef.current && revision === logicalRevisionRef.current)
          setDraftStatus("unavailable");
        if (mountedRef.current && revision === logicalRevisionRef.current)
          setDraftError(
            error instanceof DraftConflictError
              ? error.message
              : localSaveFailureMessage(error, "Your latest changes could not be saved. Keep this page open and try again."),
          );
        throw error;
      }
    },
    [draftReady, isEditSession],
  );
  const flushPendingSave = useCallback(async () => {
    if (
      !draftReady ||
      !activeCreationIdRef.current ||
      editSessionCommittedRef.current
    )
      return true;
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    try {
      // Editing can continue while IndexedDB commits. Flush the latest state too.
      let savedData: SurpriseData;
      let savedStep: number;
      do {
        if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
        savedData = dataRef.current;
        savedStep = currentStepRef.current;
        const revision = ++logicalRevisionRef.current;
        await persistSnapshot(structuredClone(savedData), savedStep, revision);
      } while (savedData !== dataRef.current || savedStep !== currentStepRef.current);
      return true;
    } catch {
      return false;
    }
  }, [draftReady, persistSnapshot]);
  useEffect(() => {
    if (!draftReady || !activeCreationId || data.template !== templateType)
      return;
    const revision = ++logicalRevisionRef.current;
    const snapshot = structuredClone(data);
    if (mountedRef.current) setDraftStatus("saving");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = undefined;
      void persistSnapshot(snapshot, currentStepRef.current, revision).catch(
        () => undefined,
      );
    }, DRAFT_SAVE_DELAY_MS);
    return () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = undefined;
      }
    };
  }, [activeCreationId, data, data.template, draftReady, persistSnapshot, templateType]);
  useEffect(() => {
    if (!draftReady || !activeCreationId || data.template !== templateType)
      return;
    const persist = () => {
      void flushPendingSave();
    };
    const persistWhenHidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [activeCreationId, data.template, draftReady, flushPendingSave, templateType]);
  useEffect(() => {
    const onExit = (event: Event) => {
      const detail = (event as CustomEvent<{ flush?: () => Promise<boolean> }>).detail;
      if (detail && draftReady && activeCreationIdRef.current)
        detail.flush = flushPendingSave;
    };
    window.addEventListener("tiny-builder-before-exit", onExit);
    return () => window.removeEventListener("tiny-builder-before-exit", onExit);
  }, [draftReady, flushPendingSave]);
  const flushRef = useRef(flushPendingSave);
  useEffect(() => { flushRef.current = flushPendingSave; }, [flushPendingSave]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
      queueMicrotask(() => {
        if (mountedRef.current) return;
        void flushRef.current().finally(() => {
          if (mountedRef.current) return;
          collectLocalImages(dataRef.current).forEach(revokeLocalImage);
          collectLocalVideos(dataRef.current).forEach(revokeLocalVideo);
          collectLocalAudio(dataRef.current).forEach(revokeLocalAudio);
        });
      });
    };
  }, []);

  const updateBasics = useCallback(
    (value: Partial<SurpriseBasics>) =>
      setData((current) => {
        const next = { ...current, basics: { ...current.basics, ...value } };
        dataRef.current = next;
        return next;
      }),
    [],
  );
  const updateContent = useCallback(
    (
      value: Partial<
        | CatchTheHeartContent
        | PhotoPuzzleContent
        | OpenWhenContent
        | ChooseOurDateContent
        | MemoryQuizContent
        | OurStorybookContent
        | WishUponAStarContent
        | CozyPlaylistContent
      > | ((current: SurpriseData["content"]) => Partial<SurpriseData["content"]>),
    ) =>
      setData((current) => {
        const next = {
          ...current,
          content: {
            ...current.content,
            ...(typeof value === "function" ? value(current.content) : value),
          } as SurpriseData["content"],
        };
        revokeImagesRemovedFromState(current, next);
        dataRef.current = next;
        return next;
      }),
    [],
  );
  const updateAppearance = useCallback(
    (value: Partial<SurpriseAppearance>) =>
      setData((current) => {
        const next = {
          ...current,
          appearance: { ...current.appearance, ...value },
        };
        revokeImagesRemovedFromState(current, next);
        dataRef.current = next;
        return next;
      }),
    [],
  );
  const updateDelivery = useCallback(
    (value: Partial<SurpriseDelivery>) =>
      setData((current) => {
        const next = {
          ...current,
          delivery: { ...current.delivery, ...value },
        };
        dataRef.current = next;
        return next;
      }),
    [],
  );
  const updateMusic = useCallback(
    (value: Partial<SurpriseMusic>) =>
      setData((current) => {
        const next = {
          ...current,
          music: {
            loop: true,
            startMuted: false,
            volume: 60,
            ...current.music,
            ...value,
          },
        };
        revokeImagesRemovedFromState(current, next);
        dataRef.current = next;
        return next;
      }),
    [],
  );
  const updateDelight = useCallback(
    (value: Partial<SurpriseDelight>) =>
      setData((current) => {
        const next = { ...current, delight: { ...current.delight!, ...value } };
        revokeImagesRemovedFromState(current, next);
        dataRef.current = next;
        return next;
      }),
    [],
  );
  const valid = useMemo(() => {
    return currentStep === 1
      ? validateBasics(data.basics).valid
      : currentStep === 2
        ? validateContent(templateType, data.content, validationPolicy).valid
        : currentStep === 3
          ? validateAppearance(data.appearance).valid
          : currentStep === 4
            ? validateDelight(data.delight).valid
            : true;
  }, [currentStep, data, templateType, validationPolicy]);
  const next = useCallback(() => {
    if (valid && currentStep < 6) {
      void hapticTap("light");
      setCurrentStep((step) => step + 1);
    } else if (!valid) {
      void hapticTap("heavy");
      window.dispatchEvent(new Event("tiny-validation-attempted"));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => focusFirstInvalidField()),
      );
    }
  }, [valid, currentStep]);
  const previous = useCallback(() => {
    setCurrentStep((step) => Math.max(1, step - 1));
  }, []);
  const saveEdit = useCallback(async () => {
    if (!isEditSession || !activeCreationIdRef.current) return true;
    if (!(await flushPendingSave())) return false;
    try {
      const savedAt = await commitEditSession(
        activeCreationIdRef.current,
        dataRef.current,
        currentStepRef.current,
        validationPolicy,
        { ...writeGuardRef.current },
      );
      editSessionCommittedRef.current = true;
      setDraftSavedAt(savedAt);
      setDraftStatus("saved");
      setDraftError(undefined);
      return true;
    } catch (error) {
      if (mountedRef.current && error instanceof DraftConflictError) setSaveConflict(true);
      if (mountedRef.current) setDraftStatus("unavailable");
      if (mountedRef.current)
        setDraftError(error instanceof DraftConflictError ? error.message : localSaveFailureMessage(error, "Your edits could not be saved. Your original surprise is unchanged. Keep this page open and try Save edits again."));
      return false;
    }
  }, [flushPendingSave, isEditSession, validationPolicy]);
  const discardEdit = useCallback(async () => {
    if (!isEditSession || !activeCreationIdRef.current) return true;
    editSessionCommittedRef.current = true;
    try {
      await saveQueueRef.current.catch(() => undefined);
      await discardEditSession(activeCreationIdRef.current, { ...writeGuardRef.current });
      if (mountedRef.current) setDraftStatus("saved");
      if (mountedRef.current) setDraftError(undefined);
      return true;
    } catch (error) {
      editSessionCommittedRef.current = false;
      if (mountedRef.current && error instanceof DraftConflictError) setSaveConflict(true);
      if (mountedRef.current) setDraftStatus("unavailable");
      if (mountedRef.current)
        setDraftError(error instanceof DraftConflictError ? error.message : "Your edits could not be discarded. Your original surprise is unchanged. Keep this page open and try Discard edits again.");
      return false;
    }
  }, [isEditSession]);
  const reset = useCallback(async () => {
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    logicalRevisionRef.current += 1;
    try {
      await saveQueueRef.current.catch(() => undefined);
      if (activeCreationIdRef.current) {
        if (isEditSession) {
          if (!(await discardEdit())) return;
        } else {
          const guard = await getCreationDeletionGuard(activeCreationIdRef.current);
          if (guard.status !== "draft" || guard.revision !== writeGuardRef.current.revision) throw new DraftDeletionConflictError();
          await deleteCreation(activeCreationIdRef.current, guard);
        }
      }
      editSessionCommittedRef.current = true;
      collectLocalImages(dataRef.current).forEach(revokeLocalImage);
      collectLocalVideos(dataRef.current).forEach(revokeLocalVideo);
      collectLocalAudio(dataRef.current).forEach(revokeLocalAudio);
      window.location.href = "/templates";
    } catch (reason) {
      setDraftStatus("unavailable");
      setDraftError(reason instanceof DraftDeletionConflictError ? reason.message : "Your draft could not be removed. Your current work is still open; try again.");
    }
  }, [discardEdit, isEditSession]);
  const startFresh = useCallback(async () => {
    const next = initialData(templateType);
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    logicalRevisionRef.current += 1;
    setDraftStatus("saving");
    setDraftError(undefined);
    try {
      await saveQueueRef.current.catch(() => undefined);
      if (activeCreationIdRef.current) {
        const savedAt = isEditSession
          ? await resetEditSessionDraft(activeCreationIdRef.current, next, 1, { ...writeGuardRef.current })
          : await resetCreationDraft(activeCreationIdRef.current, next, 1, { ...writeGuardRef.current });
        writeGuardRef.current.revision += 1;
        setDraftSavedAt(savedAt);
      }
      revokeImagesRemovedFromState(dataRef.current, next);
      dataRef.current = next;
      setData(next);
      setCurrentStep(1);
      setDraftStatus("saved");
    } catch (error) {
      if (error instanceof DraftConflictError) setSaveConflict(true);
      setDraftStatus("unavailable");
      setDraftError(error instanceof DraftConflictError ? error.message : localSaveFailureMessage(error, "Your fresh draft could not be saved. Your current work is still here. Try again."));
    }
  }, [isEditSession, templateType]);

  const saveAsNewDraft = useCallback(async () => {
    if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
    try {
      const record = await restoreDraftBackup(structuredClone(dataRef.current), currentStepRef.current);
      editSessionCommittedRef.current = true;
      window.location.assign("/create/" + templateType + "?creation=" + record.id);
    } catch (error) {
      setDraftError(localSaveFailureMessage(error, "Your copy could not be saved. Keep this page open and try Save as new draft again."));
    }
  }, [templateType]);

  return {
    saveConflict,
    saveAsNewDraft,
    currentStep,
    surpriseData: data,
    template,
    draftStatus,
    draftSavedAt,
    validationPolicy,
    draftError,
    flushPendingSave,
    entryMode,
    entryError,
    isEditSession,
    saveEdit,
    discardEdit,
    creationId: activeCreationId,
    handleNext: next,
    handlePrevious: previous,
    handleStartOver: reset,
    handleStartFresh: startFresh,
    updateBasics,
    updateContent,
    updateAppearance,
    updateDelivery,
    updateMusic,
    updateDelight,
    setCurrentStep,
  };
}
