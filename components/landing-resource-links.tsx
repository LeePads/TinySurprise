"use client";

import type { SVGProps } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openExternalLink } from "@/lib/native/open-link";
import { SITE_LINKS } from "@/lib/site-links";

function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22" />
    </svg>
  );
}

export function LandingResourceLinks({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {[
        { ...SITE_LINKS.android, Icon: Smartphone, variant: compact ? "ghost" as const : "outline" as const },
        { ...SITE_LINKS.github, Icon: GitHubIcon, variant: "ghost" as const },
      ].map(({ label, url, Icon, variant }) => (
        <Button
          key={label}
          asChild
          variant={variant}
          className={`min-h-12 ${variant === "outline" ? "px-4" : "px-3"} ${compact ? "text-white/80 hover:bg-white/10 hover:text-white" : variant === "ghost" ? "text-muted-foreground" : ""}`}
        >
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => { void openExternalLink(url, event); }}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </a>
        </Button>
      ))}
    </>
  );
}
