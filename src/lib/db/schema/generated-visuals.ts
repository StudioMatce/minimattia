import { pgTable, uuid, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { sketches } from "./sketches";

export const generatedVisuals = pgTable("generated_visuals", {
  id: uuid("id").defaultRandom().primaryKey(),
  sketchId: uuid("sketch_id")
    .notNull()
    .references(() => sketches.id, { onDelete: "cascade" }),
  diagramJson: jsonb("diagram_json").notNull(), // DiagramGraph structure
  svgContent: text("svg_content").notNull(),
  sourceImageBase64: text("source_image_base64"),
  pngStoragePath: text("png_storage_path"),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  rating: integer("rating"), // 1-5, null = not rated
  ratingNote: text("rating_note"), // optional short note
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
