import { getReleasedTemplateEntries } from "@/lib/config";
import CreateClient from "./create-client";

export function generateStaticParams() {
  return getReleasedTemplateEntries().map(([, template]) => ({
    template: template.id,
  }));
}

export default function CreatePage() {
  return <CreateClient />;
}
