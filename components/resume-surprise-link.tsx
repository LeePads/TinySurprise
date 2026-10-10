"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listCreations, type CreationRecord } from "@/lib/creations";

export function ResumeSurpriseLink() {
  const [draft, setDraft] = useState<CreationRecord>();
  useEffect(() => {
    let active = true;
    void listCreations().then(records => {
      if (active) setDraft(records.find(record => record.status === "draft" && !record.recovery));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <p className="px-4 pb-6 text-center text-sm"><Link className="inline-flex min-h-12 items-center text-primary underline underline-offset-4" href={draft ? `/create/${draft.templateId}?creation=${draft.id}` : "/library"}>{draft ? "Continue your surprise" : "My Surprises"}</Link></p>;
}
