import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  projects,
  sketches,
  generatedVisuals,
  brandConfigs,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { sketchToIllustrationGeminiBoth, textPromptToIllustrationGeminiBoth } from "@/lib/engine/sketch-to-illustration";
import { sketchToSvg } from "@/lib/engine/sketch-to-svg";
import { mergeBrandTheme } from "@/lib/engine/brand-theme";
import type { BrandTheme } from "@/lib/types/brand";
import { appendFileSync } from "fs";
import { join } from "path";

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line);
  try {
    appendFileSync(join(process.cwd(), "generation.log"), line);
  } catch { /* ignore */ }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { projectId, imageBase64, textPrompt } = await request.json();

    if (!projectId || (!imageBase64 && !textPrompt)) {
      return NextResponse.json({ error: "Missing projectId or input (imageBase64 or textPrompt)" }, { status: 400 });
    }

    // 1. Verify ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
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

    if (!sketch) {
      return NextResponse.json({ error: "No sketch found" }, { status: 404 });
    }

    // 4. Generate
    let svgContentLight = "";
    let svgContentDark = "";
    let diagramJson: Record<string, unknown> = {};

    const geminiAvailable = !!process.env.GEMINI_API_KEY;
    log(`Engine availability: gemini=${geminiAvailable}`);

    const isTextMode = !imageBase64 && !!textPrompt;

    if (geminiAvailable) {
      try {
        if (isTextMode) {
          log("Trying Gemini Illustration SVG from text prompt...");
          const result = await textPromptToIllustrationGeminiBoth(textPrompt);
          svgContentLight = result.light;
          svgContentDark = result.dark;
          diagramJson = { directSvg: true, engine: "gemini", hasDarkMode: true, source: "text-prompt" };
          log("Gemini Illustration SVG (text) succeeded");
        } else {
          log("Trying Gemini Illustration SVG (two-pass)...");
          const result = await sketchToIllustrationGeminiBoth(imageBase64);
          svgContentLight = result.light;
          svgContentDark = result.dark;
          diagramJson = { directSvg: true, engine: "gemini", hasDarkMode: true };
          log("Gemini Illustration SVG succeeded");
        }
      } catch (err) {
        log(`Gemini Illustration SVG failed: ${(err as Error).message}`);
        svgContentLight = "";
      }
    }

    if (!svgContentLight && !isTextMode) {
      log("Falling back to Claude SVG...");
      svgContentLight = await sketchToSvg(imageBase64, brandTheme);
      svgContentDark = svgContentLight;
      diagramJson = { directSvg: true, engine: "claude", hasDarkMode: false };
      log("Claude SVG completed");
    }

    if (!svgContentLight) {
      return NextResponse.json({ error: "Generation failed" }, { status: 500 });
    }

    // 5. Save to DB
    const [visual] = await db
      .insert(generatedVisuals)
      .values({
        sketchId: sketch.id,
        diagramJson: { ...diagramJson, svgContentDark },
        svgContent: svgContentLight,
        sourceImageBase64: imageBase64 || null,
        status: "completed",
      })
      .returning();

    log(`Saved visual ${visual.id}`);

    return NextResponse.json({
      id: visual.id,
      svgContent: svgContentLight,
      svgContentDark,
      diagramJson,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log(`Generate Illustration API error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
