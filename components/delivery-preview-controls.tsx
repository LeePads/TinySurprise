import { Monitor, RotateCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeliveryPreviewControls({
  liveMode,
  native = false,
  onLiveMode,
  onRestart,
  restartLabel,
}: {
  native?: boolean;
  liveMode: "mobile" | "desktop";
  onLiveMode: (mode: "mobile" | "desktop") => void;
  onRestart: () => void;
  restartLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {!native && <div
        className="flex rounded-xl border bg-background p-1"
        role="group"
        aria-label="Delivery preview viewport"
      >
        <Button
          size="sm"
          type="button"
          variant={liveMode === "mobile" ? "default" : "ghost"}
          aria-pressed={liveMode === "mobile"}
          onClick={() => onLiveMode("mobile")}
        >
          <Smartphone className="mr-1 h-4 w-4" />
          Phone
        </Button>
        <Button
          size="sm"
          type="button"
          variant={liveMode === "desktop" ? "default" : "ghost"}
          aria-pressed={liveMode === "desktop"}
          onClick={() => onLiveMode("desktop")}
        >
          <Monitor className="mr-1 h-4 w-4" />
          Desktop
        </Button>
      </div>}
      <Button size="sm" type="button" variant="outline" onClick={onRestart}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {restartLabel}
      </Button>
    </div>
  );
}
