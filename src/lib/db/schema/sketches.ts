import { pgTable, uuid, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const sketches = pgTable("sketches", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  snapshotJson: jsonb("snapshot_json").notNull(), // tldraw getSnapshot() output
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
