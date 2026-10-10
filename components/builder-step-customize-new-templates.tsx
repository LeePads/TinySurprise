"use client";
import { useReviewField } from "@/lib/review-field";
import { TEXT_LIMITS } from "@/lib/text-limits";

import { useEffect, useRef, useState } from "react";
import { FileAudio2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ImagePicker } from "./image-picker";
import { createStableId } from "@/lib/local-media";
import type {
  CozyPlaylistContent,
  OurStorybookContent,
  WishUponAStarContent,
} from "@/lib/types";
import { useValidationAttempted } from "@/lib/use-validation-attempted";
import { normalizeHttpUrl } from "@/lib/safe-url";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { BuilderWorkspace } from "./builder-workspace";
import { getTemplateExperienceDefinition } from "@/lib/template-experience-definitions";
import { BuilderItemActions } from "./builder-item-actions";
import {
  AUDIO_ACCEPT,
  MAX_PLAYLIST_AUDIO_BYTES,
  audioValidationMessage,
  prepareLocalAudio,
  AUDIO_COMPATIBILITY_NOTE,
  formatAudioDuration,
  revokeAudioPreview,
} from "@/lib/music";
import { formatBytes } from "@/lib/format-bytes";

type Props = {
  kind: "storybook" | "stars" | "playlist";
  data: OurStorybookContent | WishUponAStarContent | CozyPlaylistContent;
  onUpdate: (
    value: Partial<
      OurStorybookContent | WishUponAStarContent | CozyPlaylistContent
    >,
  ) => void;
};

