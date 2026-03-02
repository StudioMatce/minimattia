import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { brandConfigs } from "./brand-configs";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  brandConfigId: uuid("brand_config_id").references(() => brandConfigs.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  toolType: text("tool_type").notNull().default("disegna-schema"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
