"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { openExternalLink } from "@/lib/native/open-link";
import { parseYouTubeUrl, youtubeWatchUrl } from "@/lib/youtube";

export function ExternalSongLink({ url }: { url?: string }) {
  const [unconfirmed, setUnconfirmed] = useState(false);
  const video = parseYouTubeUrl(url);
  const href = video && youtubeWatchUrl(video.id);
  if (!href) return null;
  return <div className="recipient-external-song space-y-1 text-sm">
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(event) => { void openExternalLink(href, event).then(opened => setUnconfirmed(!opened)); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-current px-4 font-semibold">
      <ExternalLink className="h-4 w-4" aria-hidden="true" />Open YouTube
    </a>
    <p>Needs internet. Return here to continue your surprise.</p>
    {unconfirmed && <p role="status">We couldn’t confirm that YouTube opened. Use the link to try again; you can still continue your surprise.</p>}
  </div>;
}
