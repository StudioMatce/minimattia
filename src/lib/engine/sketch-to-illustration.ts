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
  const line = `[${new Date().toISOString()}] [gemini-illustration] ${msg}\n`;
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

interface IllustrationNode {
  id: string;
  label: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  highlighted: boolean;
  strokeColor: BrandColor;
  labelColor: BrandColor;
}

interface IllustrationEdge {
  from: string;
  to: string;
  hasArrow: boolean;
  curveDirection: "up" | "down";
  color: BrandColor;
  dashed: boolean;
}

interface IllustrationStructure {
  width: number;
  height: number;
  nodes: IllustrationNode[];
  edges: IllustrationEdge[];
}

async function analyzeSketch(
  ai: GoogleGenAI,
  sketchBase64: string,
  learningContext?: string
): Promise<IllustrationStructure> {
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
            text: `Analyze this hand-drawn sketch and extract its structure as JSON for an ILLUSTRATION with ellipses and arc connections.

The sketch uses 3 BRAND COLORS — detect them carefully:
- "dark" = dark green/black (#1C2D28) — the default color for most elements
- "accent" = bright green (#00A67D) — used to highlight important elements
- "light" = beige/cream (#EBEEE4) — used for secondary/background elements

Map the sketch into the CONTENT AREA of a 900×600 canvas with 15% padding:
- X range: 135 to 765 (content width = 630)
- Y range: 90 to 510 (content height = 420)
- All cx, cy coordinates MUST be within these ranges.

For each shape/node found, output:
- id: "n1", "n2", etc.
- label: any text visible inside the shape (empty string if none)
- cx, cy: center position WITHIN the content area (x: 135-765, y: 90-510)
- rx: horizontal radius
- ry: vertical radius
- SHAPE PRESERVATION: Look at the actual shape in the sketch:
  - If the shape is a CIRCLE (round): set rx = ry (same value, range 45-65)
  - If the shape is an ELLIPSE (oval/stretched): set rx != ry (rx: 60-120, ry: 40-80)
  - Match the proportions you SEE in the sketch. Circles MUST stay circular (rx=ry).
- highlighted: true if either the outline OR the text uses the ACCENT color (bright green)
- strokeColor: "dark", "accent", or "light" — the color of the node's OUTLINE/BORDER
- labelColor: "dark", "accent", or "light" — the color of the TEXT/CONTENT inside the node

For each connection/arc, output:
- from: id of source node
- to: id of target node
- hasArrow: true if there's an arrowhead
- curveDirection: "up" or "down" — which direction does the arc curve?
  - "up" = the arc bulges ABOVE the straight line between the two nodes
  - "down" = the arc bulges BELOW the straight line between the two nodes
  - Look at the sketch: if the curve bows upward, use "up". If it bows downward, use "down".
  - If adjacent connections exist, alternate "up" and "down" so they don't overlap.
- color: "dark", "accent", or "light" — the color of the arc
- dashed: true if the line is dashed/dotted, false if solid

CRITICAL RULES:
- ALL nodes use <ellipse> with rx/ry — but circles in the sketch MUST have rx=ry
- ALL connections are arcs with a curveDirection
- Include EVERY node and EVERY connection visible in the sketch
- Do NOT add elements that are not in the sketch
- Preserve the exact spatial arrangement
- Preserve colors exactly as drawn
- Ensure nodes don't overlap each other

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

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON in pass 1");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = JSON.parse(jsonMatch[0]) as IllustrationStructure & { nodes: any[]; edges: any[] };

  // Ensure defaults
  for (const node of raw.nodes) {
    if (!node.rx) node.rx = 55;
    if (!node.ry) node.ry = 55;
    const legacy = (node as { color?: string }).color;
    if (!node.strokeColor) node.strokeColor = legacy ?? (node.highlighted ? "accent" : "dark");
    if (!node.labelColor) node.labelColor = legacy ?? (node.highlighted ? "accent" : "dark");
    if (node.highlighted === undefined) {
      node.highlighted = node.strokeColor === "accent" || node.labelColor === "accent";
    }
    // Force near-circular shapes to be perfect circles:
    // if rx and ry differ by less than 30%, equalize to the average
    const ratio = Math.min(node.rx, node.ry) / Math.max(node.rx, node.ry);
    if (ratio > 0.7) {
      const avg = Math.round((node.rx + node.ry) / 2);
      node.rx = avg;
      node.ry = avg;
    }
  }
  for (const edge of raw.edges) {
    if (!edge.color) edge.color = "dark";
    if (edge.dashed === undefined) edge.dashed = false;
    if (!edge.curveDirection) edge.curveDirection = "down";
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
): Promise<IllustrationStructure> {
  log("Pass 1 (text/Claude): Analyzing text prompt...");

  const client = new Anthropic();

  const prompt = `You are a visual composition designer. Read the following INPUT TEXT and translate the concept into a PURELY VISUAL illustration — an abstract composition of circles connected by elegant arcs. NO TEXT, NO LABELS — only shapes, colors, and connections.

INPUT TEXT:
"""
${textPrompt}
"""

STEP 1 — CHOOSE A COMPOSITION ARCHETYPE:
Analyze the concept and pick the BEST archetype from the list below. Each archetype produces a different visual feel.

ARCHETYPE "orbitale" — One large central circle with smaller ones arranged around it.
- Use when: central concept + related elements, core idea + satellites, hub-and-spoke
- Layout: 1 large circle (r: 60-65) at center (~450, 300), 3-6 smaller circles (r: 40-50) arranged in a ring around it at varying distances (180-250px from center). Not evenly spaced — offset some for organic feel.
- Arcs: from center to each satellite, alternating up/down.
- Highlighted: the central node.

ARCHETYPE "costellazione" — Scattered asymmetric arrangement, like a star constellation.
- Use when: network of ideas, diverse concepts, exploration, creativity
- Layout: 4-7 circles of varying sizes scattered across the canvas. Asymmetric — NOT a grid. Clusters of 2-3 nearby, some isolated. Vary distances (150-300px apart).
- Arcs: connect nearby nodes, skip distant ones. Mix of arrow/no-arrow.
- Highlighted: 1 node, not necessarily the largest.

ARCHETYPE "cascata" — Descending diagonal arrangement from top-left to bottom-right.
- Use when: hierarchy, progression, phases, evolution, timeline
- Layout: 4-6 circles arranged diagonally. Each node is ~130px right and ~80px down from the previous. Sizes decrease along the cascade (first: 60, last: 40).
- Arcs: sequential (n1→n2→n3→...), all with arrows, alternating up/down.
- Highlighted: the first (top) node.

ARCHETYPE "flusso" — Horizontal row, evenly or rhythmically spaced.
- Use when: process, sequence, pipeline, steps, linear flow
- Layout: 3-6 circles on the same cy (~300), spaced ~130-160px apart. Vary sizes slightly for rhythm.
- Arcs: sequential with arrows (n1→n2→n3→...), alternating up/down.
- Highlighted: 1 key step node.

ARCHETYPE "grappolo" — Tight cluster of circles, like a bunch of grapes.
- Use when: group of related things, team, collection, ecosystem
- Layout: 4-7 circles packed close together (100-140px apart) in an organic blob. 2-3 rows, staggered columns. Mix of sizes.
- Arcs: many connections within the cluster, short arcs.
- Highlighted: 1 central node in the cluster.

ARCHETYPE "triangolo" — Three main circles in a triangular arrangement.
- Use when: three pillars, triad, balance, foundation, triangle relationship
- Layout: 3 circles at triangle vertices. Top center (~450, 160), bottom-left (~280, 420), bottom-right (~620, 420). Optional 1-2 smaller satellites.
- Arcs: connect all three (triangle edges), alternating up/down.
- Highlighted: the top node.

STEP 2 — GENERATE THE STRUCTURE:

BRAND COLORS:
- "dark" = #1C2D28 — default for most elements
- "accent" = #00A67D — for 1-2 important/central elements
- "light" = #EBEEE4 — for background/secondary elements

CANVAS: 900×600, CONTENT AREA with 15% padding:
- X range: 135 to 765 (width 630), Y range: 90 to 510 (height 420)
- All cx, cy MUST be within these ranges
- Node borders (cx ± r) must also stay within — account for radius!
- Center the composition within this area.

NODE FORMAT:
- id: "n1", "n2", etc.
- label: "" (ALWAYS empty — no text)
- cx, cy: position within content area
- rx, ry: MUST be equal (rx = ry). ALL nodes are CIRCLES.
- SIZES: small (r: 40-45), medium (r: 50-55), large (r: 60-65)
- highlighted: true for 1-2 key nodes only
- strokeColor: "dark", "accent", or "light"
- labelColor: "dark" (required but unused)

EDGE FORMAT:
- from, to: node ids
- hasArrow: true for directional flows, false for associations
- curveDirection: "up" or "down" — STRICTLY alternate consecutive edges
- color: "dark", "accent", or "light"
- dashed: false for strong, true for weak connections

STRICT RULES:
- NO OVERLAPPING: nodes never overlap or touch. Min 150px between centers.
- Arcs pass BETWEEN nodes, never crossing over a node.
- Arcs never overlap each other — alternating curveDirection prevents this.
- Vary node sizes for visual interest — don't make all nodes the same size.
- Use "accent" strokeColor for max 1-2 nodes.

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
  const raw = JSON.parse(jsonMatch[0]) as IllustrationStructure & { nodes: any[]; edges: any[] };

  for (const node of raw.nodes) {
    if (!node.rx) node.rx = 55;
    if (!node.ry) node.ry = 55;
    const legacy = (node as { color?: string }).color;
    if (!node.strokeColor) node.strokeColor = legacy ?? (node.highlighted ? "accent" : "dark");
    if (!node.labelColor) node.labelColor = legacy ?? (node.highlighted ? "accent" : "dark");
    if (node.highlighted === undefined) {
      node.highlighted = node.strokeColor === "accent" || node.labelColor === "accent";
    }
    const ratio = Math.min(node.rx, node.ry) / Math.max(node.rx, node.ry);
    if (ratio > 0.7) {
      const avg = Math.round((node.rx + node.ry) / 2);
      node.rx = avg;
      node.ry = avg;
    }
  }
  for (const edge of raw.edges) {
    if (!edge.color) edge.color = "dark";
    if (edge.dashed === undefined) edge.dashed = false;
    if (!edge.curveDirection) edge.curveDirection = "down";
  }

  log(`Pass 1 (text) result: ${raw.nodes.length} nodes, ${raw.edges.length} edges`);
  return raw;
}

