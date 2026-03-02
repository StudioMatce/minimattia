"use server";

import { appendFileSync } from "fs";
import { join } from "path";

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line);
  try {
    appendFileSync(join(process.cwd(), "generation.log"), line);
  } catch { /* ignore */ }
}

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  projects,
  sketches,
  generatedVisuals,
  brandConfigs,
} from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { sketchToSvgGeminiBoth, textPromptToSvgGeminiBoth } from "@/lib/engine/sketch-to-image";
import { buildLearningContext } from "@/lib/engine/learning-context";
import { sketchToSvg } from "@/lib/engine/sketch-to-svg";
import { mergeBrandTheme } from "@/lib/engine/brand-theme";
import type { BrandTheme } from "@/lib/types/brand";


export async function generateDiagram(
  projectId: string,
  imageBase64: string,
  shapes: unknown[],
  shapeMeta?: unknown[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Verify ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) {
    throw new Error("Not authorized");
  }

  // 2. Get brand config
  let brandTheme: BrandTheme;
  if (project.brandConfigId) {
    const [config] = await db
      .select()
      .from(brandConfigs)
      .where(eq(brandConfigs.id, project.brandConfigId))
      .limit(1);
    brandTheme = mergeBrandTheme(config?.config);
  } else {
    brandTheme = mergeBrandTheme({});
  }

  // 3. Get latest sketch
  const [sketch] = await db
    .select()
    .from(sketches)
    .where(eq(sketches.projectId, projectId))
    .orderBy(desc(sketches.createdAt))
    .limit(1);

  if (!sketch) throw new Error("No sketch found. Save your sketch first.");

  // 4. Generate polished diagrams — light + dark in parallel
  //    Priority: Gemini SVG (two-pass) → Claude SVG (fallback)
  let svgContentLight: string = "";
  let svgContentDark: string = "";
  let diagramJson: Record<string, unknown> = {};

  const learningContext = await buildLearningContext(user.id);
  const geminiAvailable = !!process.env.GEMINI_API_KEY;

  log(`Engine availability: gemini=${geminiAvailable}`);

  if (geminiAvailable) {
    try {
      log("Trying Gemini SVG (two-pass)...");
      const result = await sketchToSvgGeminiBoth(imageBase64, learningContext);
      svgContentLight = result.light;
      svgContentDark = result.dark;
      diagramJson = { directSvg: true, engine: "gemini", hasDarkMode: true };
      log("Gemini SVG succeeded");
    } catch (err) {
      log(`Gemini SVG failed: ${(err as Error).message}`);
      svgContentLight = "";
    }
  }

  if (!svgContentLight) {
    log("Falling back to Claude SVG...");
    svgContentLight = await sketchToSvg(imageBase64, brandTheme);
    svgContentDark = svgContentLight;
    diagramJson = { directSvg: true, engine: "claude", hasDarkMode: false };
    log("Claude SVG completed");
  }

  // 5. Save to DB (imageBase64 in dedicated text column, not in JSONB)
  const [visual] = await db
    .insert(generatedVisuals)
    .values({
      sketchId: sketch.id,
      diagramJson: { ...diagramJson, svgContentDark },
      svgContent: svgContentLight,
      sourceImageBase64: imageBase64,
      status: "completed",
    })
    .returning();

  return {
    id: visual.id,
    svgContent: svgContentLight,
    svgContentDark,
    diagramJson,
  };
}

export async function getLatestGenerated(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) return null;

  const sketchRows = await db
    .select({ id: sketches.id })
    .from(sketches)
    .where(eq(sketches.projectId, projectId));

  if (sketchRows.length === 0) return null;

  const sketchIds = sketchRows.map((s) => s.id);
  const [visual] = await db
    .select()
    .from(generatedVisuals)
    .where(inArray(generatedVisuals.sketchId, sketchIds))
    .orderBy(desc(generatedVisuals.createdAt))
    .limit(1);

  return visual ?? null;
}

export async function getVisualById(projectId: string, visualId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) return null;

  const [visual] = await db
    .select()
    .from(generatedVisuals)
    .where(eq(generatedVisuals.id, visualId))
    .limit(1);

  return visual ?? null;
}

export async function getProjectHistory(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) return [];

  const sketchRows = await db
    .select()
    .from(sketches)
    .where(eq(sketches.projectId, projectId));

  if (sketchRows.length === 0) return [];

  const sketchIds = sketchRows.map((s) => s.id);
  const sketchMap = new Map(sketchRows.map((s) => [s.id, s]));

  const visuals = await db
    .select()
    .from(generatedVisuals)
    .where(inArray(generatedVisuals.sketchId, sketchIds))
    .orderBy(desc(generatedVisuals.createdAt));

  return visuals.map((v) => {
    const sketch = sketchMap.get(v.sketchId);
    const snapshotJson = sketch?.snapshotJson as { source?: string; prompt?: string } | null;
    return {
      id: v.id,
      createdAt: v.createdAt,
      source: snapshotJson?.source === "text-prompt" ? "text" as const : "canvas" as const,
      prompt: snapshotJson?.prompt ?? null,
      engine: (v.diagramJson as { engine?: string })?.engine ?? "unknown",
      rating: v.rating ?? null,
    };
  });
}

export async function regenerateDiagram(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get previous visual to reuse imageBase64
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) {
    throw new Error("Not authorized");
  }

  const [sketch] = await db
    .select()
    .from(sketches)
    .where(eq(sketches.projectId, projectId))
    .orderBy(desc(sketches.createdAt))
    .limit(1);

  if (!sketch) throw new Error("No sketch found.");

  const [prevVisual] = await db
    .select()
    .from(generatedVisuals)
    .where(eq(generatedVisuals.sketchId, sketch.id))
    .orderBy(desc(generatedVisuals.createdAt))
    .limit(1);

  // Check if this was a text-prompt generation
  const snapshotJson = sketch.snapshotJson as { source?: string; prompt?: string } | null;
  const learningCtx = await buildLearningContext(user.id);
  if (snapshotJson?.source === "text-prompt" && snapshotJson.prompt) {
    return generateDiagramFromText(projectId, snapshotJson.prompt, learningCtx);
  }

  const imageBase64 = prevVisual?.sourceImageBase64;

  if (!imageBase64) {
    throw new Error("No sketch image found. Generate from the canvas first.");
  }

  return generateDiagram(projectId, imageBase64, [], []);
}

async function generateDiagramFromText(projectId: string, textPrompt: string, learningContext?: string) {
  const [sketch] = await db
    .select()
    .from(sketches)
    .where(eq(sketches.projectId, projectId))
    .orderBy(desc(sketches.createdAt))
    .limit(1);

  if (!sketch) throw new Error("No sketch found.");

  let svgContentLight = "";
  let svgContentDark = "";
  let diagramJson: Record<string, unknown> = {};

  log("Regenerating from text prompt...");
  const result = await textPromptToSvgGeminiBoth(textPrompt, learningContext);
  svgContentLight = result.light;
  svgContentDark = result.dark;
  diagramJson = { directSvg: true, engine: "gemini", hasDarkMode: true, source: "text-prompt" };
  log("Text prompt regeneration succeeded");

  const [visual] = await db
    .insert(generatedVisuals)
    .values({
      sketchId: sketch.id,
      diagramJson: { ...diagramJson, svgContentDark },
      svgContent: svgContentLight,
      sourceImageBase64: null,
      status: "completed",
    })
    .returning();

  return {
    id: visual.id,
    svgContent: svgContentLight,
    svgContentDark,
    diagramJson,
  };
}
