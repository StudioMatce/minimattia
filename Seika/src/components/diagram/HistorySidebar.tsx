"use client";

import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelLeftClose, PanelLeft, Pencil, Type, Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HistoryEntry {
  id: string;
  createdAt: Date;
  source: "text" | "canvas";
  prompt: string | null;
  engine: string;
  rating: number | null;
}

interface HistorySidebarProps {
  history: HistoryEntry[];
  currentVisualId?: string;
  basePath: string;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function HistorySidebar({ history, currentVisualId, basePath }: HistorySidebarProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  if (history.length === 0) return null;

  if (collapsed) {
    return (
      <div className="border-r flex flex-col items-center py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          title="Mostra storico"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Badge variant="secondary" className="mt-1 text-xs">
          {history.length}
        </Badge>
      </div>
    );
  }

  return (
    <div className="w-56 border-r flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium text-muted-foreground">Storico</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(true)}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {history.map((entry, idx) => {
            const isActive = entry.id === currentVisualId;
            return (
              <button
                key={entry.id}
                onClick={() => {
                  const url = idx === 0
                    ? basePath
                    : `${basePath}?v=${entry.id}`;
                  router.push(url);
                }}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-1.5 w-full">
                  {entry.source === "text" ? (
                    <Type className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium truncate">
                    {entry.source === "text"
                      ? (entry.prompt?.slice(0, 30) ?? "Testo")
                      : "Disegno"}
                    {entry.prompt && entry.prompt.length > 30 ? "..." : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-5">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </span>
                  {entry.rating != null && (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: entry.rating }, (_, i) => (
                        <Star key={i} className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
