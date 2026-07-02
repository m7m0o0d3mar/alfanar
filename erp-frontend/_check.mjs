import { createClient } from '@supabase/supabase-js';
const s = createClient(
  'https://epxxsgensnimdskcmvdj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweHhzZ2Vuc25pbWRza2NtdmRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NDA5OSwiZXhwIjoyMDk2MjUwMDk5fQ.O_G3cF83i_GkDGKZVzgtD29lKzD0LTxHzQi3Y63Bt7A'
);
const { data: buckets } = await s.storage.listBuckets();
console.log('buckets:', JSON.stringify(buckets?.map(b => ({ id: b.id, name: b.name, public: b.public }))));
const { data: floors } = await s.from('floors').select('id, floor_number, name_en, plan_image, area_sqm, building_id').limit(5);
console.log('floors:', JSON.stringify(floors));
const { data: cols } = await s.rpc('exec_sql', { query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'floors' ORDER BY ordinal_position" });
console.log('floors columns:', JSON.stringify(cols));
