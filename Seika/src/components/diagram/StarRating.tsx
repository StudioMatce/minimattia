"use client";

import { useState, useTransition } from "react";
import { Star, MessageSquarePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { rateVisual } from "@/lib/actions/rating";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  visualId: string;
  initialRating: number | null;
  initialNote: string | null;
}

export function StarRating({ visualId, initialRating, initialNote }: StarRatingProps) {
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState(0);
  const [note, setNote] = useState(initialNote ?? "");
  const [showNote, setShowNote] = useState(!!initialNote);
  const [isPending, startTransition] = useTransition();

  function handleClick(value: number) {
    setRating(value);
    startTransition(async () => {
      try {
        await rateVisual(visualId, value, note || undefined);
        toast.success("Valutazione salvata");
      } catch {
        toast.error("Errore nel salvataggio");
        setRating(initialRating);
      }
    });
  }

  function handleNoteBlur() {
    if (note === (initialNote ?? "")) return;
    if (!rating) return;
    startTransition(async () => {
      try {
        await rateVisual(visualId, rating, note || undefined);
        toast.success("Nota salvata");
      } catch {
        toast.error("Errore nel salvataggio");
      }
    });
  }

  const display = hovered || rating || 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={isPending}
            className="p-0.5 transition-colors disabled:opacity-50"
            onMouseEnter={() => setHovered(value)}
            onClick={() => handleClick(value)}
          >
            <Star
              className={cn(
                "h-4 w-4 transition-colors",
                value <= display
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
      {showNote ? (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Nota..."
          maxLength={200}
          className="h-7 w-40 text-xs"
          disabled={isPending}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setShowNote(true)}
        >
          <MessageSquarePlus className="mr-1 h-3 w-3" />
          nota
        </Button>
      )}
    </div>
  );
}
