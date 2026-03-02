import { fal } from "@fal-ai/client";
import { readFileSync, appendFileSync } from "fs";
import { join } from "path";

function log(msg: string) {
  const line = `[${new Date().toISOString()}] [fal] ${msg}\n`;
  console.log(line);
  try { appendFileSync(join(process.cwd(), "generation.log"), line); } catch { /* */ }
}

export type ColorMode = "light" | "dark";

const PALETTES: Record<ColorMode, { background: string; stroke: string; accent: string }> = {
  light: { background: "#EBEEE4", stroke: "#1C2D28", accent: "#00A67D" },
  dark: { background: "#1C2D28", stroke: "#EBEEE4", accent: "#00A67D" },
};

function configureFal() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set");
  fal.config({ credentials: key });
}

async function uploadBase64(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });
  return fal.storage.upload(blob);
}

async function uploadFile(relativePath: string): Promise<string | null> {
  try {
    const buf = readFileSync(
      join(process.cwd(), "src/lib/brand-references", relativePath)
    );
    const blob = new Blob([buf], { type: "image/png" });
    return fal.storage.upload(blob);
  } catch {
    return null;
  }
}

/**
 * Convert a sketch into a polished diagram image using fal.ai FLUX.1 dev
 * with ControlNet (structural guide) + IP-Adapter (style reference).
 *
 * Returns an SVG string wrapping the generated PNG (base64-embedded).
 */
export async function sketchToFal(
  sketchBase64: string,
  mode: ColorMode = "light"
): Promise<string> {
  configureFal();

  const palette = PALETTES[mode];
  const modeLabel = mode === "dark" ? "dark background" : "light background";

  // Upload sketch as ControlNet input
  const sketchUrl = await uploadBase64(sketchBase64);

  // Upload style reference for IP-Adapter
  const refFile = mode === "dark" ? "style-reference-dark.png" : "style-reference.png";
  const refUrl = await uploadFile(refFile);

  const prompt = `Clean minimalist diagram, ${modeLabel}, soft ellipses with dashed outlines, thin curved connections, green glow accent, dot markers, whitespace, no text, no labels.`;

  // Build input
  const input: Record<string, unknown> = {
    prompt,
    image_size: "landscape_16_9",
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: "png",
    controlnets: [
      {
        path: "InstantX/FLUX.1-dev-Controlnet-Canny",
        control_image_url: sketchUrl,
        conditioning_scale: 0.85,
      },
    ],
  };

  // Add IP-Adapter if style reference exists
  if (refUrl) {
    input.ip_adapters = [
      {
        path: "XLabs-AI/flux-ip-adapter-v2",
        image_encoder_path: "openai/clip-vit-large-patch14",
        weight_name: "ip_adapter.safetensors",
        image_url: refUrl,
        scale: 0.7,
      },
    ];
  }

  log(`Input: ${JSON.stringify(input, null, 2)}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (fal as any).subscribe("fal-ai/flux-general", {
      input,
      logs: true,
      onQueueUpdate: (update: { status: string; logs?: { message: string }[] }) => {
        if (update.status === "IN_PROGRESS") {
          (update.logs ?? []).forEach((l) => log(l.message));
        }
      },
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : JSON.stringify(err);
    log(`fal.subscribe error detail: ${detail}`);
    // Try to get response body if available
    if (err && typeof err === "object" && "body" in err) {
      log(`fal error body: ${JSON.stringify((err as Record<string, unknown>).body)}`);
    }
    throw err;
  }

  const output = (result.data ?? result) as { images?: { url: string; width: number; height: number }[] };
  const imageUrl = output.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image in fal.ai response");

  // Fetch the PNG and embed as base64 in SVG
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("Failed to fetch image from fal.ai");
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  const imgBase64 = imgBuf.toString("base64");

  const width = output.images![0].width || 1820;
  const height = output.images![0].height || 1024;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image href="data:image/png;base64,${imgBase64}" width="${width}" height="${height}"/>
</svg>`;
}
