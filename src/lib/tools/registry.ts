import { PenTool, Shapes, type LucideIcon } from "lucide-react";

export interface ToolDefinition {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

export const TOOLS: ToolDefinition[] = [
  {
    slug: "disegna-schema",
    name: "Disegna schema",
    description: "Disegna uno schema e ottieni un diagramma professionale",
    icon: PenTool,
  },
  {
    slug: "disegna-illustrazione",
    name: "Disegna illustrazione",
    description: "Disegna uno schizzo e ottieni un'illustrazione con ellissi e archi",
    icon: Shapes,
  },
];

export function getToolBySlug(slug: string) {
  return TOOLS.find((t) => t.slug === slug) ?? null;
}
