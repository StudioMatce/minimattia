"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface TextPromptInputProps {
  onGenerate: (prompt: string) => void;
  generating: boolean;
}

export function TextPromptInput({ onGenerate, generating }: TextPromptInputProps) {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="w-full max-w-xl space-y-4">

        <p className="text-sm text-muted-foreground">
          Descrivi cosa vuoi visualizzare, oppure incolla un concetto da riassumere in schema. Funziona in qualsiasi lingua.
        </p>
        <Textarea
          placeholder={"Es. \"3 fasi: analisi, proposta, contratto — collegate in sequenza\"\n\nOppure incolla un paragrafo lungo e verrà riassunto automaticamente in un diagramma."}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          className="resize-none"
          disabled={generating}
        />
        <Button
          className="w-full"
          onClick={() => onGenerate(prompt)}
          disabled={!prompt.trim() || generating}
        >
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {generating ? "Generazione..." : "Genera da testo"}
        </Button>
      </div>
    </div>
  );
}