// ────────────────────────────────────────────
// Arc path computation
// ────────────────────────────────────────────

interface ComputedEdge {
  from: string;
  to: string;
  hasArrow: boolean;
  pathD: string;
  color: BrandColor;
  dashed: boolean;
}

function computeArcPaths(structure: IllustrationStructure): ComputedEdge[] {
  const nodeMap = new Map(structure.nodes.map((n) => [n.id, n]));

  return structure.edges.map((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) {
      return { ...edge, pathD: "" };
    }

    const goesDown = edge.curveDirection === "down";

    // Endpoints: bottom or top center of each ellipse
    // "down" curve → start/end from BOTTOM of nodes (cy + ry)
    // "up" curve → start/end from TOP of nodes (cy - ry)
    const startX = fromNode.cx;
    const startY = goesDown ? fromNode.cy + fromNode.ry : fromNode.cy - fromNode.ry;
    const endX = toNode.cx;
    const endY = goesDown ? toNode.cy + toNode.ry : toNode.cy - toNode.ry;

    // Horizontal distance between endpoints
    const hDist = Math.abs(endX - startX);

    // Arc radii for a deep U-shape:
    // arcRx = half horizontal distance (so arc spans the gap)
    // arcRy = depth of the U — make it generous for a visible curve
    const arcRx = Math.round(hDist * 0.5);
    const arcRy = Math.round(Math.max(70, hDist * 0.55));

    // sweep: for "down" U-curve going left→right, sweep=0 makes the arc bulge downward
    // for "up" U-curve going left→right, sweep=1 makes the arc bulge upward
    const leftToRight = endX >= startX;
    let sweep: 0 | 1;
    if (goesDown) {
      sweep = leftToRight ? 0 : 1;
    } else {
      sweep = leftToRight ? 1 : 0;
    }

    const pathD = `M ${Math.round(startX)},${Math.round(startY)} A ${arcRx},${arcRy} 0 0,${sweep} ${Math.round(endX)},${Math.round(endY)}`;

    return {
      from: edge.from,
      to: edge.to,
      hasArrow: edge.hasArrow,
      pathD,
      color: edge.color,
      dashed: edge.dashed,
    };
  });
}

