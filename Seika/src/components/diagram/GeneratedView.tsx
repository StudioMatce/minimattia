"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DiagramPreview } from "./DiagramPreview";
import { ExportControls } from "./ExportControls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "./StarRating";

const ENGINE_LABELS: Record<string, string> = {
  fal: "fal.ai FLUX",
  recraft: "Recraft V3",
  gemini: "Gemini",
  claude: "Claude",
};

interface GeneratedViewProps {
  projectId: string;
  svgContentLight: string;
  svgContentDark: string | null;
  hasDarkMode: boolean;
  engine: string;
  onRegenerate: (projectId: string) => Promise<unknown>;
  visualId: string;
  initialRating: number | null;
  initialNote: string | null;
}

export function GeneratedView({
  projectId,
  svgContentLight,
  svgContentDark,
  hasDarkMode,
  engine,
  onRegenerate,
  visualId,
  initialRating,
  initialNote,
}: GeneratedViewProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [regenerating, setRegenerating] = useState(false);

  const currentSvg = mode === "dark" && svgContentDark ? svgContentDark : svgContentLight;

  async function handleRegenerate() {
    setRegenerating(true);
    const toastId = toast.loading("Rigenerazione in corso...");
    try {
      await onRegenerate(projectId);
      toast.success("Rigenerato!", { id: toastId });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore nella rigenerazione";
      toast.error(message, { id: toastId });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <>
      {/* Controls bar */}
      <div className="flex items-center justify-center gap-3 border-b px-4 py-2 min-h-[49px]">
        {hasDarkMode && (
          <div className="flex items-center rounded-md border">
            <Button
              variant={mode === "light" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setMode("light")}
            >
              <Sun className="mr-1 h-3.5 w-3.5" />
              Light
            </Button>
            <Button
              variant={mode === "dark" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setMode("dark")}
            >
              <Moon className="mr-1 h-3.5 w-3.5" />
              Dark
            </Button>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          Rigenera
        </Button>
        <ExportControls svgContent={currentSvg} />
        <Badge variant="secondary" className="text-xs">
          Engine: {ENGINE_LABELS[engine] ?? engine}
        </Badge>
        <StarRating
          visualId={visualId}
          initialRating={initialRating}
          initialNote={initialNote}
        />
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto p-8">
        <DiagramPreview svgContent={currentSvg} />
      </div>
    </>
  );
}
