import { readFileSync } from "fs";
import { join } from "path";

const RECRAFT_BASE = "https://external.api.recraft.ai/v1";

function getToken(): string {
  const token = process.env.RECRAFT_API_TOKEN;
  if (!token) throw new Error("RECRAFT_API_TOKEN not set");
  return token;
}

// Cache the style ID in memory (created once per server restart)
let cachedStyleId: string | null = null;

/**
 * Create a Recraft style from brand reference images.
 * Returns a style_id that can be reused for all generations.
 */
async function getOrCreateStyle(): Promise<string> {
  if (cachedStyleId) return cachedStyleId;

  const token = getToken();
  const refDir = join(process.cwd(), "src/lib/brand-references");

  const formData = new FormData();
  formData.append("style", "vector_illustration");

  // Add reference images
  const files = ["style-reference.png", "style-reference-dark.png", "style-reference-areas.png"];
  let fileIndex = 0;
  for (const file of files) {
    try {
      const buf = readFileSync(join(refDir, file));
      const blob = new Blob([buf], { type: "image/png" });
      const fieldName = fileIndex === 0 ? "file" : `file${fileIndex + 1}`;
      formData.append(fieldName, blob, file);
      fileIndex++;
    } catch {
      // Skip missing files
    }
  }

  const res = await fetch(`${RECRAFT_BASE}/styles`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Recraft style creation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedStyleId = data.id;
  console.log("Recraft style created:", cachedStyleId);
  return cachedStyleId!;
}

/**
 * Generate an SVG diagram using Recraft V3 SVG.
 * Returns the SVG content string.
 */
export async function recraftGenerateSvg(
  prompt: string,
  colors?: { r: number; g: number; b: number }[]
): Promise<string> {
  const token = getToken();
  const styleId = await getOrCreateStyle();

  const body: Record<string, unknown> = {
    prompt,
    style_id: styleId,
    model: "recraftv3",
    size: "1820x1024",
    response_format: "url",
  };

  if (colors && colors.length > 0) {
    body.colors = colors;
  }

  const res = await fetch(`${RECRAFT_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Recraft generation failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const svgUrl = data.data?.[0]?.url;
  if (!svgUrl) throw new Error("No SVG URL in Recraft response");

  // Fetch the actual SVG content
  const svgRes = await fetch(svgUrl);
  if (!svgRes.ok) throw new Error("Failed to fetch SVG from Recraft URL");

  return svgRes.text();
}

// Seika brand colors as RGB for Recraft color hints
export const SEIKA_COLORS_LIGHT = [
  { r: 235, g: 238, b: 228 }, // #EBEEE4 background
  { r: 28, g: 45, b: 40 },    // #1C2D28 primary
  { r: 0, g: 166, b: 125 },   // #00A67D accent
];

export const SEIKA_COLORS_DARK = [
  { r: 28, g: 45, b: 40 },    // #1C2D28 background
  { r: 235, g: 238, b: 228 }, // #EBEEE4 strokes
  { r: 0, g: 166, b: 125 },   // #00A67D accent
];
