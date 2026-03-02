import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const brandConfigs = pgTable("brand_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  config: jsonb("config").notNull(), // BrandTheme JSON
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
