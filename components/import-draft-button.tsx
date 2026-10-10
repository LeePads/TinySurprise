"use client";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
/** Every file is previewed and explicitly confirmed in the shared viewer. */
export function ImportDraftButton() {
  return <Button asChild variant="outline" size="sm" className="min-h-12"><Link href="/viewer?purpose=backup"><FileUp className="h-4 w-4" />Restore a backup</Link></Button>;
}
