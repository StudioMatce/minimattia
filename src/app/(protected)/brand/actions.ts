"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { brandConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { BrandTheme } from "@/lib/types/brand";

export async function getBrandConfig(): Promise<BrandTheme | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await db
    .select()
    .from(brandConfigs)
    .where(eq(brandConfigs.userId, user.id))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0].config as BrandTheme;
}

export async function saveBrandConfig(config: BrandTheme): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const existing = await db
    .select({ id: brandConfigs.id })
    .from(brandConfigs)
    .where(eq(brandConfigs.userId, user.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(brandConfigs)
      .set({ config, updatedAt: new Date() })
      .where(eq(brandConfigs.id, existing[0].id));
  } else {
    await db.insert(brandConfigs).values({
      userId: user.id,
      name: "Default",
      config,
    });
  }
}
