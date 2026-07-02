import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://epxxsgensnimdskcmvdj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweHhzZ2Vuc25pbWRza2NtdmRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NDA5OSwiZXhwIjoyMDk2MjUwMDk5fQ.O_G3cF83i_GkDGKZVzgtD29lKzD0LTxHzQi3Y63Bt7A'
);

const statements = [
  `CREATE TABLE IF NOT EXISTS virtual_tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    tour_url TEXT NOT NULL,
    tour_type VARCHAR(30) NOT NULL DEFAULT 'matterport' CHECK (tour_type IN ('matterport','zillow3d','custom3d','kuula','other')),
    thumbnail_url TEXT,
    is_published BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE floors ADD COLUMN IF NOT EXISTS room_data JSONB DEFAULT '[]'::jsonb`,
  `ALTER TABLE units ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT`,
  `ALTER TABLE units ADD COLUMN IF NOT EXISTS virtual_tour_type VARCHAR(30) DEFAULT 'matterport'`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS virtual_tour_type VARCHAR(30) DEFAULT 'matterport'`,
  `ALTER TABLE units ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false`,
  `ALTER TABLE units ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`,
  `ALTER TABLE property_media ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE virtual_tours ENABLE ROW LEVEL SECURITY`,
  `CREATE POLICY "Enable all for authenticated users" ON property_media FOR ALL TO authenticated USING (true) WITH CHECK (true)`,
  `CREATE POLICY "Enable all for authenticated users" ON virtual_tours FOR ALL TO authenticated USING (true) WITH CHECK (true)`,
  `CREATE INDEX IF NOT EXISTS idx_property_media_unit ON property_media(unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_property_media_project ON property_media(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_virtual_tours_unit ON virtual_tours(unit_id)`,
  `CREATE INDEX IF NOT EXISTS idx_virtual_tours_project ON virtual_tours(project_id)`,
  `INSERT INTO storage.buckets (id, name, public) VALUES ('property_media', 'property_media', true) ON CONFLICT (id) DO NOTHING`,
  `INSERT INTO page_registry (code, path, icon, name_en, name_ar, parent_code, section_key, section_label_en, section_label_ar, sort_order, is_enabled) VALUES
    ('property_gallery', '/media-gallery', 'Image', 'Media Gallery', 'معرض الوسائط', null, 'properties', 'Properties', 'العقارات', 45, true),
    ('virtual_tours', '/virtual-tours', 'Video', 'Virtual Tours', 'الجولات الافتراضية', null, 'properties', 'Properties', 'العقارات', 46, true),
    ('interactive_plans', '/interactive-plans', 'Grid3x3', 'Interactive Plans', 'المخططات التفاعلية', null, 'properties', 'Properties', 'العقارات', 47, true)
    ON CONFLICT (code) DO NOTHING`,
];

console.log('Applying migration 104 (Property Media Gallery, Virtual Tours & Interactive Floor Plans)');
console.log(`Total statements: ${statements.length}`);

let ok = 0, fail = 0;
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    const { error } = await s.rpc('exec_sql', { query: stmt });
    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`  [${i + 1}/${statements.length}] EXISTS: ${stmt.substring(0, 80)}...`);
        ok++;
      } else {
        console.error(`  [${i + 1}/${statements.length}] ERROR: ${error.message}`);
        fail++;
      }
    } else {
      console.log(`  [${i + 1}/${statements.length}] OK: ${stmt.substring(0, 80)}...`);
      ok++;
    }
  } catch (e) {
    console.error(`  [${i + 1}/${statements.length}] EXCEPTION: ${e.message}`);
    fail++;
  }
}

console.log(`\nResult: ${ok} OK, ${fail} failed`);
