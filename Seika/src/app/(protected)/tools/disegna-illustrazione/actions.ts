"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { projects, sketches, brandConfigs } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function getProjects() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.userId, user.id),
        eq(projects.toolType, "disegna-illustrazione")
      )
    )
    .orderBy(desc(projects.updatedAt));
}

export async function createProject(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const configs = await db
    .select({ id: brandConfigs.id })
    .from(brandConfigs)
    .where(eq(brandConfigs.userId, user.id))
    .limit(1);

  const [project] = await db
    .insert(projects)
    .values({
      userId: user.id,
      name,
      toolType: "disegna-illustrazione",
      brandConfigId: configs[0]?.id ?? null,
    })
    .returning();

  redirect(`/tools/disegna-illustrazione/${project.id}`);
}

export async function getProjectWithSketch(projectId: string) {
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
    .select()
    .from(sketches)
    .where(eq(sketches.projectId, projectId))
    .orderBy(desc(sketches.createdAt))
    .limit(1);

  return {
    project,
    sketch: sketchRows[0] ?? null,
  };
}

export async function saveSketch(projectId: string, snapshot: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) {
    throw new Error("Not authorized");
  }

  const [sketch] = await db
    .insert(sketches)
    .values({
      projectId,
      snapshotJson: snapshot,
    })
    .returning();

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return sketch;
}

export async function saveTextPromptSketch(projectId: string, textPrompt: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) {
    throw new Error("Not authorized");
  }

  const [sketch] = await db
    .insert(sketches)
    .values({
      projectId,
      snapshotJson: { source: "text-prompt", prompt: textPrompt },
    })
    .returning();

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  return sketch;
}

export async function renameProject(projectId: string, newName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Name cannot be empty");

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) {
    throw new Error("Not authorized");
  }

  await db
    .update(projects)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  revalidatePath("/tools/disegna-illustrazione");
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.userId !== user.id) {
    throw new Error("Not authorized");
  }

  await db.delete(projects).where(eq(projects.id, projectId));

  revalidatePath("/tools/disegna-illustrazione");
}
