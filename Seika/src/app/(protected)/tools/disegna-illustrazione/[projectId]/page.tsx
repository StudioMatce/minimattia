"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Editor } from "tldraw";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { TextPromptInput } from "@/components/canvas/TextPromptInput";
import { getCanvasSnapshot, getCanvasImageBase64 } from "@/components/canvas/SketchCanvas";
import { saveSketch, saveTextPromptSketch } from "@/app/(protected)/tools/disegna-illustrazione/actions";
import { getProjectHistory } from "./actions";
import { HistorySidebar } from "@/components/diagram/HistorySidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const SketchCanvas = dynamic(
  () =>
    import("@/components/canvas/SketchCanvas").then((m) => ({
      default: m.SketchCanvas,
    })),
  {
    ssr: false,
    loading: () => <div className="flex-1 animate-pulse bg-muted" />,
  }
);

export default function ProjectCanvasPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [snapshot, setSnapshot] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<"draw" | "describe">("draw");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getProjectHistory>>>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${params.projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sketch?.snapshotJson) {
            setSnapshot(data.sketch.snapshotJson);
          }
        }
      } catch {
        // Project might not exist yet in DB
      }
      setLoaded(true);
    }
    load();
    getProjectHistory(params.projectId).then(setHistory).catch(() => {});
  }, [params.projectId]);

  const handleEditorReady = useCallback((ed: Editor) => {
    setEditor(ed);
  }, []);

  async function handleGenerate() {
    if (!editor) return;

    const shapeIds = [...editor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) {
      toast.error("Disegna qualcosa prima di generare");
      return;
    }

    setGenerating(true);
    const toastId = toast.loading("Generazione in corso...");

    try {
      const snapshotData = getCanvasSnapshot(editor);
      await saveSketch(params.projectId, snapshotData);

      const imageBase64 = await getCanvasImageBase64(editor);

      if (!imageBase64) {
        toast.error("Impossibile esportare il canvas", { id: toastId });
        return;
      }

      const res = await fetch("/api/generate-illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: params.projectId,
          imageBase64,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nella generazione");
      }

      toast.success("Illustrazione generata!", { id: toastId });
      router.push(`/tools/disegna-illustrazione/${params.projectId}/generated`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Errore nella generazione";
      toast.error(message, { id: toastId });
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateFromText(prompt: string) {
    setGenerating(true);
    const toastId = toast.loading("Generazione in corso...");

    try {
      await saveTextPromptSketch(params.projectId, prompt);

      const res = await fetch("/api/generate-illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: params.projectId,
          textPrompt: prompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nella generazione");
      }

      toast.success("Illustrazione generata!", { id: toastId });
      router.push(`/tools/disegna-illustrazione/${params.projectId}/generated`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Errore nella generazione";
      toast.error(message, { id: toastId });
    } finally {
      setGenerating(false);
    }
  }

  if (!loaded) {
    return <div className="flex-1 animate-pulse bg-muted" />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2 min-h-[49px]">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "draw" | "describe")}>
          <TabsList>
            <TabsTrigger value="draw">Disegna</TabsTrigger>
            <TabsTrigger value="describe">Descrivi</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "draw" && (
          <CanvasToolbar
            editor={editor}
            projectId={params.projectId}
            onGenerate={handleGenerate}
            generating={generating}
            onSave={saveSketch}
          />
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <HistorySidebar
          history={history}
          basePath={`/tools/disegna-illustrazione/${params.projectId}/generated`}
        />
        <div className="flex-1">
          {mode === "draw" ? (
            <SketchCanvas
              initialSnapshot={snapshot}
              onEditorReady={handleEditorReady}
            />
          ) : (
            <TextPromptInput
              onGenerate={handleGenerateFromText}
              generating={generating}
            />
          )}
        </div>
      </div>
    </div>
  );
}
