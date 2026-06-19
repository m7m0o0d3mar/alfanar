import { supabase } from './supabase';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date';
}

export interface FkResolver {
  column: string;
  table: string;
  lookupField: string;
  targetField: string;
}

export interface SyncConfig {
  table: string;
  columns: ImportColumn[];
  fkResolvers?: FkResolver[];
  defaults?: Record<string, unknown>;
  uniqueKeys?: string[];
}

export interface SyncResult {
  success: number;
  errors: { row: number; msg: string }[];
  total: number;
}

async function resolveFk(
  resolver: FkResolver,
  value: string,
  cache: Map<string, Map<string, string>>
): Promise<string | null> {
  if (!value) return null;
  if (!cache.has(resolver.table)) cache.set(resolver.table, new Map());
  const tableCache = cache.get(resolver.table)!;
  const cacheKey = `${resolver.lookupField}:${value}`;
  if (tableCache.has(cacheKey)) return tableCache.get(cacheKey)!;
  const { data, error } = await supabase
    .from(resolver.table)
    .select(resolver.targetField)
    .eq(resolver.lookupField, value)
    .maybeSingle();
  if (error || !data) return null;
  const id = String((data as unknown as Record<string, string>)[resolver.targetField] ?? '');
  tableCache.set(cacheKey, id);
  return id;
}

export async function syncRows(
  rows: Record<string, string>[],
  config: SyncConfig,
  currentUserId?: string
): Promise<SyncResult> {
  const errors: { row: number; msg: string }[] = [];
  let success = 0;
  const fkCache = new Map<string, Map<string, string>>();
  const batchSize = 50;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const payload: Record<string, unknown> = { ...config.defaults };

    for (const col of config.columns) {
      let val: unknown = row[col.label]?.trim() || null;
      if (col.type === 'number' && val !== null) {
        val = Number(val);
        if (isNaN(val as number)) {
          errors.push({ row: i + 2, msg: `"${col.label}" must be a valid number` });
          continue;
        }
      }
      if (col.type === 'date' && val !== null) {
        const d = new Date(val as string);
        if (isNaN(d.getTime())) {
          errors.push({ row: i + 2, msg: `"${col.label}" must be a valid date` });
          continue;
        }
        val = d.toISOString().split('T')[0];
      }
      payload[col.key] = val;
    }

    if (config.fkResolvers) {
      let skip = false;
      for (const resolver of config.fkResolvers) {
        if (payload[resolver.column] !== null && payload[resolver.column] !== undefined) continue;
        const label = config.columns.find((c) => c.key === resolver.column)?.label;
        const rawVal = label ? (row[label]?.trim() || '') : '';
        if (!rawVal) {
          errors.push({ row: i + 2, msg: `Cannot resolve "${resolver.column}": no value provided` });
          skip = true;
          break;
        }
        const resolved = await resolveFk(resolver, rawVal, fkCache);
        if (!resolved) {
          errors.push({ row: i + 2, msg: `"${resolver.column}" = "${rawVal}" not found in ${resolver.table}` });
          skip = true;
          break;
        }
        payload[resolver.column] = resolved;
      }
      if (skip) continue;
    }

    if (currentUserId) {
      if (!payload.requested_by) payload.requested_by = currentUserId;
      if (!payload.reported_by) payload.reported_by = currentUserId;
      if (!payload.observed_by) payload.observed_by = currentUserId;
      if (!payload.uploaded_by) payload.uploaded_by = currentUserId;
    }
    if (payload.project_id === null || payload.project_id === undefined) {
      const { data: firstProject } = await supabase
        .from('projects')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (firstProject) payload.project_id = firstProject.id;
    }

    try {
      const { error } = await supabase.from(config.table).upsert(payload, {
        onConflict: config.uniqueKeys?.join(','),
      });
      if (error) throw error;
      success++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? friendlyError(err.message) : 'Unknown error';
      errors.push({ row: i + 2, msg });
    }
  }

  return { success, errors, total: rows.length };
}

function friendlyError(msg: string): string {
  if (msg.includes('violates not-null constraint')) {
    const match = msg.match(/column "([^"]+)"/);
    return match ? `Missing required field: "${match[1]}"` : 'Missing a required field';
  }
  if (msg.includes('violates foreign key constraint')) {
    const match = msg.match(/table "([^"]+)"/);
    return match ? `Referenced record not found in "${match[1]}"` : 'Referenced record not found';
  }
  if (msg.includes('duplicate key value')) return 'A record with this key already exists';
  return msg;
}

export { friendlyError };