import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, appendFileSync } from "fs";
import { join } from "path";

export type ColorMode = "light" | "dark";

const PALETTES: Record<ColorMode, { background: string; stroke: string; accent: string; text: string }> = {
  light: {
    background: "#EBEEE4",
    stroke: "#1C2D28",
    accent: "#00A67D",
    text: "#1C2D28",
  },
  dark: {
    background: "#1C2D28",
    stroke: "#EBEEE4",
    accent: "#00A67D",
    text: "#EBEEE4",
  },
};

function log(msg: string) {
  const line = `[${new Date().toISOString()}] [gemini] ${msg}\n`;
  console.log(line);
  try { appendFileSync(join(process.cwd(), "generation.log"), line); } catch { /* */ }
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
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

// ────────────────────────────────────────────
// Pass 1: Analyze sketch → structured JSON
// ────────────────────────────────────────────

type BrandColor = "dark" | "accent" | "light";

interface SketchNode {
  id: string;
  label: string;
  cx: number;
  cy: number;
  r?: number;
  rx?: number;
  ry?: number;
  highlighted: boolean;
  strokeColor: BrandColor;
  labelColor: BrandColor;
}

interface SketchEdge {
  from: string;
  to: string;
  type: "straight" | "bend-90" | "curve";
  hasArrow: boolean;
  bendPoints?: { x: number; y: number }[];
  color: BrandColor;
  dashed: boolean;
}

interface SketchStructure {
  width: number;
  height: number;
  nodes: SketchNode[];
  edges: SketchEdge[];
}

async function analyzeSketch(
  ai: GoogleGenAI,
  sketchBase64: string,
  learningContext?: string
): Promise<SketchStructure> {
  log("Pass 1: Analyzing sketch structure...");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: { mimeType: "image/png", data: sketchBase64 },
          },
          {
            text: `Analyze this hand-drawn sketch and extract its structure as JSON.

The sketch uses 3 BRAND COLORS — detect them carefully:
- "dark" = dark green/black (#1C2D28) — the default color for most elements
- "accent" = bright green (#00A67D) — used to highlight important elements
- "light" = beige/cream (#EBEEE4) — used for secondary/background elements

Map the sketch into the CONTENT AREA of a 900×600 canvas with 15% padding:
- X range: 135 to 765 (content width = 630)
- Y range: 90 to 510 (content height = 420)
- All cx, cy coordinates MUST be within these ranges.
- Node radius should be 50-65.

For each shape/node found, output:
- id: "n1", "n2", etc.
- label: any text visible inside the shape (empty string if none)
- cx, cy: center position WITHIN the content area (x: 135-765, y: 90-510)
- r: radius (range 50-65). ALL nodes are CIRCLES. NEVER use "rx"/"ry" — only "r".
- highlighted: true if either the outline OR the text uses the ACCENT color (bright green)
- strokeColor: "dark", "accent", or "light" — the color of the node's OUTLINE/BORDER as drawn in the sketch
- labelColor: "dark", "accent", or "light" — the color of the TEXT/CONTENT inside the node. This can be DIFFERENT from strokeColor. Look carefully at the actual text color.

For each connection/line/arrow, output:
- from: id of source node
- to: id of target node
- type: "straight" (horizontal or vertical line), "bend-90" (line with 90-degree turn), or "curve" (smooth curved line)
- hasArrow: true if there's an arrowhead
- bendPoints: array of {x, y} points:
  - For "bend-90": the corner points where the line turns 90 degrees
  - For "curve": control points that define the curve shape (1 point = quadratic, 2 points = cubic bezier)
  - For "straight": omit or empty array
- color: "dark", "accent", or "light" — the color of the line as drawn in the sketch
- dashed: true if the line is dashed/dotted, false if solid

CRITICAL RULES:
- Include EVERY node and EVERY connection visible in the sketch. Missing even one is a failure.
- Count all lines/arrows carefully. For each line you see, there MUST be a corresponding edge in the output.
- Do NOT add elements that are not in the sketch.
- Do NOT interpret meaning — only describe what is visually present.
- Preserve the exact spatial arrangement — if something is top-left, its cx should be low and cy should be low.
- Preserve colors exactly as drawn. The outline color (strokeColor) and the text color (labelColor) of a node can be different — detect each independently. A green outline with dark text is strokeColor="accent", labelColor="dark".
- NO DIAGONAL CONNECTIONS: All connections must be horizontal or vertical. If a line in the sketch looks diagonal, convert it to a "bend-90" with an L-shaped path (horizontal segment + vertical segment with a 90° corner).
- CONNECTION TYPES: Detect the actual shape of each line:
  - Straight horizontal/vertical lines → "straight" (ONLY if nodes share same cx or same cy)
  - Lines connecting nodes at different cx AND different cy → "bend-90" (ALWAYS — decompose into H+V segments with bendPoints at corners)
  - Smooth curved/arc lines → "curve" (provide control points in bendPoints for the bezier curve)
- PARALLEL EDGES: If multiple connections run along the same axis, offset their bendPoints by 20px so they don't overlap visually.
- If a single shape is divided into sections (e.g. a box split by internal lines), treat each section as a separate adjacent node. Place them tangent (borders touching, distance between centers = r1 + r2).
- Ensure nodes don't overlap each other.

Output ONLY valid JSON matching this schema:
{
  "width": 900,
  "height": 600,
  "nodes": [...],
  "edges": [...]
}
${learningContext ? `\n${learningContext}\n` : ""}
No markdown, no explanation, just JSON.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT"],
      thinkingConfig: { thinkingBudget: 4000 },
    },
  });

  const text = response.text ?? "";
  log(`Pass 1 raw output: ${text}`);

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON in pass 1");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = JSON.parse(jsonMatch[0]) as SketchStructure & { nodes: any[]; edges: any[] };

  // Ensure color defaults — handle old "color" field and missing fields
  for (const node of raw.nodes) {
    const legacy = (node as { color?: string }).color;
    if (!node.strokeColor) node.strokeColor = legacy ?? (node.highlighted ? "accent" : "dark");
    if (!node.labelColor) node.labelColor = legacy ?? (node.highlighted ? "accent" : "dark");
    // Glow when any color is accent, but don't override individual colors
    if (node.highlighted === undefined) {
      node.highlighted = node.strokeColor === "accent" || node.labelColor === "accent";
    }
  }
  for (const edge of raw.edges) {
    if (!edge.color) edge.color = "dark";
    if (edge.dashed === undefined) edge.dashed = false;
    if (!edge.type) edge.type = "straight";
  }

  log(`Pass 1 result: ${raw.nodes.length} nodes, ${raw.edges.length} edges`);
  return raw;
}

// ────────────────────────────────────────────
// Pass 1b: Text prompt → structured JSON
// ────────────────────────────────────────────

async function analyzeTextPrompt(
  textPrompt: string,
  learningContext?: string
): Promise<SketchStructure> {
  log("Pass 1 (text/Claude): Analyzing text prompt...");

  const client = new Anthropic();

  const prompt = `You are a concept-to-diagram analyst. Read the following INPUT TEXT — it can be a short instruction, a long paragraph, an article excerpt, a concept description, or anything in any language. Your job is to:
1. UNDERSTAND the core concept, process, or structure described
2. SUMMARIZE it into 3-8 key elements (nodes) and their relationships (edges)
3. OUTPUT a clean diagram structure as JSON

INPUT TEXT:
"""
${textPrompt}
"""

INTERPRETATION RULES:
- If the text is long or complex, distill it to the essential concepts — do NOT create a node for every sentence
- If the text is in a foreign language, understand it but write node labels in ITALIAN (short: 1-3 words per label)
- If the text describes a process/flow, arrange nodes left-to-right or top-to-bottom with arrows
- If the text describes a hierarchy, arrange as a tree
- If the text describes related concepts, arrange as a network/cluster
- If the text mentions something as "key", "important", "central", "core" → highlight it
- If it's a simple instruction (e.g. "3 circles in a row"), follow it literally
- Keep labels concise: max 3 words per node. Summarize, don't quote verbatim.

BRAND COLORS:
- "dark" = dark green/black (#1C2D28) — default for most elements
- "accent" = bright green (#00A67D) — for important/highlighted elements
- "light" = beige/cream (#EBEEE4) — for secondary elements

CANVAS: 900×600 with 15% padding:
- X range: 135 to 765, Y range: 90 to 510
- All cx, cy MUST be within these ranges

NODE FORMAT:
- id: "n1", "n2", etc.
- label: concise Italian label (1-3 words). If 2+ words, they will be rendered on SEPARATE LINES inside the circle — so keep each word short.
- cx, cy: center position within content area
- r: radius (ALWAYS use "r", range 50-65). ALL nodes are CIRCLES. NEVER use "rx"/"ry" — only "r".
- highlighted: true for key concepts
- strokeColor, labelColor: "dark", "accent", or "light"

EDGE FORMAT:
- from, to: node ids
- type: "straight", "bend-90", or "curve"
- hasArrow: true for directional flows
- bendPoints: array of {x, y} (empty for straight)
- color: "dark", "accent", or "light"
- dashed: false (default)

LAYOUT RULES (CRITICAL):
- GRID ALIGNMENT: Nodes MUST be placed on a grid — every node must share its cx with at least one other node (same column) OR share its cy with at least one other node (same row).
- NO DIAGONAL CONNECTIONS: Because nodes are grid-aligned, all "straight" edges are perfectly horizontal or vertical. If two nodes are not on the same row or column, use "bend-90" with a bendPoint to create an L-shaped or Z-shaped path (H then V, or V then H). NEVER connect two nodes diagonally.
- SPACING: Min 150px between node centers on the same axis. Nodes must NOT overlap.
- EDGE SEPARATION: If multiple edges run parallel on the same axis, offset their bendPoints by 20px so they don't visually overlap.
- Use "accent" only for 1-2 key nodes, not all.
- Typical layouts:
  - Process/flow → single horizontal row (all same cy)
  - Hierarchy → rows at different cy values, centered columns
  - Network → 2-3 rows with staggered columns

Output ONLY valid JSON:
{
  "width": 900,
  "height": 600,
  "nodes": [...],
  "edges": [...]
}

No markdown fences, no explanation, just the JSON object.${learningContext ? `\n\n${learningContext}` : ""}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";
  log(`Pass 1 (text/Claude) raw output: ${text}`);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON in pass 1 (text)");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = JSON.parse(jsonMatch[0]) as SketchStructure & { nodes: any[]; edges: any[] };

  for (const node of raw.nodes) {
    const legacy = (node as { color?: string }).color;
    if (!node.strokeColor) node.strokeColor = legacy ?? (node.highlighted ? "accent" : "dark");
    if (!node.labelColor) node.labelColor = legacy ?? (node.highlighted ? "accent" : "dark");
    if (node.highlighted === undefined) {
      node.highlighted = node.strokeColor === "accent" || node.labelColor === "accent";
    }
  }
  for (const edge of raw.edges) {
    if (!edge.color) edge.color = "dark";
    if (edge.dashed === undefined) edge.dashed = false;
    if (!edge.type) edge.type = "straight";
  }

  log(`Pass 1 (text) result: ${raw.nodes.length} nodes, ${raw.edges.length} edges`);
  return raw;
}

// ────────────────────────────────────────────
// Pass 2: Structure + style → SVG
// ────────────────────────────────────────────

async function generateSvg(
  ai: GoogleGenAI,
  structure: SketchStructure,
  mode: ColorMode
): Promise<string> {
  log(`Pass 2: Generating SVG (${mode})...`);

  const exampleSvg = loadFile("example-output.svg");
  const designSpec = loadFile("design-spec.md");

  const refFile = mode === "dark" ? "style-reference-dark.png" : "style-reference.png";
  const refs = [
    loadImageBase64(refFile),
    loadImageBase64("style-reference-areas.png"),
  ].filter((r): r is string => r !== null);

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  // Style references
  parts.push({
    text: `Style reference images (Seika Innovation brand, ${mode} mode):`,
  });
  for (const ref of refs) {
    parts.push({ inlineData: { mimeType: "image/png", data: ref } });
  }

  // Structure + design spec + generation instructions
  parts.push({
    text: `Generate SVG code for a diagram. Follow the DESIGN SPECIFICATION exactly.

DIAGRAM STRUCTURE (extracted from a hand-drawn sketch):
${JSON.stringify(structure, null, 2)}

DESIGN SPECIFICATION — follow every rule precisely:
${designSpec ?? ""}

SVG EXAMPLE — replicate this exact style (adapt colors to ${mode} mode):
${exampleSvg ?? ""}

Generate the SVG for ${mode.toUpperCase()} MODE.

COLOR MAPPING (from sketch colors to SVG colors in ${mode} mode):
- "dark" → stroke="${mode === "light" ? "#1C2D28" : "#EBEEE4"}"
- "accent" → stroke="#00A67D" (same in both modes)
- "light" → stroke="${mode === "light" ? "#EBEEE4" : "#1C2D28"}" (subtle/secondary)

RULES:
- Each node has "strokeColor" (outline) and "labelColor" (text inside). They can be DIFFERENT. Apply each independently.
- Use the COLOR MAPPING above to convert "dark"/"accent"/"light" to actual hex colors.
- ALL nodes MUST be <circle cx="" cy="" r=""> — NEVER use <ellipse>. Even if the structure has rx/ry, use <circle> with r.
- Node outline: use strokeColor for the <circle> stroke attribute.
- Node text: use labelColor for the <text> fill attribute.
- A node with highlighted=true gets a GLOW effect (radial gradient circle behind it). But ALWAYS use the node's own strokeColor for its outline and labelColor for its text — highlighted only adds the glow, it does NOT override colors.
- Nodes with highlighted=false: dashed outline using their strokeColor, text using their labelColor.
- Each edge has a "color" field. Use it to set the connection stroke color.
- Edges have a "dashed" field: if true use stroke-dasharray="5 4", if false use solid line.
- ALL nodes have SOLID fill (fill="${mode === "light" ? "#EBEEE4" : "#1C2D28"}"). The fill is critical — it covers connections underneath.
- Draw ALL connections BEFORE all nodes in SVG order.
- Use the coordinates from the structure exactly. Do NOT add elements not in the structure.

TEXT INSIDE NODES (CRITICAL — MUST FOLLOW):
- NEVER render a label as a single long line. ALWAYS split multi-word labels into separate lines.
- Use <text> with text-anchor="middle" and dominant-baseline="central" at the node center.
- For EACH WORD in the label, create a separate <tspan> element:
  - 1 word: <tspan x="{cx}" dy="0">{word}</tspan>
  - 2 words: <tspan x="{cx}" dy="-0.6em">{word1}</tspan><tspan x="{cx}" dy="1.2em">{word2}</tspan>
  - 3 words: <tspan x="{cx}" dy="-1.2em">{word1}</tspan><tspan x="{cx}" dy="1.2em">{word2}</tspan><tspan x="{cx}" dy="1.2em">{word3}</tspan>
- Every <tspan> MUST have x="{node cx}" to stay horizontally centered.
- Font size: 13px. Reduce to 11px if any word is longer than 8 characters.
- Text must NOT touch the circle border — keep within 65% of the radius.

DECORATIVE ELEMENTS PLACEMENT:
- Decorative elements (dots, dashed rings, background circles) add visual richness but must NEVER overlap diagram content.
- The content area is x: 135–765, y: 90–510. Decorations must be placed OUTSIDE this zone, in the margins only:
  - Top margin: y < 70
  - Bottom margin: y > 530
  - Left margin: x < 115
  - Right margin: x > 785
- Place decorations in corners and edges of the canvas — never near the center.
- Keep at least 20px clearance from any node or connection path.

EDGE RENDERING BY TYPE:
- CRITICAL: All connections must be HORIZONTAL or VERTICAL. NEVER render a diagonal line.
- "straight": render as <line> — ONLY when source and target share the same cx (vertical line) or same cy (horizontal line). The line goes from the node border to the other node border.
- "bend-90": render as <path> with L-shaped or Z-shaped segments using only H and V directions. Use the bendPoints as corners where the path turns 90°. Example: d="M startX,startY L bendX,startY L bendX,endY L endX,endY" (go horizontal first, then vertical). Use stroke-linejoin="round" with rx="8" for smooth 8-12px rounded corners at bends.
- "curve": render as <path> with quadratic bezier using Q command — but constrain the control point so the curve stays close to H/V axes. The curve should approximate a rounded L-turn, not a diagonal arc.
- If two nodes are at different cx AND different cy, the connection MUST use "bend-90" — never a straight diagonal.
- PARALLEL EDGE SEPARATION: If multiple edges share a segment on the same axis, offset them by 15-20px so they don't overlap visually.
- ARROWHEADS (CRITICAL): if hasArrow=true, add marker-end="url(#arrowhead)". Define the arrowhead marker in <defs> as a FILLED CLOSED TRIANGLE — NOT two open lines. Use:
  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
    <polygon points="0 0, 10 3.5, 0 7" fill="{stroke color}" />
  </marker>
  If edges use different colors, define one marker per color (e.g. #arrowhead-dark, #arrowhead-accent).

Output ONLY the SVG. Start with <svg, end with </svg>. No markdown, no code fences.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT"],
      thinkingConfig: { thinkingBudget: 4000 },
    },
  });

  const text = response.text ?? "";
  return extractSvg(text);
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Two-pass sketch → SVG generation:
 * Pass 1 (Flash): analyze sketch → structured JSON
 * Pass 2 (Pro): structure + style references → branded SVG
 */
export async function sketchToSvgGemini(
  sketchBase64: string,
  mode: ColorMode = "light"
): Promise<string> {
  const ai = getClient();

  // Pass 1: extract structure (shared across light/dark)
  const structure = await analyzeSketch(ai, sketchBase64);

  // Pass 2: generate styled SVG
  const svg = await generateSvg(ai, structure, mode);
  log(`Pass 2 complete (${mode}): ${svg.length} chars`);
  return svg;
}

/**
 * Text prompt → SVG generation (both light + dark).
 * Uses analyzeTextPrompt for Pass 1, then same Pass 2 as sketch.
 */
export async function textPromptToSvgGeminiBoth(
  textPrompt: string,
  learningContext?: string
): Promise<{ light: string; dark: string }> {
  const ai = getClient();

  // Pass 1: Claude analyzes text → structure
  const structure = await analyzeTextPrompt(textPrompt, learningContext);

  const light = await generateSvg(ai, structure, "light");
  log(`Light SVG (text) complete: ${light.length} chars`);

  const dark = lightToDark(light);
  log(`Dark SVG (text) derived: ${dark.length} chars`);

  return { light, dark };
}

/**
 * Swap light palette colors to dark palette in an SVG string.
 */
function lightToDark(svg: string): string {
  const light = PALETTES.light;
  const dark = PALETTES.dark;

  // Use placeholders to avoid double-replacement
  let result = svg;
  result = result.replaceAll(light.background, "___BG___");
  result = result.replaceAll(light.stroke, "___STROKE___");
  // accent (#00A67D) stays the same in both modes
  result = result.replaceAll("___BG___", dark.background);
  result = result.replaceAll("___STROKE___", dark.stroke);
  return result;
}

/**
 * Analyze sketch once, generate light SVG, derive dark by color swap.
 */
export async function sketchToSvgGeminiBoth(
  sketchBase64: string,
  learningContext?: string
): Promise<{ light: string; dark: string }> {
  const ai = getClient();

  // Pass 1: extract structure once
  const structure = await analyzeSketch(ai, sketchBase64, learningContext);

  // Pass 2: generate light SVG only
  const light = await generateSvg(ai, structure, "light");
  log(`Light SVG complete: ${light.length} chars`);

  // Derive dark by swapping colors
  const dark = lightToDark(light);
  log(`Dark SVG derived: ${dark.length} chars`);

  return { light, dark };
}

function extractSvg(text: string): string {
  let svg = "";

  const fenced = text.match(/```(?:svg|xml|html)?\s*([\s\S]*?)```/);
  if (fenced) {
    const inner = fenced[1].trim();
    if (inner.startsWith("<svg")) svg = inner;
  }

  if (!svg) {
    const svgStart = text.indexOf("<svg");
    const svgEnd = text.lastIndexOf("</svg>");
    if (svgStart !== -1 && svgEnd !== -1) {
      svg = text.slice(svgStart, svgEnd + 6);
    }
  }

  if (!svg && text.trim().startsWith("<svg")) svg = text.trim();

  if (!svg) throw new Error("Gemini did not generate valid SVG output");

  // Make SVG responsive: remove fixed width/height, keep viewBox
  svg = svg.replace(/(<svg[^>]*?)\s+width="[^"]*"/i, "$1");
  svg = svg.replace(/(<svg[^>]*?)\s+height="[^"]*"/i, "$1");

  return svg;
}
