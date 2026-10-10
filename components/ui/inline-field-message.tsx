import { CheckCircle2, Info, TriangleAlert } from "lucide-react";

type MessageTone = "error" | "warning" | "success" | "info";

const styles: Record<MessageTone, { icon: typeof Info; className: string }> = {
  error: { icon: TriangleAlert, className: "inline-field-message--error" },
  warning: { icon: TriangleAlert, className: "inline-field-message--warning" },
  success: { icon: CheckCircle2, className: "inline-field-message--success" },
  info: { icon: Info, className: "inline-field-message--info" },
};

export function InlineFieldMessage({
  message,
  tone = "error",
  id,
}: {
  message?: string;
  tone?: MessageTone;
  id?: string;
}) {
  if (!message) return null;
  const config = styles[tone];
  const Icon = config.icon;
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={`inline-field-message mt-2 flex items-start gap-2 text-sm leading-5 ${config.className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
