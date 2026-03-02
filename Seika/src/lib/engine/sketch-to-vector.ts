import { GoogleGenAI } from "@google/genai";
import { appendFileSync } from "fs";
import { join } from "path";
import { recraftGenerateSvg, BRAND_COLORS_LIGHT, BRAND_COLORS_DARK } from "./recraft";

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line);
  try {
    appendFileSync(join(process.cwd(), "generation.log"), line);
  } catch { /* ignore */ }
}

export type ColorMode = "light" | "dark";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  return new GoogleGenAI({ apiKey });
}

/**
 * Step 1: Use Gemini to analyze the sketch and produce a precise,
 * exhaustive inventory of every element and connection.
 */
async function describeSketch(sketchBase64: string): Promise<string> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: sketchBase64,
            },
          },
          {
            text: `You are analyzing a hand-drawn sketch to create an EXHAUSTIVE description for a diagram generation tool. EVERY element must be captured — missing even one element is a failure.

STEP 1 — COUNT AND LIST every distinct element:
- List every closed shape (box, circle, ellipse, blob) with a label like S1, S2, S3...
- List every line/arrow/connection with a label like C1, C2, C3...
- List every piece of text/number visible
- Count the totals: "X shapes, Y connections, Z text labels"

STEP 2 — DESCRIBE POSITIONS on a 3x3 grid (top-left, top-center, top-right, middle-left, center, middle-right, bottom-left, bottom-center, bottom-right):
- For each shape, state its grid position and approximate size relative to others

STEP 3 — DESCRIBE EVERY CONNECTION precisely:
- For each connection: "C1: from S1 (exits [side]) to S2 (enters [side]), [straight/curved/90-degree bend], [has arrowhead / no arrowhead]"
- If a line bends: describe the bend direction

STEP 4 — WRITE A SINGLE GENERATION PROMPT that captures everything above. Format:
"A diagram with [N] shapes and [M] connections. [Shape descriptions with positions]. [Connection descriptions with paths]. [Any text visible]."

CRITICAL: Do NOT omit any element. Do NOT add elements that aren't in the sketch. Do NOT interpret meaning — only describe what is visually present.

Output ONLY the final generation prompt from Step 4.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT"],
      thinkingConfig: {
        thinkingBudget: 5000,
      },
    },
  });

  return response.text ?? "";
}

/**
 * Step 2: Generate SVG via Recraft using the sketch description + brand style.
 */
export async function sketchToVector(
  sketchBase64: string,
  mode: ColorMode = "light"
): Promise<string> {
  // Step 1: Describe the sketch exhaustively
  log(`[sketchToVector] Starting description for mode=${mode}`);
  const description = await describeSketch(sketchBase64);
  log(`[sketchToVector] Gemini description: ${description}`);

  // Step 2: Build the Recraft prompt
  const modeLabel = mode === "dark" ? "dark background" : "light background";
  const colors = mode === "dark" ? BRAND_COLORS_DARK : BRAND_COLORS_LIGHT;

  const prompt = `Professional consulting diagram, ${modeLabel}, organic style: shapes are ellipses/circles with thin dashed outlines, one element has a green glow accent, small dot markers scattered as accents, connections are smooth thin curved lines, clean minimalist aesthetic with generous whitespace. ${description}`;

  log(`[sketchToVector] Full Recraft prompt: ${prompt}`);

  // Step 3: Generate with Recraft
  const svg = await recraftGenerateSvg(prompt, colors);
  log(`[sketchToVector] Recraft SVG received (${mode}): ${svg.length} chars`);
  return svg;
}
