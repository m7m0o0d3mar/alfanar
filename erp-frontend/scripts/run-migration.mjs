import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://epxxsgensnimdskcmvdj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweHhzZ2Vuc25pbWRza2NtdmRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NDA5OSwiZXhwIjoyMDk2MjUwMDk5fQ.O_G3cF83i_GkDGKZVzgtD29lKzD0LTxHzQi3Y63Bt7A'
);

const migrationName = process.argv[2];
if (!migrationName) { console.error('Usage: node run-migration.mjs <filename>'); process.exit(1); }

const sql = await import('fs').then(f => f.readFileSync(migrationName, 'utf8'));

// Split on semicolons at end of line that aren't inside string literals
function splitSQL(text) {
  const stmts = [];
  let cur = '';
  let inStr = false;
  let strCh = '';

  for (const ch of text) {
    if (inStr) {
      cur += ch;
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = true; strCh = ch; cur += ch; continue; }
    if (ch === ';') { stmts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  const last = cur.trim();
  if (last && !last.startsWith('--')) stmts.push(last);
  return stmts.filter(s => s.length > 0 && !s.startsWith('--'));
}

const stmts = splitSQL(sql);
console.log(`Statements: ${stmts.length}`);

let ok = 0, fail = 0;
for (let i = 0; i < stmts.length; i++) {
  const stmt = stmts[i].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (stmt.startsWith('--')) continue;

  // Check if this is a continuation (e.g. INSERT has VALUES on next line)
  // by checking if it starts with a keyword
  if (!/^(CREATE|ALTER|INSERT|SELECT|DROP|UPDATE|DELETE|GRANT|REVOKE|COPY|VACUUM|ANALYZE|COMMENT|DO|CALL)/i.test(stmt)) {
    console.log(`  SKIP (not a statement start): ${stmt.substring(0,80)}...`);
    continue;
  }

  try {
    const { error } = await s.rpc('exec_sql', { query: stmt });
    if (error) {
      // IF NOT EXISTS errors are OK
      if (error.message.includes('already exists')) {
        console.log(`  [${i + 1}/${stmts.length}] EXISTS (skipped): ${stmt.substring(0,80)}...`);
        ok++;
      } else {
        console.error(`  [${i + 1}/${stmts.length}] ERROR: ${error.message}`);
        console.error(`  SQL: ${stmt.substring(0,120)}...`);
        fail++;
      }
    } else {
      console.log(`  [${i + 1}/${stmts.length}] OK: ${stmt.substring(0,80)}...`);
      ok++;
    }
  } catch (e) {
    console.error(`  [${i + 1}/${stmts.length}] EXCEPTION: ${e.message}`);
    fail++;
  }
}

console.log(`\nResult: ${ok} OK, ${fail} failed`);
