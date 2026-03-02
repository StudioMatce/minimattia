"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { projects, sketches, generatedVisuals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function rateVisual(
  visualId: string,
  rating: number,
  note?: string
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify ownership: visual → sketch → project → user
  const [visual] = await db
    .select({ sketchId: generatedVisuals.sketchId })
    .from(generatedVisuals)
    .where(eq(generatedVisuals.id, visualId))
    .limit(1);

  if (!visual) throw new Error("Visual not found");

  const [sketch] = await db
    .select({ projectId: sketches.projectId })
    .from(sketches)
    .where(eq(sketches.id, visual.sketchId))
    .limit(1);

  if (!sketch) throw new Error("Sketch not found");

  const [project] = await db
    .select({ userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, sketch.projectId))
    .limit(1);

  if (!project || project.userId !== user.id) {
    throw new Error("Not authorized");
  }

  const trimmedNote = note?.trim().slice(0, 200) || null;

  await db
    .update(generatedVisuals)
    .set({ rating, ratingNote: trimmedNote })
    .where(eq(generatedVisuals.id, visualId));
}