// ────────────────────────────────────────────
// Pass 2: Structure + style → SVG
// ────────────────────────────────────────────

async function generateSvg(
  ai: GoogleGenAI,
  structure: IllustrationStructure,
  mode: ColorMode
): Promise<string> {
  log(`Pass 2: Generating SVG (${mode})...`);

  const designSpec = loadFile("design-spec-illustration.md");

  const refFile = mode === "dark" ? "style-reference-dark.png" : "style-reference.png";
  const refs = [
    loadImageBase64(refFile),
    loadImageBase64("style-reference-areas.png"),
  ].filter((r): r is string => r !== null);

  // Pre-compute arc paths so the model doesn't have to
  const computedEdges = computeArcPaths(structure);

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  // Style references
  parts.push({
    text: `Style reference images (Mini Mattia brand, ${mode} mode):`,
  });
  for (const ref of refs) {
    parts.push({ inlineData: { mimeType: "image/png", data: ref } });
  }

  // Structure + design spec + generation instructions
  parts.push({
    text: `Generate SVG code for a PURELY VISUAL ILLUSTRATION — an elegant abstract composition of circles and arcs, inspired by the style reference images.

REPLICATE THIS EXACT VISUAL STYLE from the reference:
- Circles with DASHED outlines (stroke-dasharray) — thin, elegant strokes (~1.2px)
- ONE highlighted circle with a soft RADIAL GRADIENT GLOW in accent green (#00A67D), fading to transparent
- Smooth curved arcs connecting circles — thin, solid lines (~1.2px)
- Decorative elements scattered in margins: small filled dots (3-5px), tiny dashed rings, faint background circles
- Clean, minimal, sophisticated aesthetic — lots of whitespace
- NO text inside circles, NO labels, NO titles — purely visual

NODES:
${JSON.stringify(structure.nodes, null, 2)}

PRE-COMPUTED ARC PATHS (use these EXACTLY — do NOT recalculate):
${JSON.stringify(computedEdges, null, 2)}

DESIGN SPECIFICATION:
${designSpec ?? ""}

Generate the SVG for ${mode.toUpperCase()} MODE.

COLOR MAPPING (from sketch colors to SVG colors in ${mode} mode):
- "dark" → "${mode === "light" ? "#1C2D28" : "#EBEEE4"}"
- "accent" → "#00A67D" (same in both modes)
- "light" → "${mode === "light" ? "#EBEEE4" : "#1C2D28"}" (subtle/secondary)

CONTENT AREA PADDING (CRITICAL):
- The content area is x: 135–765, y: 90–510. ALL nodes and arcs must fit ENTIRELY within this zone.
- Node borders must not exceed the content area: (cx - rx) >= 135, (cx + rx) <= 765, (cy - ry) >= 90, (cy + ry) <= 510.
- Center the entire composition within this padded area.

RULES:
- Each node has "strokeColor" (outline). Apply color mapping.
- Use the COLOR MAPPING above to convert "dark"/"accent"/"light" to actual hex colors.
- ALL nodes are CIRCLES rendered as <ellipse cx="" cy="" rx="" ry=""> with rx=ry (equal radii).
- Node outline: use strokeColor for the <ellipse> stroke attribute.
- Nodes with highlighted=true: SOLID outline (no dash) + a GLOW effect behind it. The glow is a radial gradient: accent color (#00A67D) at center fading to transparent at edges, rendered as a larger <ellipse> behind the node with fill="url(#glow-gradient)" and opacity ~0.3.
- Nodes with highlighted=false: DASHED outline (stroke-dasharray="6 4") using their strokeColor. No glow.
- For each connection, use the "pathD" value from PRE-COMPUTED ARC PATHS directly:
  <path d="{pathD}" stroke="{mapped color}" stroke-width="1.2" fill="none"/>
  Copy the pathD string EXACTLY as provided. Do NOT modify it.
- Each edge has a "color" field. Use COLOR MAPPING to set the stroke color.
- Edges with "dashed": true → add stroke-dasharray="5 4".
- ARROWHEADS (CRITICAL): if hasArrow=true, add marker-end="url(#arrowhead)". Define the arrowhead marker in <defs> as a FILLED CLOSED TRIANGLE — NOT two open lines. Use:
  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
    <polygon points="0 0, 10 3.5, 0 7" fill="{stroke color}" />
  </marker>
  If edges use different colors, define one marker per color (e.g. #arrowhead-dark, #arrowhead-accent).
- ALL nodes have SOLID fill (fill="${mode === "light" ? "#EBEEE4" : "#1C2D28"}").
- Draw ALL connections BEFORE all nodes in SVG order.

NO OVERLAPPING (CRITICAL):
- Nodes must NEVER overlap each other. Every ellipse must have clear space around it.
- Arcs must NOT cross over nodes — they pass between/around them.
- Arcs must NOT overlap each other — alternating curveDirection ("up"/"down") prevents this.
- Decorative elements must NEVER overlap nodes or arcs.
- If elements would overlap, increase spacing or adjust positions.

TEXT INSIDE NODES:
- If a node has an empty label (""), do NOT render any <text> element for it. The node is purely visual.
- Only render <text> if the label is non-empty (for sketch-based illustrations that have labels).
- When rendering text: use <tspan> per word, text-anchor="middle", font-size 13px, within 65% of rx.

DECORATIVE ELEMENTS PLACEMENT:
- Decorative elements (dots, dashed rings, background circles) add visual richness but must NEVER overlap content.
- Place decorations in empty areas, margins, corners — never on top of nodes or arcs.

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
// Utilities
// ────────────────────────────────────────────

function lightToDark(svg: string): string {
  const light = PALETTES.light;
  const dark = PALETTES.dark;

  let result = svg;
  result = result.replaceAll(light.background, "___BG___");
  result = result.replaceAll(light.stroke, "___STROKE___");
  result = result.replaceAll("___BG___", dark.background);
  result = result.replaceAll("___STROKE___", dark.stroke);
  return result;
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

  svg = svg.replace(/(<svg[^>]*?)\s+width="[^"]*"/i, "$1");
  svg = svg.replace(/(<svg[^>]*?)\s+height="[^"]*"/i, "$1");

  return svg;
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

export async function sketchToIllustrationGemini(
  sketchBase64: string,
  mode: ColorMode = "light"
): Promise<string> {
  const ai = getClient();
  const structure = await analyzeSketch(ai, sketchBase64);
  const svg = await generateSvg(ai, structure, mode);
  log(`Pass 2 complete (${mode}): ${svg.length} chars`);
  return svg;
}

/**
 * Text prompt → Illustration SVG generation (both light + dark).
 */
export async function textPromptToIllustrationGeminiBoth(
  textPrompt: string,
  learningContext?: string
): Promise<{ light: string; dark: string }> {
  const ai = getClient();

  // Pass 1: Claude analyzes text → structure
  const structure = await analyzeTextPrompt(textPrompt, learningContext);

  // Pass 2: Gemini generates SVG
  const light = await generateSvg(ai, structure, "light");
  log(`Light SVG (text) complete: ${light.length} chars`);

  const dark = lightToDark(light);
  log(`Dark SVG (text) derived: ${dark.length} chars`);

  return { light, dark };
}

export async function sketchToIllustrationGeminiBoth(
  sketchBase64: string,
  learningContext?: string
): Promise<{ light: string; dark: string }> {
  const ai = getClient();

  const structure = await analyzeSketch(ai, sketchBase64, learningContext);

  const light = await generateSvg(ai, structure, "light");
  log(`Light SVG complete: ${light.length} chars`);

  const dark = lightToDark(light);
  log(`Dark SVG derived: ${dark.length} chars`);

  return { light, dark };
}
