"use client";

import { useEffect, useState } from "react";
import { TEXT_LIMITS } from "@/lib/text-limits";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineFieldMessage } from "@/components/ui/inline-field-message";
import { ConfirmationModal } from "@/components/confirmation-modal";
import {
  AlertTriangle,
  HardDrive,
  Info,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCircle2,
  Users,
  Vibrate,
} from "lucide-react";
import { isNativePlatform } from "@/lib/platform";
import { useAndroidWideLayout } from "@/lib/use-media-query";
import { formatBytes } from "@/lib/format-bytes";
import { clearAllLocalSurpriseData } from "@/lib/creations";
import { HAPTICS_STORAGE_KEY } from "@/lib/native/haptics";
import { SITE_THEME_STORAGE_KEY } from "@/lib/site-theme";
import {
  hapticTap,
  readHapticsPreference,
  setHapticsPreference,
} from "@/lib/native/haptics";
import { readSenderProfile, writeSenderProfile } from "@/lib/sender-profile";
import {
  clearRecipients,
  deleteRecipient,
  listRecipients,
  type RecipientRecord,
} from "@/lib/recipients";

type DestructiveAction =
  | "clear-cache"
  | "delete-surprises"
  | "reset-settings"
  | "clear-recipients";

export default function SettingsPage() {
  const [usage, setUsage] = useState<{ used: number; quota: number }>();
  const [notice, setNotice] = useState("");
  const [native, setNative] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [confirming, setConfirming] = useState<DestructiveAction>();
  const wide = useAndroidWideLayout();
  const [senderName, setSenderName] = useState("");
  const [senderSignOff, setSenderSignOff] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [recipients, setRecipients] = useState<RecipientRecord[]>();

  useEffect(() => {
    setNative(isNativePlatform());
    setHapticsOn(readHapticsPreference());
    const profile = readSenderProfile();
    if (profile) {
      setSenderName(profile.displayName);
      setSenderSignOff(profile.defaultSignOff || "");
    }
    void listRecipients().then(setRecipients);
  }, []);

  const saveProfile = () => {
    if (!senderName.trim() || senderName.length > TEXT_LIMITS.name || senderSignOff.length > TEXT_LIMITS.profileSignOff) return;
    writeSenderProfile(senderName, senderSignOff);
    setProfileSaved(true);
    void hapticTap();
  };

  const removeRecipient = async (id: string) => {
    await deleteRecipient(id);
    setRecipients(await listRecipients());
  };

  const clearAllRecipients = async () => {
    await clearRecipients();
    setRecipients([]);
  };

  const refreshUsage = () => {
    void navigator.storage
      ?.estimate?.()
      .then((estimate) =>
        setUsage({ used: estimate.usage || 0, quota: estimate.quota || 0 }),
      )
      .catch(() => undefined);
  };
  useEffect(refreshUsage, []);

  const toggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsPreference(next);
    setHapticsOn(next);
    if (next) void hapticTap();
  };

  const clearCaches = async () => {
    setNotice("");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("tinysurprise-"))
            .map((key) => caches.delete(key)),
        );
      }
      if (native) {
        const { clearTinySurpriseTempFiles } = await import(
          "@/lib/native/temp-files"
        );
        await clearTinySurpriseTempFiles();
      }
      setNotice("Tiny Surprise temporary files were cleared. Your saved surprises were not affected.");
      refreshUsage();
    } catch {
      setNotice("Temporary files couldn't be cleared. Try again.");
    }
  };

  const deleteAllSurprises = async () => {
    setNotice("");
    try {
      await clearAllLocalSurpriseData();
      setNotice("All local surprises and saved recipient history were deleted from this device.");
      refreshUsage();
    } catch {
      setNotice("Your surprises couldn't be deleted. Try again.");
    }
  };

  const resetSettings = async () => {
    setNotice("");
    try {
      window.localStorage.removeItem(HAPTICS_STORAGE_KEY);
      window.localStorage.removeItem(SITE_THEME_STORAGE_KEY);
      setHapticsOn(readHapticsPreference());
      setNotice("Settings were reset to their defaults. Your saved surprises were not affected.");
    } catch {
      setNotice("Settings couldn't be reset. Try again.");
    }
  };

  const runDestructiveAction = async (action: DestructiveAction) => {
    setConfirming(undefined);
    if (action === "clear-cache") await clearCaches();
    else if (action === "delete-surprises") await deleteAllSurprises();
    else if (action === "clear-recipients") await clearAllRecipients();
    else await resetSettings();
  };

  const twoCol = native && wide;

  const profile = native && (
    <section className="py-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <UserCircle2 className="h-4 w-4 text-primary" /> Your profile
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Used to fill in &quot;From&quot; when you start a new surprise.
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold">
            Your name
          </label>
          <Input
            id="profile-name"
            textBudget={TEXT_LIMITS.name} budgetRequired
            value={senderName}
            onChange={(event) => {
              setSenderName(event.target.value);
              setProfileSaved(false);
            }}
          />
        </div>
        <div>
          <label htmlFor="profile-signoff" className="mb-1.5 block text-sm font-semibold">
            Default sign-off <span className="font-normal text-muted-foreground">Optional</span>
          </label>
          <Input
            id="profile-signoff"
            textBudget={TEXT_LIMITS.name} budgetRequired
            placeholder="Love, Cai"
            value={senderSignOff}
            onChange={(event) => {
              setSenderSignOff(event.target.value);
              setProfileSaved(false);
            }}
          />
        </div>
        <Button size="sm" disabled={!senderName.trim() || senderName.length > TEXT_LIMITS.name || senderSignOff.length > TEXT_LIMITS.profileSignOff} onClick={saveProfile}>
          Save
        </Button>
        {profileSaved && (
          <InlineFieldMessage tone="success" message="Profile saved." />
        )}
      </div>
    </section>
  );

  const savedRecipients = native && (
    <section className="py-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Users className="h-4 w-4 text-primary" /> Saved recipients
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        People you&apos;ve chosen before, so you can pick them again quickly.
      </p>
      {recipients === undefined ? null : recipients.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No saved recipients yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {recipients.map((recipient) => (
            <li
              key={recipient.id}
              className="flex min-h-12 items-center justify-between gap-2 border-b border-border/60 py-1.5"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {recipient.displayName}
              </span>
              <button
                type="button"
                onClick={() => void removeRecipient(recipient.id)}
                className="min-h-12 shrink-0 rounded-full px-3 text-xs font-semibold text-destructive"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {recipients && recipients.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setConfirming("clear-recipients")}
        >
          Clear recent history
        </Button>
      )}
    </section>
  );

  const haptics = native && (
    <section className="py-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Vibrate className="h-4 w-4 text-primary" /> Tap vibrations
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A small vibration when you tap, close a panel, or finish a surprise.
      </p>
      <Button
        variant={hapticsOn ? "default" : "outline"}
        size="sm"
        className="mt-3"
        aria-pressed={hapticsOn}
        onClick={toggleHaptics}
      >
        {hapticsOn ? "On" : "Off"}
      </Button>
    </section>
  );

  const usageFraction =
    usage?.quota ? Math.min(1, usage.used / usage.quota) : undefined;

  const storage = (
    <section className="py-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <HardDrive className="h-4 w-4 text-primary" /> Storage
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {usage
          ? `Using about ${formatBytes(usage.used)} of ${usage.quota ? formatBytes(usage.quota) : "the device's available"} storage — your surprises and their photos.`
          : "Checking storage usage…"}
      </p>
      {usageFraction !== undefined && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Storage used"
          aria-valuenow={Math.round(usageFraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${usageFraction * 100}%` }}
          />
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => setConfirming("clear-cache")}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Clear temporary files
      </Button>
      {notice && (
        <div className="mt-2">
          <InlineFieldMessage tone="success" message={notice} />
        </div>
      )}
    </section>
  );

  const dangerZone = (
    <section className="border-t border-destructive/30 py-4">
      <h2 className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" /> Danger zone
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Deleting surprises is permanent. Save editable backups from My Surprises before deleting work you want to keep.
      </p>
      <div className="mt-3 space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => setConfirming("delete-surprises")}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete all local surprises
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => setConfirming("reset-settings")}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Reset settings to defaults
        </Button>
      </div>
    </section>
  );

  const privacy = (
    <section className="py-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" /> Privacy
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        No account needed. Your surprises stay on this device unless you
        choose to send or export them. Tiny Surprise does not use automatic
        cloud backup; Android device-to-device migration may vary by device.
        YouTube and linked media load from their providers. The production website
        also uses Vercel Analytics for usage measurement; surprise content is stored locally.
      </p>
    </section>
  );

  const about = (
    <section className="py-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Info className="h-4 w-4 text-primary" /> About Tiny Surprise
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Make personal surprises with words, photos, and music. No account needed.
      </p>
    </section>
  );

  return (
    <>
      <Header />
      <main
        className={`settings-page site-container mx-auto min-h-svh px-4 pt-6 ${native ? "android-page" : "pb-28"} ${twoCol ? "max-w-4xl" : "max-w-2xl"}`}
      >
        <h1 className="site-page-title">Settings</h1>
        {twoCol ? (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="divide-y divide-border/70">
              {profile}
              {savedRecipients}
              {haptics}
              {storage}
              {dangerZone}
            </div>
            <div className="divide-y divide-border/70">
              {privacy}
              {about}
            </div>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-border/70">
            {profile}
            {savedRecipients}
            {haptics}
            {storage}
            {privacy}
            {about}
            {dangerZone}
          </div>
        )}
      </main>
      <ConfirmationModal
        open={confirming === "clear-cache"}
        title="Clear temporary files?"
        message="This clears temporary app files only. Your saved surprises are not affected."
        confirmLabel="Clear temporary files"
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => runDestructiveAction("clear-cache")}
      />
      <ConfirmationModal
        open={confirming === "delete-surprises"}
        title="Delete all local surprises?"
        message="This permanently deletes every surprise saved on this device, including drafts, Received keepsakes, their photos, and saved recipient history. This cannot be undone."
        confirmLabel="Delete everything"
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => runDestructiveAction("delete-surprises")}
      />
      <ConfirmationModal
        open={confirming === "reset-settings"}
        title="Reset settings to defaults?"
        message="This resets tap vibrations and the app’s light or dark appearance on this device. Your saved surprises are not affected."
        confirmLabel="Reset settings"
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => runDestructiveAction("reset-settings")}
      />
      <ConfirmationModal
        open={confirming === "clear-recipients"}
        title="Clear saved recipients?"
        message="This removes everyone from your recent/saved list. Surprises you've already made keep their own recipient name."
        confirmLabel="Clear recipients"
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => runDestructiveAction("clear-recipients")}
      />
    </>
  );
}
