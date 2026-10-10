"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CloudOff,
  FileUp,
  HardDrive,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportDraftButton } from "@/components/import-draft-button";
import { listCreations, type CreationRecord } from "@/lib/creations";
import { TEMPLATE_CARD_ART } from "@/lib/design-assets";
import { TEMPLATES } from "@/lib/config";
import { useAndroidWideLayout } from "@/lib/use-media-query";
import { BrandLogo } from "@/components/brand";
import { formatBytes } from "@/lib/format-bytes";

/**
 * The Android app's actual home screen (bottom-nav "Home" tab) — a
 * functional dashboard, not the marketing landing page. See app/page.tsx
 * for how this is swapped in only inside the native shell. Landscape/tablet
 * gets a real two-column dashboard (actions left, recent + status right)
 * instead of one narrow column stranded in the middle of a wide screen.
 */
export function AndroidHome() {
  const [creations, setCreations] = useState<CreationRecord[]>();
  const [loadError, setLoadError] = useState(false);
  const loadCreations = useCallback(async () => {
    setLoadError(false);
    try { setCreations(await listCreations()); }
    catch { setLoadError(true); }
  }, []);
  const [online, setOnline] = useState(true);
  const [usage, setUsage] = useState<{ used: number; quota: number }>();
  const wide = useAndroidWideLayout();

  useEffect(() => {
    setOnline(navigator.onLine);
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    void loadCreations();
    void navigator.storage
      ?.estimate?.()
      .then((estimate) =>
        setUsage({ used: estimate.usage || 0, quota: estimate.quota || 0 }),
      )
      .catch(() => undefined);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [loadCreations]);

  // Received records are viewer-owned originals. Home shortcuts may only
  // enter the creator route for creator-owned records; Received items stay in
  // Library where the explicit Save and edit copy action lives.
  const creatorCreations = creations?.filter((creation) => creation.status !== "imported" && !creation.recovery);
  const continueTarget = creatorCreations?.find(record => record.status === "draft") || creatorCreations?.[0];
  const recent = creatorCreations?.slice(0, 5) || [];
  const actions = (
    <section className="space-y-2">
      {continueTarget && (
        <Link
          href={`/create/${continueTarget.templateId}?creation=${continueTarget.id}`}
          className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[.06] p-3 transition hover:border-primary/40"
        >
          {(continueTarget.thumbnail || TEMPLATE_CARD_ART[continueTarget.templateId]) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={continueTarget.thumbnail || TEMPLATE_CARD_ART[continueTarget.templateId]}
              alt=""
              aria-hidden="true"
              className="h-14 w-14 shrink-0 rounded-xl border object-cover"
            />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-[.1em] text-primary">
              {continueTarget.status === "draft" ? "Continue editing" : "Reopen completed surprise"}
            </span>
            <span className="mt-0.5 block truncate font-semibold">
              {continueTarget.title}
            </span>
            {continueTarget.title === `Untitled ${TEMPLATES[continueTarget.templateId]?.name}` && continueTarget.recipientContext && <span className="block text-sm [overflow-wrap:anywhere]">For {continueTarget.recipientContext}</span>}
            <span className="block text-xs text-muted-foreground">
              {TEMPLATES[continueTarget.templateId]?.name || continueTarget.templateId}
              {" · Updated "}
              {new Date(continueTarget.updatedAt).toLocaleDateString()}
            </span>
          </span>
        </Link>
      )}
      <Button
        asChild
        size="lg"
        variant={continueTarget ? "outline" : "default"}
        className="h-auto min-h-14 w-full justify-start"
      >
        <Link href="/templates">
          <Sparkles className="mr-2 h-5 w-5" />
          Create a surprise
        </Link>
      </Button>
      <ImportDraftButton />
    </section>
  );

  const status = (
    <section className="space-y-2">
      {!online && (
        <p className="flex items-center gap-2 border-l-2 border-amber-400 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:text-amber-200">
          <CloudOff className="h-4 w-4 shrink-0" />
          You&apos;re offline. Your saved surprises are still here — YouTube
          and external song links need internet.
        </p>
      )}
      {usage && (
        <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
          <HardDrive className="h-4 w-4 shrink-0 text-primary" />
          Using {formatBytes(usage.used)} on this device
          {usage.quota ? ` of ${formatBytes(usage.quota)} available` : ""}.
        </p>
      )}
    </section>
  );

  const recentList = (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Recent surprises</h2>
        <Link
          href="/library"
          className="inline-flex min-h-12 items-center px-2 text-sm font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      {loadError ? (
        <div className="mt-3 space-y-2 border-y border-border/70 py-4">
          <p role="alert" className="text-sm text-destructive">Your surprises couldn’t be loaded. Try again to see your saved work.</p>
          <Button variant="outline" onClick={() => void loadCreations()}>Try again</Button>
        </div>
      ) : creations === undefined ? (
        <div
          className="mt-3 grid min-h-24 place-items-center border-y border-border/70 text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span className="sr-only">Loading your surprises</span>
        </div>
      ) : recent.length === 0 ? (
        <p className="mt-3 border-y border-border/70 py-5 text-sm text-muted-foreground">
          {creations.some(creation => creation.recovery) ? "Some saved items need recovery. Open My Surprises with View all above." : "Nothing yet — your first surprise will show up here."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recent.map((creation) => (
            <li key={creation.id}>
              <Link
                href={`/create/${creation.templateId}?creation=${creation.id}`}
                className="flex items-center justify-between gap-3 border-b border-border/70 py-3 hover:text-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={creation.thumbnail || TEMPLATE_CARD_ART[creation.templateId]} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {creation.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {TEMPLATES[creation.templateId]?.name ||
                      creation.templateId}
                  </span>
                </span>
                <FileUp
                  className="h-4 w-4 shrink-0 rotate-90 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <main
      className={`android-page site-container mx-auto min-h-svh px-4 pt-6 ${wide ? "max-w-4xl" : "max-w-2xl"}`}
    >
      <header>
        <h1>
          <BrandLogo priority className="h-8 w-[10rem]" />
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Make a personal surprise with words, photos, or a song.</p>
      </header>

      {wide ? (
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="space-y-6">{actions}</div>
          <div className="space-y-6">
            {status}
            {recentList}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6">{actions}</div>
          <div className="mt-3">{status}</div>
          <div className="mt-8">{recentList}</div>
        </>
      )}
    </main>
  );
}
