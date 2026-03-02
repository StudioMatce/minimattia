import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const db = postgres(process.env.DATABASE_URL, { prepare: false });

// 1. Create trigger function for auto-creating profiles on signup
const triggerSql = `
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

try {
  await db.unsafe(triggerSql);
  console.log("✓ Trigger handle_new_user creato");
} catch (err) {
  console.error("✗ Errore trigger:", err.message);
}

// 2. Enable RLS on all tables
const rlsSql = `
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE brand_configs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE sketches ENABLE ROW LEVEL SECURITY;
  ALTER TABLE generated_visuals ENABLE ROW LEVEL SECURITY;
  ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;

  -- Profiles: users can read/update own profile
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

  -- Brand configs: users can CRUD own configs
  DROP POLICY IF EXISTS "Users can manage own brand configs" ON brand_configs;
  CREATE POLICY "Users can manage own brand configs" ON brand_configs
    FOR ALL USING (auth.uid() = user_id);

  -- Projects: users can CRUD own projects
  DROP POLICY IF EXISTS "Users can manage own projects" ON projects;
  CREATE POLICY "Users can manage own projects" ON projects
    FOR ALL USING (auth.uid() = user_id);

  -- Sketches: users can manage sketches of own projects
  DROP POLICY IF EXISTS "Users can manage own sketches" ON sketches;
  CREATE POLICY "Users can manage own sketches" ON sketches
    FOR ALL USING (
      project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    );

  -- Generated visuals: users can view visuals of own sketches
  DROP POLICY IF EXISTS "Users can manage own visuals" ON generated_visuals;
  CREATE POLICY "Users can manage own visuals" ON generated_visuals
    FOR ALL USING (
      sketch_id IN (
        SELECT s.id FROM sketches s
        JOIN projects p ON p.id = s.project_id
        WHERE p.user_id = auth.uid()
      )
    );

  -- Brand assets: users can manage assets of own brand configs
  DROP POLICY IF EXISTS "Users can manage own brand assets" ON brand_assets;
  CREATE POLICY "Users can manage own brand assets" ON brand_assets
    FOR ALL USING (
      brand_config_id IN (SELECT id FROM brand_configs WHERE user_id = auth.uid())
    );
`;

try {
  await db.unsafe(rlsSql);
  console.log("✓ RLS e policies configurate");
} catch (err) {
  console.error("✗ Errore RLS:", err.message);
}

// 3. Create storage buckets
try {
  const { error: brandErr } = await supabase.storage.createBucket(
    "brand-assets",
    { public: true, fileSizeLimit: 10485760 }
  );
  console.log(
    "✓ Bucket brand-assets:",
    brandErr ? brandErr.message : "creato"
  );
} catch (err) {
  console.error("✗ Errore bucket brand-assets:", err.message);
}

try {
  const { error: userErr } = await supabase.storage.createBucket(
    "user-content",
    { public: false, fileSizeLimit: 52428800 }
  );
  console.log(
    "✓ Bucket user-content:",
    userErr ? userErr.message : "creato"
  );
} catch (err) {
  console.error("✗ Errore bucket user-content:", err.message);
}

await db.end();
console.log("\n✓ Setup completato!");
