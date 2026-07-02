import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://epxxsgensnimdskcmvdj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweHhzZ2Vuc25pbWRza2NtdmRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NDA5OSwiZXhwIjoyMDk2MjUwMDk5fQ.O_G3cF83i_GkDGKZVzgtD29lKzD0LTxHzQi3Y63Bt7A'
);

// Check existing units
const { data: existing } = await s.rpc('exec_sql', {
  query: `SELECT id, unit_code, status, is_published, price, bedrooms, bathrooms, area_sqm, unit_type FROM units WHERE is_active = true ORDER BY unit_code LIMIT 20`
});
console.log('Existing units:');
existing?.forEach(u => {
  console.log(`  ${u.unit_code} | status=${u.status} | published=${u.is_published} | type=${u.unit_type} | price=${u.price} | beds=${u.bedrooms} | baths=${u.bathrooms} | area=${u.area_sqm}`);
});

// Publish some units using subquery to limit
const { data: unitsToPublish } = await s.rpc('exec_sql', {
  query: `SELECT id FROM units WHERE is_active = true AND status = 'available' AND NOT is_published LIMIT 5`
});

if (unitsToPublish?.length) {
  const ids = unitsToPublish.map(u => `'${u.id}'`).join(',');
  const { error } = await s.rpc('exec_sql', {
    query: `UPDATE units SET is_published = true, published_at = now() WHERE id IN (${ids})`
  });
  if (error) console.error('Publish error:', error.message);
  else console.log(`Published ${unitsToPublish.length} units`);
} else {
  // Try publishing any active unit
  const { data: anyUnits } = await s.rpc('exec_sql', {
    query: `SELECT id FROM units WHERE is_active = true AND NOT is_published LIMIT 5`
  });
  if (anyUnits?.length) {
    const ids = anyUnits.map(u => `'${u.id}'`).join(',');
    await s.rpc('exec_sql', {
      query: `UPDATE units SET is_published = true, published_at = now() WHERE id IN (${ids})`
    });
    console.log(`Published ${anyUnits.length} units (any status)`);
  } else {
    console.log('No units to publish - all already published or inactive');
  }
}

// Check published count
const { data: pubCount } = await s.rpc('exec_sql', {
  query: `SELECT COUNT(*) as cnt FROM units WHERE is_published = true`
});
console.log('Total published:', pubCount?.[0]?.cnt || 0);
