import { db } from "@/lib/db";
import { projects, sketches, generatedVisuals } from "@/lib/db/schema";
import { eq, isNotNull, desc } from "drizzle-orm";

interface RatedVisual {
  rating: number;
  ratingNote: string | null;
  engine: string;
}

export async function buildLearningContext(
  userId: string,
  limit = 20
): Promise<string> {
  // Get all projects for user
  const userProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));

  if (userProjects.length === 0) return "";

  // Collect rated visuals across all projects
  const rated: RatedVisual[] = [];

  for (const project of userProjects) {
    const projectSketches = await db
      .select({ id: sketches.id })
      .from(sketches)
      .where(eq(sketches.projectId, project.id));

    if (projectSketches.length === 0) continue;

    for (const sketch of projectSketches) {
      const visuals = await db
        .select({
          rating: generatedVisuals.rating,
          ratingNote: generatedVisuals.ratingNote,
          diagramJson: generatedVisuals.diagramJson,
        })
        .from(generatedVisuals)
        .where(eq(generatedVisuals.sketchId, sketch.id))
        .orderBy(desc(generatedVisuals.createdAt));

      for (const v of visuals) {
        if (v.rating == null) continue;
        const engine = (v.diagramJson as { engine?: string })?.engine ?? "unknown";
        rated.push({ rating: v.rating, ratingNote: v.ratingNote, engine });
        if (rated.length >= limit) break;
      }
      if (rated.length >= limit) break;
    }
    if (rated.length >= limit) break;
  }

  if (rated.length === 0) return "";

  // Aggregate stats per engine
  const engineStats = new Map<string, { sum: number; count: number }>();
  for (const v of rated) {
    const s = engineStats.get(v.engine) ?? { sum: 0, count: 0 };
    s.sum += v.rating;
    s.count += 1;
    engineStats.set(v.engine, s);
  }

  const avgTotal = rated.reduce((s, v) => s + v.rating, 0) / rated.length;

  const liked = rated
    .filter((v) => v.rating >= 4 && v.ratingNote)
    .map((v) => `  - "${v.ratingNote}" (${v.rating}/5)`);

  const disliked = rated
    .filter((v) => v.rating <= 2 && v.ratingNote)
    .map((v) => `  - "${v.ratingNote}" (${v.rating}/5)`);

  const engineLines = Array.from(engineStats.entries())
    .map(([eng, s]) => `  - ${eng}: avg ${(s.sum / s.count).toFixed(1)}/5 (${s.count} ratings)`)
    .join("\n");

  let context = `USER FEEDBACK CONTEXT (based on ${rated.length} rated generations, avg ${avgTotal.toFixed(1)}/5):
Engine performance:
${engineLines}`;

  if (liked.length > 0) {
    context += `\nWhat the user LIKED:\n${liked.slice(0, 5).join("\n")}`;
  }
  if (disliked.length > 0) {
    context += `\nWhat the user DISLIKED:\n${disliked.slice(0, 5).join("\n")}`;
  }

  context += "\nUse this feedback to improve the output.";

  return context;
}
