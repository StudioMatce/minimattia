import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import type { BrandTheme } from "@/lib/types/brand";

function getClient() {
  return new Anthropic();
}

function loadFile(relativePath: string): string | null {
  try {
    return readFileSync(
      join(process.cwd(), "src/lib/brand-references", relativePath),
      "utf-8"
    );
  } catch {
    return null;
  }
}

function loadImageBase64(relativePath: string): string | null {
  try {
    const buf = readFileSync(
      join(process.cwd(), "src/lib/brand-references", relativePath)
    );
    return buf.toString("base64");
  } catch {
    return null;
  }
}

/**
 * Convert a sketch image directly to polished SVG using Claude Vision.
 * Uses a one-shot SVG example + brand reference image for style consistency.
 */
export async function sketchToSvg(
  imageBase64: string,
  theme: BrandTheme
): Promise<string> {
  const client = getClient();

  // Load the gold-standard SVG example and one reference image
  const exampleSvg = loadFile("example-output.svg");
  const refImage = loadImageBase64("style-reference.png");

  const systemPrompt = `You convert rough hand-drawn sketches into polished SVG diagrams for Seika Innovation.

ABSOLUTE RULES — NEVER BREAK THESE:

1. ONLY reproduce what is VISIBLE in the sketch. Do NOT add text, labels, descriptions, or any content that is not drawn. If the sketch has no text, the SVG has no text. If a shape has a number written inside, reproduce that number only.

2. CONNECTIONS — reproduce the EXACT path of every line/arrow as drawn:
   - Study each line carefully. Where does it start? Where does it end? Does it go straight, curve, or turn?
   - STRAIGHT: "M x1 y1 L x2 y2"
   - 90° TURN (goes horizontal then turns vertical, or vice versa): "M x1 y1 L xBend yBend L x2 y2". Example — a line going RIGHT then DOWN: "M 280 200 L 400 200 L 400 350"
   - CURVE: use C (cubic) or Q (quadratic) bezier that follows the drawn curve
   - NEVER draw a straight diagonal where the sketch shows a bend or curve.
   - Before writing each <path>, think step by step: "This line exits shape A going [direction], then [turns/curves] [direction], then reaches shape B."

3. POSITIONS — preserve the exact spatial arrangement. Same relative positions, distances, proportions.

4. ARROWS — preserve direction. If the sketch shows an arrowhead, add marker-end. If no arrowhead, no marker.

VISUAL STYLE — apply this style to the shapes from the sketch:

${exampleSvg ?? ""}

STYLE SUMMARY:
- Background: rect fill="${theme.colors.background}"
- Shapes become <ellipse>, not <rect>. Vary sizes to match the sketch proportions.
- Ellipse outlines: dashed (stroke-dasharray="8 5"), stroke="${theme.colors.primary}", fill="none"
- One node can be highlighted: green glow (radialGradient) + stroke="${theme.colors.accent}"
- Connections: <path> stroke="${theme.colors.primary}" stroke-width="1.2"
- Dot markers: small <circle> r="3-6" in ${theme.colors.accent} and ${theme.colors.primary}, near nodes and along connections
- Decorative dashed circles in background (r="7-10", stroke-dasharray="3 3", low opacity)
- <defs> with arrow marker and radialGradient as shown
- Text ONLY if present in the sketch. font-family="${theme.typography.bodyFamily}"

Output ONLY SVG code. Start with <svg, end with </svg>. No markdown, no code fences.`;

  // Build message content
  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  // Add reference image if available
  if (refImage) {
    content.push({
      type: "text",
      text: "This is a real slide from Seika Innovation. Your SVG output must look like it belongs in this presentation:",
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: refImage,
      },
    });
  }

  // Add the sketch
  content.push({
    type: "text",
    text: "Convert this sketch into a polished Seika Innovation SVG. Match the style exactly. Preserve layout, connections, and paths:",
  });
  content.push({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/png",
      data: imageBase64,
    },
  });

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    thinking: {
      type: "enabled",
      budget_tokens: 10000,
    },
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  // Extract text from response (skip thinking blocks)
  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";

  return extractSvg(text);
}

function extractSvg(text: string): string {
  const fenced = text.match(/```(?:svg|xml|html)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = fenced[1].trim();
    if (inner.startsWith("<svg")) return inner;
  }

  const svgStart = text.indexOf("<svg");
  const svgEnd = text.lastIndexOf("</svg>");
  if (svgStart !== -1 && svgEnd !== -1) {
    return text.slice(svgStart, svgEnd + 6);
  }

  if (text.trim().startsWith("<svg")) return text.trim();

  throw new Error("Claude did not generate valid SVG output");
}
