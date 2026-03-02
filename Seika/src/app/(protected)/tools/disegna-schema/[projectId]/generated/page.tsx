import { redirect } from "next/navigation";
import Link from "next/link";
import { getLatestGenerated, getVisualById, getProjectHistory, regenerateDiagram } from "../actions";
import { GeneratedView } from "@/components/diagram/GeneratedView";
import { HistorySidebar } from "@/components/diagram/HistorySidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";

interface Props {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ v?: string }>;
}

export default async function GeneratedPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { v: visualId } = await searchParams;

  const visual = visualId
    ? await getVisualById(projectId, visualId)
    : await getLatestGenerated(projectId);

  if (!visual) {
    redirect(`/tools/disegna-schema/${projectId}`);
  }

  const history = await getProjectHistory(projectId);

  const diagramJson = visual.diagramJson as {
    directSvg?: boolean;
    hasDarkMode?: boolean;
    svgContentDark?: string;
    engine?: string;
  };

  const basePath = `/tools/disegna-schema/${projectId}/generated`;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-2 min-h-[49px]">
        <Link href={`/tools/disegna-schema/${projectId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Canvas
          </Button>
        </Link>
        <Link href={`/tools/disegna-schema/${projectId}`}>
          <Button size="sm" variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Modifica schizzo
          </Button>
        </Link>
      </div>

      {/* Main area: sidebar + generated view */}
      <div className="flex flex-1 overflow-hidden">
        <HistorySidebar
          history={history}
          currentVisualId={visual.id}
          basePath={basePath}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <GeneratedView
            projectId={projectId}
            svgContentLight={visual.svgContent}
            svgContentDark={diagramJson.svgContentDark ?? null}
            hasDarkMode={diagramJson.hasDarkMode ?? false}
            engine={diagramJson.engine ?? "claude"}
            onRegenerate={regenerateDiagram}
            visualId={visual.id}
            initialRating={visual.rating ?? null}
            initialNote={visual.ratingNote ?? null}
          />
        </div>
      </div>
    </div>
  );
}
