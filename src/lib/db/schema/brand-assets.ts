import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { brandConfigs } from "./brand-configs";

export const brandAssets = pgTable("brand_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandConfigId: uuid("brand_config_id")
    .notNull()
    .references(() => brandConfigs.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'logo' | 'font' | 'icon'
  name: text("name").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