export function StepCustomizeNewTemplate({
  kind,
  data,
  onUpdate,
}: Props) {
  const [addedNotice, setAddedNotice] = useState("");
  const [audioTarget, setAudioTarget] = useState<string>();
  const [audioErrors, setAudioErrors] = useState<Record<string, string>>({});
  const [activeItem, setActiveItem] = useState<string>();
  useReviewField(id => { const match = id.match(/^(?:chapter-(?:title|body)|track-(?:title|artist|why|audio|link))-(.+)$/); if (match) setActiveItem(match[1]); });
  const [focusRequest, setFocusRequest] = useState(0);
  const pendingStoryFocus = useRef<{
    id: string;
    field: "title" | "body";
  } | undefined>(undefined);
  const pendingPlaylistFocus = useRef<{
    id: string;
    field: "title" | "artist" | "why" | "audio" | "link";
  } | undefined>(undefined);
  const audioInput = useRef<HTMLInputElement>(null);
  const playlistRef = useRef<CozyPlaylistContent | undefined>(undefined);
  const audioChoices = useRef(new Map<string, number>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; audioChoices.current.clear(); }; }, []);
  useEffect(() => {
    playlistRef.current = kind === "playlist" ? (data as CozyPlaylistContent) : undefined;
  }, [data, kind]);
  const showErrors = useValidationAttempted();
  useEffect(() => {
    const revealFirstInvalid = () => {
      if (kind === "storybook") {
        const pages = (data as OurStorybookContent).pages;
        const firstInvalid = pages.find(
          (page) => !page.title.trim() || !page.body.trim(),
        );
        if (firstInvalid) {
          pendingStoryFocus.current = {
            id: firstInvalid.id,
            field: firstInvalid.title.trim() ? "body" : "title",
          };
          setActiveItem(firstInvalid.id);
          setFocusRequest((value) => value + 1);
        }
      }
      if (kind === "playlist") {
        const tracks = (data as CozyPlaylistContent).tracks;
        const firstInvalid = tracks.find(
          (track) =>
            !track.title.trim() ||
            !track.artist.trim() ||
            !track.why.trim() ||
            (Boolean(track.link) && !normalizeHttpUrl(track.link)) ||
            (!track.audio && !normalizeHttpUrl(track.link)),
        );
        if (firstInvalid) {
          pendingPlaylistFocus.current = {
            id: firstInvalid.id,
            field: !firstInvalid.title.trim()
              ? "title"
              : !firstInvalid.artist.trim()
                ? "artist"
                : !firstInvalid.why.trim()
                  ? "why"
                  : Boolean(firstInvalid.link) && !normalizeHttpUrl(firstInvalid.link)
                    ? "link"
                    : "audio",
          };
          setActiveItem(firstInvalid.id);
          setFocusRequest((value) => value + 1);
        }
      }
    };
    window.addEventListener("tiny-validation-attempted", revealFirstInvalid);
    return () =>
      window.removeEventListener(
        "tiny-validation-attempted",
        revealFirstInvalid,
      );
  }, [data, kind]);
  useEffect(() => {
    if (kind !== "storybook" || !pendingStoryFocus.current) return;
    let attempts = 0;
    let frame = 0;
    const focusField = () => {
      const target = pendingStoryFocus.current;
      if (!target) return;
      const element = document.getElementById(
        `chapter-${target.field}-${target.id}`,
      ) as HTMLElement | null;
      if (element) {
        element.focus();
        pendingStoryFocus.current = undefined;
        return;
      }
      if (attempts++ < 12) frame = window.requestAnimationFrame(focusField);
    };
    frame = window.requestAnimationFrame(focusField);
    return () => window.cancelAnimationFrame(frame);
  }, [activeItem, data, focusRequest, kind]);
  useEffect(() => {
    if (kind !== "playlist" || !pendingPlaylistFocus.current) return;
    let attempts = 0;
    let frame = 0;
    const focusField = () => {
      const target = pendingPlaylistFocus.current;
      if (!target) return;
      const element = document.getElementById(
        `track-${target.field}-${target.id}`,
      ) as HTMLElement | null;
      if (element) {
        element.focus();
        pendingPlaylistFocus.current = undefined;
        return;
      }
      if (attempts++ < 12) frame = window.requestAnimationFrame(focusField);
    };
    frame = window.requestAnimationFrame(focusField);
    return () => window.cancelAnimationFrame(frame);
  }, [activeItem, data, focusRequest, kind]);
  useEffect(() => {
    if (kind !== "storybook" || !activeItem) return;
    const pages = (data as OurStorybookContent).pages;
    if (pages.some((page) => page.id === activeItem)) return;
    const survivor = pages[0];
    if (!survivor) {
      setActiveItem(undefined);
      return;
    }
    pendingStoryFocus.current = { id: survivor.id, field: "title" };
    setActiveItem(survivor.id);
    setFocusRequest((value) => value + 1);
  }, [activeItem, data, kind]);
  useEffect(() => {
    if (kind !== "playlist" || !activeItem) return;
    const tracks = (data as CozyPlaylistContent).tracks;
    if (tracks.some((track) => track.id === activeItem)) return;
    const survivor = tracks[0];
    if (!survivor) {
      setActiveItem(undefined);
      return;
    }
    pendingPlaylistFocus.current = { id: survivor.id, field: "title" };
    setActiveItem(survivor.id);
    setFocusRequest((value) => value + 1);
  }, [activeItem, data, kind]);
  if (kind === "stars") return null;

  if (kind === "storybook") {
    const story = data as OurStorybookContent;
    const storyLimits = getTemplateExperienceDefinition("our-storybook").limits;
    const recommendedMaxPages = storyLimits.recommendedMax || 12;
    const compatibilityMaxPages = storyLimits.compatibilityMax || recommendedMaxPages;
    const maxPages = story.pages.length > recommendedMaxPages ? compatibilityMaxPages : recommendedMaxPages;
    const addPage = () => {
      const id = createStableId("page");
      onUpdate({
        pages: [
          ...story.pages,
          {
            id,
            title: `Chapter ${story.pages.length + 1}`,
            body: "",
          },
        ],
      });
      pendingStoryFocus.current = { id, field: "title" };
      setActiveItem(id);
      setFocusRequest((value) => value + 1);
      setAddedNotice("A fresh page is ready for your next memory.");
    };
    const removePage = (id: string) => {
      const removedIndex = story.pages.findIndex((page) => page.id === id);
      if (removedIndex < 0) return;
      const pages = story.pages.filter((page) => page.id !== id);
      const effectiveActiveId = activeItem || story.pages[0]?.id;
      const removingActive = effectiveActiveId === id;
      onUpdate({ pages });
      if (removingActive && pages.length) {
        const survivor = pages[Math.min(removedIndex, pages.length - 1)];
        pendingStoryFocus.current = { id: survivor.id, field: "title" };
        setActiveItem(survivor.id);
        setFocusRequest((value) => value + 1);
      } else if (activeItem && !pages.some((page) => page.id === activeItem)) {
        const survivor = pages[0];
        if (survivor) {
          pendingStoryFocus.current = { id: survivor.id, field: "title" };
          setActiveItem(survivor.id);
          setFocusRequest((value) => value + 1);
        } else {
          setActiveItem(undefined);
        }
      }
    };
    const movePage = (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= story.pages.length) return;
      const pages = [...story.pages];
      [pages[index], pages[target]] = [pages[target], pages[index]];
      onUpdate({ pages });
      const effectiveActiveId = activeItem || story.pages[0]?.id;
      if (effectiveActiveId && effectiveActiveId === story.pages[index]?.id) {
        pendingStoryFocus.current = { id: effectiveActiveId, field: "title" };
        setActiveItem(effectiveActiveId);
        setFocusRequest((value) => value + 1);
      }
    };
    return (
      <BuilderWorkspace className="builder-workspace--customize">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">Write your tiny chapters</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add up to {maxPages} chapters and pair each with an optional memory photo.
            </p>
          </div>
        </div>

        {story.pages.map((page, index) => (
          <section
            className="space-y-3 border-t border-border/70 pt-5"
            key={page.id}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <button type="button" className="min-h-12 min-w-0 flex-1 text-left font-semibold [overflow-wrap:anywhere]" aria-expanded={(activeItem || story.pages[0]?.id) === page.id} onClick={() => setActiveItem((activeItem || story.pages[0]?.id) === page.id ? undefined : page.id)}>Chapter {index + 1} · {page.title.trim() || "Needs a title"}</button>
              <BuilderItemActions
                itemLabel="Chapter"
                index={index}
                canMoveEarlier={index > 0}
                canMoveLater={index < story.pages.length - 1}
                canRemove={story.pages.length > 2}
                onMoveEarlier={() => movePage(index, -1)}
                onMoveLater={() => movePage(index, 1)}
                onRemove={() => removePage(page.id)}
              />
            </div>
            {(activeItem || story.pages[0]?.id) === page.id && <>
            <label
              className="block text-sm font-medium"
              htmlFor={`chapter-title-${page.id}`}
            >
              Chapter {index + 1} title <span className="text-primary">*</span>
            </label>
            <Input textBudget={TEXT_LIMITS.title}
              id={`chapter-title-${page.id}`}
              placeholder={`Chapter ${index + 1}`}
              value={page.title}
              onChange={(event) =>
                onUpdate({
                  pages: story.pages.map((item) =>
                    item.id === page.id
                      ? { ...item, title: event.target.value }
                      : item,
                  ),
                })
              }
              aria-invalid={showErrors && !page.title.trim()}
              aria-describedby={
                showErrors && !page.title.trim()
                  ? "chapter-title-error-" + page.id
                  : undefined
              }
            />
            {showErrors && !page.title.trim() && (
              <InlineFieldMessage
                id={"chapter-title-error-" + page.id}
                message={`Add a title for chapter ${index + 1} before continuing.`}
              />
            )}
            <label
              className="block text-sm font-medium"
              htmlFor={`chapter-body-${page.id}`}
            >
              Chapter {index + 1} story <span className="text-primary">*</span>
            </label>
            <Textarea textBudget={TEXT_LIMITS.body}
              id={`chapter-body-${page.id}`}
              placeholder="What happened in this chapter?"
              value={page.body}
              onChange={(event) =>
                onUpdate({
                  pages: story.pages.map((item) =>
                    item.id === page.id
                      ? { ...item, body: event.target.value }
                      : item,
                  ),
                })
              }
              aria-invalid={showErrors && !page.body.trim()}
              aria-describedby={
                showErrors && !page.body.trim()
                  ? "chapter-body-error-" + page.id
                  : undefined
              }
            />
            {showErrors && !page.body.trim() && (
              <InlineFieldMessage
                id={"chapter-body-error-" + page.id}
                message={`Add the story for chapter ${index + 1} before continuing.`}
              />
            )}
            <ImagePicker
              label={`Chapter ${index + 1} photo (optional)`}
              adjustLabel="Adjust chapter photo"
              frameAspect="4 / 3"
              value={page.photo}
              onChange={(photo) =>
                onUpdate({
                  pages: story.pages.map((item) =>
                    item.id === page.id ? { ...item, photo } : item,
                  ),
                })
              }
            />
            <label className="block text-sm font-medium" htmlFor={`chapter-composition-${page.id}`}>
              Page composition
              <select id={`chapter-composition-${page.id}`} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-3" value={page.composition || "auto"} onChange={(event) => onUpdate({ pages: story.pages.map((item) => item.id === page.id ? { ...item, composition: event.target.value as NonNullable<typeof page.composition> } : item) })}>
                <option value="auto">Automatic</option>
                <option value="photo-note">Photo with note</option>
                <option value="photo-led">Photo-led</option>
                <option value="note-focused">Note-focused</option>
                <option value="split">Split page</option>
              </select>
            </label>
            </>}
          </section>
        ))}
        {showErrors &&
          (story.pages.length < 2 || story.pages.length > maxPages) && (
          <InlineFieldMessage
            id="storybook-count-error"
            message={`Add between 2 and ${maxPages} chapters before continuing.`}
          />
        )}
        <Button
          type="button"
          variant="outline"
          disabled={story.pages.length >= maxPages}
          onClick={addPage}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add another chapter
        </Button>
        {addedNotice && (
          <p className="text-sm text-primary" role="status" aria-live="polite">
            {addedNotice}
          </p>
        )}
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="storybook-final">
            Final story message <span className="text-primary">*</span>
          </label>
          <Textarea textBudget={TEXT_LIMITS.final}
            id="storybook-final"
            placeholder="The last page…"
            value={story.finalMessage}
            onChange={(event) => onUpdate({ finalMessage: event.target.value })}
            aria-invalid={showErrors && !story.finalMessage.trim()}
            aria-describedby={
              showErrors && !story.finalMessage.trim()
                ? "storybook-final-error"
                : undefined
            }
          />
          {showErrors && !story.finalMessage.trim() && (
            <InlineFieldMessage
              id="storybook-final-error"
              message="Add the closing story message before continuing."
            />
          )}
        </div>
      </div>
      </BuilderWorkspace>
    );
  }

  const playlist = data as CozyPlaylistContent;
  const playlistLimits = getTemplateExperienceDefinition("cozy-playlist").limits;
  const recommendedMaxTracks = playlistLimits.recommendedMax || 6;
  const compatibilityMaxTracks = playlistLimits.compatibilityMax || recommendedMaxTracks;
  const maxTracks = playlist.tracks.length > recommendedMaxTracks ? compatibilityMaxTracks : recommendedMaxTracks;
  const updateTrack = (
    id: string,
    value: Partial<CozyPlaylistContent["tracks"][number]>,
  ) =>
    onUpdate({
      tracks: playlist.tracks.map((track) =>
        track.id === id ? { ...track, ...value } : track,
      ),
    });
  const moveTrack = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= playlist.tracks.length) return;
    const tracks = [...playlist.tracks];
    [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
    onUpdate({ tracks });
  };
  const addTrack = () => {
    if (playlist.tracks.length >= maxTracks) return;
    const id = createStableId("track");
    onUpdate({
      tracks: [
        ...playlist.tracks,
        {
          id,
          title: "",
          artist: "",
          why: "",
          link: "",
        },
      ],
    });
    pendingPlaylistFocus.current = { id, field: "title" };
    setActiveItem(id);
    setFocusRequest((value) => value + 1);
    setAddedNotice("A new track is ready for the story behind it.");
  };
  const removeTrack = (id: string) => {
    const removed = playlist.tracks.find((track) => track.id === id);
    const removedIndex = playlist.tracks.findIndex((track) => track.id === id);
    if (removedIndex < 0) return;
    revokeAudioPreview(removed?.audio);
    const tracks = playlist.tracks.filter((track) => track.id !== id);
    const effectiveActiveId = activeItem || playlist.tracks[0]?.id;
    const removingActive = effectiveActiveId === id;
    onUpdate({ tracks });
    if (removingActive && tracks.length) {
      const survivor = tracks[Math.min(removedIndex, tracks.length - 1)];
      pendingPlaylistFocus.current = { id: survivor.id, field: "title" };
      setActiveItem(survivor.id);
      setFocusRequest((value) => value + 1);
    } else if (activeItem && !tracks.some((track) => track.id === activeItem)) {
      const survivor = tracks[0];
      if (survivor) {
        pendingPlaylistFocus.current = { id: survivor.id, field: "title" };
        setActiveItem(survivor.id);
        setFocusRequest((value) => value + 1);
      } else {
        setActiveItem(undefined);
      }
    }
  };
  const chooseTrackAudio = async (id: string, file?: File) => {
    if (!file) return;
    const choice = (audioChoices.current.get(id) || 0) + 1;
    audioChoices.current.set(id, choice);
    const message = audioValidationMessage(file);
    const otherBytes = playlist.tracks.reduce(
      (sum, track) => sum + (track.id === id ? 0 : track.audio?.size || 0),
      0,
    );
    const nextErrors = { ...audioErrors };
    if (message) {
      nextErrors[id] = message;
      setAudioErrors(nextErrors);
      return;
    }
    if (otherBytes + file.size > MAX_PLAYLIST_AUDIO_BYTES) {
      nextErrors[id] = "Keep playlist audio under 12 MB so the surprise stays easy to share.";
      setAudioErrors(nextErrors);
      return;
    }
    const previous = playlistRef.current;
    setAudioErrors(errors => ({ ...errors, [id]: "Reading audio… Your existing song is kept until this file is ready." }));
    try {
      const audio = await prepareLocalAudio(file, `playlist-${id}`);
      if (!mounted.current || audioChoices.current.get(id) !== choice) { revokeAudioPreview(audio); return; }
      if (playlistRef.current !== previous || !playlistRef.current?.tracks.some(track => track.id === id)) { revokeAudioPreview(audio); setAudioErrors(errors => ({ ...errors, [id]: "The playlist changed while reading this file. Choose it again." })); return; }
      const current = previous?.tracks.find(track => track.id === id)?.audio;
      updateTrack(id, { audio });
      revokeAudioPreview(current);
      setAudioErrors(errors => { const next = { ...errors }; delete next[id]; return next; });
    } catch (reason) { if (mounted.current && audioChoices.current.get(id) === choice) setAudioErrors(errors => ({ ...errors, [id]: reason instanceof Error ? reason.message : "This audio could not be read. Your existing song is kept." })); }
    if (audioChoices.current.get(id) === choice && audioInput.current) audioInput.current.value = "";
  };
  const removeTrackAudio = (id: string) => {
    const current = playlist.tracks.find((track) => track.id === id)?.audio;
    revokeAudioPreview(current);
    updateTrack(id, { audio: undefined });
  };
  return (
    <BuilderWorkspace className="builder-workspace--customize">
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-semibold">Build your cozy playlist</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add 2–{maxTracks} songs. Upload audio to keep the playlist with the surprise, or
          add a link they can open elsewhere.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{AUDIO_COMPATIBILITY_NOTE} Keep the whole playlist under 12 MB.</p>
      </div>
      <input
        ref={audioInput}
        className="hidden"
        type="file"
        accept={AUDIO_ACCEPT}
        aria-label="Upload playlist song"
        onChange={(event) => chooseTrackAudio(audioTarget || "", event.target.files?.[0])}
      />
      {playlist.tracks.map((track, index) => (
        <section
          className="space-y-3 border-t border-border/70 pt-5"
          key={track.id}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <button type="button" className="min-h-12 min-w-0 flex-1 text-left font-semibold [overflow-wrap:anywhere]" aria-expanded={(activeItem || playlist.tracks[0]?.id) === track.id} onClick={() => setActiveItem((activeItem || playlist.tracks[0]?.id) === track.id ? undefined : track.id)}>Song {index + 1} · {track.title.trim() || "Needs a title"}</button>
            <BuilderItemActions
              itemLabel="Song"
              index={index}
              canMoveEarlier={index > 0}
              canMoveLater={index < playlist.tracks.length - 1}
              canRemove={playlist.tracks.length > 2}
              onMoveEarlier={() => moveTrack(index, -1)}
              onMoveLater={() => moveTrack(index, 1)}
              onRemove={() => removeTrack(track.id)}
            />
          </div>
          {(activeItem || playlist.tracks[0]?.id) === track.id && <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className="block text-sm font-medium"
              htmlFor={`track-title-${track.id}`}
            >
              Song title <span className="text-primary">*</span>
              <Input textBudget={TEXT_LIMITS.title}
                id={`track-title-${track.id}`}
                className="mt-2"
                placeholder="Our song"
                value={track.title}
                onChange={(event) =>
                  updateTrack(track.id, { title: event.target.value })
                }
                aria-invalid={showErrors && !track.title.trim()}
                aria-describedby={
                  showErrors && !track.title.trim()
                    ? "track-title-error-" + track.id
                    : undefined
                }
              />
              {showErrors && !track.title.trim() && (
                <InlineFieldMessage
                  id={"track-title-error-" + track.id}
                  message={`Add song ${index + 1} before continuing.`}
                />
              )}
            </label>
            <label
              className="block text-sm font-medium"
              htmlFor={`track-artist-${track.id}`}
            >
              Artist <span className="text-primary">*</span>
              <Input textBudget={TEXT_LIMITS.title}
                id={`track-artist-${track.id}`}
                className="mt-2"
                placeholder="Artist"
                value={track.artist}
                onChange={(event) =>
                  updateTrack(track.id, { artist: event.target.value })
                }
                aria-invalid={showErrors && !track.artist.trim()}
                aria-describedby={
                  showErrors && !track.artist.trim()
                    ? "track-artist-error-" + track.id
                    : undefined
                }
              />
              {showErrors && !track.artist.trim() && (
                <InlineFieldMessage
                  id={"track-artist-error-" + track.id}
                  message={`Add the artist for song ${index + 1} before continuing.`}
                />
              )}
            </label>
          </div>
          <label
            className="block text-sm font-medium"
            htmlFor={`track-why-${track.id}`}
          >
            Why this song matters <span className="text-primary">*</span>
          </label>
          <Textarea textBudget={TEXT_LIMITS.description}
            id={`track-why-${track.id}`}
            placeholder="Why this song feels like us"
            value={track.why}
            onChange={(event) =>
              updateTrack(track.id, { why: event.target.value })
            }
            aria-invalid={showErrors && !track.why.trim()}
            aria-describedby={
              showErrors && !track.why.trim()
                ? "track-why-error-" + track.id
                : undefined
            }
          />
          {showErrors && !track.why.trim() && (
            <InlineFieldMessage
              id={"track-why-error-" + track.id}
              message={`Add why song ${index + 1} belongs before continuing.`}
            />
          )}
          <div className="space-y-3 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Song audio</p>
                <p className="text-xs text-muted-foreground">Up to 10 MB per file · 12 MB for the playlist</p>
              </div>
              <Button
                type="button"
                variant="outline"
                id={`track-audio-${track.id}`}
                onClick={() => {
                  setAudioTarget(track.id);
                  audioInput.current?.click();
                }}
                data-validation-anchor={
                  showErrors &&
                  !track.audio &&
                  !normalizeHttpUrl(track.link)
                }
                aria-describedby={
                  showErrors &&
                  !track.audio &&
                  !normalizeHttpUrl(track.link)
                    ? "track-audio-error-" + track.id
                    : undefined
                }
              >
                <Upload className="mr-2 h-4 w-4" />
                {track.audio ? "Replace" : "Add audio"}
              </Button>
            </div>
            {track.audio && (
              <div className="flex items-center gap-3 rounded-xl border bg-secondary/20 p-3">
                <FileAudio2 className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">{track.audio.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(track.audio.size)}
                    {formatAudioDuration(track.audio.durationSeconds)
                      ? ` · ${formatAudioDuration(track.audio.durationSeconds)}`
                      : ""}
                  </p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeTrackAudio(track.id)}>
                  Remove
                </Button>
              </div>
            )}
            {audioErrors[track.id] && (
              <InlineFieldMessage
                id={"track-audio-error-" + track.id}
                message={audioErrors[track.id]}
              />
            )}
          </div>
          <label
            className="block text-sm font-medium"
            htmlFor={`track-link-${track.id}`}
          >
            Song link (optional if you upload audio)
          </label>
          <p className="text-xs text-muted-foreground">Links open separately and need internet.</p>
          <Input
            id={`track-link-${track.id}`}
            className="break-all"
            inputMode="url"
            placeholder="https://…"
            value={track.link || ""}
            onChange={(event) =>
              updateTrack(track.id, { link: event.target.value })
            }
            aria-invalid={
              showErrors &&
              Boolean(track.link) &&
              !normalizeHttpUrl(track.link)
            }
            aria-describedby={
              showErrors &&
              Boolean(track.link) &&
              !normalizeHttpUrl(track.link)
                ? "track-link-error-" + track.id
                : undefined
            }
          />
          {showErrors && track.link && !normalizeHttpUrl(track.link) && (
            <InlineFieldMessage
              id={"track-link-error-" + track.id}
              message="Paste the full song link, starting with https:// or http://."
            />
          )}
          {showErrors && !track.audio && !normalizeHttpUrl(track.link) && (
            <InlineFieldMessage
              id={"track-audio-error-" + track.id}
              message={`Add audio or a complete song link for song ${index + 1}.`}
            />
          )}
          <ImagePicker
            label={`Song ${index + 1} photo (optional)`}
            adjustLabel="Adjust track photo"
            frameAspect="16 / 9"
            value={track.photo}
            onChange={(photo) => updateTrack(track.id, { photo: photo ? { ...photo, presentation: photo.presentation || { mode: "fill" } } : undefined })}
          />
          </>}
        </section>
      ))}
      {showErrors && (playlist.tracks.length < 2 || playlist.tracks.length > maxTracks) && (
        <InlineFieldMessage
          id="playlist-count-error"
          message={`Add between 2 and ${maxTracks} songs before continuing.`}
        />
      )}
      <Button
        type="button"
        variant="outline"
        id="playlist-add-track"
        disabled={playlist.tracks.length >= maxTracks}
        onClick={addTrack}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add another song
      </Button>
      {addedNotice && (
        <p className="text-sm text-primary" role="status" aria-live="polite">
          {addedNotice}
        </p>
      )}
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="playlist-final">
          Playlist closing message <span className="text-primary">*</span>
        </label>
        <Textarea textBudget={TEXT_LIMITS.final}
          id="playlist-final"
          placeholder="One last note for the playlist…"
          value={playlist.finalMessage}
          onChange={(event) => onUpdate({ finalMessage: event.target.value })}
          aria-invalid={showErrors && !playlist.finalMessage.trim()}
          aria-describedby={
            showErrors && !playlist.finalMessage.trim()
              ? "playlist-final-error"
              : undefined
          }
        />
        {showErrors && !playlist.finalMessage.trim() && (
          <InlineFieldMessage
            id="playlist-final-error"
            message="Add the playlist closing message before continuing."
          />
        )}
      </div>
    </div>
    </BuilderWorkspace>
  );
}
