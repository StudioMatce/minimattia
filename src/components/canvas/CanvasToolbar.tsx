"use client";

import { useState } from "react";
import type { Editor } from "tldraw";
import { Button } from "@/components/ui/button";
import { Save, Sparkles, Loader2 } from "lucide-react";
import { getCanvasSnapshot } from "./SketchCanvas";
import { toast } from "sonner";

interface CanvasToolbarProps {
  editor: Editor | null;
  projectId: string;
  onGenerate: () => void;
  generating?: boolean;
  onSave: (projectId: string, snapshot: unknown) => Promise<unknown>;
}

export function CanvasToolbar({
  editor,
  projectId,
  onGenerate,
  generating,
  onSave,
}: CanvasToolbarProps) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      const snapshot = getCanvasSnapshot(editor);
      await onSave(projectId, snapshot);
      toast.success("Schizzo salvato");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Salva
      </Button>
      <Button size="sm" onClick={onGenerate} disabled={!editor || generating}>
        {generating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {generating ? "Generazione..." : "Genera visual"}
      </Button>
    </>
  );
}
