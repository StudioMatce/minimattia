import Anthropic from "@anthropic-ai/sdk";
import type { DiagramGraph } from "@/lib/types/diagram";

const SYSTEM_PROMPT = `You are a diagram structure analyzer for "Seika", a tool that converts rough sketches into polished, brand-compliant diagrams.

Given a sketch image or tldraw shape data, extract the diagram structure as a JSON object.

Rules:
- Every box, circle, or labeled area is a node.
- Every arrow or line connecting nodes is an edge.
- Determine the diagram type: "flowchart" (steps with decisions), "orgchart" (hierarchy), "process" (sequential steps), "mindmap" (branching ideas).
- Determine flow direction: "TB" (top to bottom), "LR" (left to right), "BT" (bottom to top), "RL" (right to left).
- Assign node types: "process" (action step), "decision" (yes/no choice), "start" (beginning), "end" (ending), "data" (input/output), "group" (container for other nodes).
- For grouped nodes, set parentId to the group node's id.
- Edge types: "arrow" (directed), "line" (undirected), "dashed" (optional/conditional).
- Generate short, unique ids like "n1", "n2", "e1", "e2".
- Preserve the user's text labels exactly as written.
- If text is unclear, make your best guess and note it in the label with a "?" suffix.

CRITICAL — Spatial positions:
- You MUST set x and y for every node, representing its approximate position from the sketch.
- Use a 0-1000 coordinate grid where (0,0) is top-left and (1000,1000) is bottom-right.
- Preserve the SPATIAL ARRANGEMENT of the original sketch as accurately as possible.
- If three boxes form a triangle, their x/y values must reflect that triangle layout.
- If boxes are side by side, they should have similar y values but different x values.
- If boxes are stacked vertically, they should have similar x values but different y values.
- The spatial layout is just as important as the connections between nodes.

Output ONLY a valid JSON object matching this TypeScript interface:

interface DiagramGraph {
  title?: string;
  diagramType: "flowchart" | "orgchart" | "process" | "mindmap";
  direction: "TB" | "LR" | "BT" | "RL";
  nodes: Array<{
    id: string;
    label: string;
    type: "process" | "decision" | "start" | "end" | "data" | "group";
    parentId?: string;
    x: number;  // 0-1000, approximate position from sketch
    y: number;  // 0-1000, approximate position from sketch
    metadata?: Record<string, string>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    type: "arrow" | "line" | "dashed";
  }>;
}

No markdown, no explanation, no code fences — just the JSON object.`;

function getClient() {
  return new Anthropic();
}

function extractJson(text: string): string {
  // Try to find JSON in the response, handling possible markdown wrapping
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Try to find a JSON object directly
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);

  return text;
}

export async function analyzeSketchImage(
  imageBase64: string
): Promise<DiagramGraph> {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Analyze this sketch and extract the diagram structure as JSON.",
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(extractJson(text));
}

export async function analyzeSketchShapes(
  shapes: unknown[],
  imageBase64?: string
): Promise<DiagramGraph> {
  const client = getClient();

  // Build a simplified shape description for Claude
  const shapeDescriptions = shapes.map((s: unknown) => {
    const shape = s as Record<string, unknown>;
    const props = shape.props as Record<string, unknown> | undefined;
    return {
      type: shape.type,
      x: shape.x,
      y: shape.y,
      geo: props?.geo,
      w: props?.w,
      h: props?.h,
      text: extractTextFromRichText(props?.richText),
    };
  });

  const content: Anthropic.Messages.ContentBlockParam[] = [];

  // Include image if available for richer analysis
  if (imageBase64) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: imageBase64,
      },
    });
  }

  content.push({
    type: "text",
    text: `Here are the tldraw shapes from the sketch:\n${JSON.stringify(shapeDescriptions, null, 2)}\n\nExtract the diagram structure as JSON.`,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(extractJson(text));
}

function extractTextFromRichText(richText: unknown): string {
  if (!richText || typeof richText !== "object") return "";
  const rt = richText as { type?: string; content?: unknown[] };
  if (rt.type !== "doc" || !Array.isArray(rt.content)) return "";

  return rt.content
    .flatMap((block: unknown) => {
      const b = block as { content?: unknown[] };
      if (!Array.isArray(b.content)) return [];
      return b.content.map((inline: unknown) => {
        const i = inline as { text?: string };
        return i.text ?? "";
      });
    })
    .join(" ")
    .trim();
}
