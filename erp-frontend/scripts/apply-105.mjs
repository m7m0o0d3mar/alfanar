import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://epxxsgensnimdskcmvdj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweHhzZ2Vuc25pbWRza2NtdmRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NDA5OSwiZXhwIjoyMDk2MjUwMDk5fQ.O_G3cF83i_GkDGKZVzgtD29lKzD0LTxHzQi3Y63Bt7A'
);

const statements = [
  `CREATE POLICY "Enable read for anon on published units" ON units FOR SELECT TO anon USING (is_published = true)`,
  `CREATE POLICY "Enable read for anon on published media" ON property_media FOR SELECT TO anon USING (is_published = true)`,
  `CREATE POLICY "Enable read for anon on published tours" ON virtual_tours FOR SELECT TO anon USING (is_published = true)`,
  `CREATE POLICY "Enable read for anon on active projects" ON projects FOR SELECT TO anon USING (is_active = true)`,
  `CREATE POLICY "Enable read for anon on blocks" ON blocks FOR SELECT TO anon USING (true)`,
  `CREATE POLICY "Enable read for anon on floors" ON floors FOR SELECT TO anon USING (true)`,
];

console.log('Applying migration 105 (Public Portal RLS policies)');
console.log(`Total statements: ${statements.length}`);

let ok = 0, fail = 0;
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
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
