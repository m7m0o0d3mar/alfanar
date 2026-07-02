import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');
const content = readFileSync(envPath, 'utf-8');
let url = '', key = '';
for (const line of content.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  if (k === 'VITE_SUPABASE_URL') url = v;
  if (k === 'SUPABASE_SERVICE_KEY') key = v;
}

const supabase = createClient(url, key);

async function runDDL(label, query) {
  const start = Date.now();
  try {
    const r = await supabase.rpc('exec_sql', { query });
    if (r.error) {
      console.log(`FAIL [${label}]: ${JSON.stringify(r.error).slice(0, 200)}`);
    } else {
      console.log(`OK   [${label}] (${Date.now() - start}ms)`);
    }
  } catch (e) {
    console.log(`ERR  [${label}]: ${e.message.slice(0, 200)}`);
  }
}

async function main() {
  // Tables in dependency order — minimal columns, no generated columns
  const tables = [
    {
      name: 'suppliers',
      sql: `CREATE TABLE IF NOT EXISTS suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_code TEXT NOT NULL UNIQUE, name_en TEXT NOT NULL,
        name_ar TEXT, contact_person TEXT, phone TEXT, email TEXT,
        address TEXT, cr_number TEXT, vat_number TEXT,
        is_approved BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'purchase_orders',
      sql: `CREATE TABLE IF NOT EXISTS purchase_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID, po_no TEXT NOT NULL, title TEXT NOT NULL,
        supplier_id UUID, order_date DATE, status TEXT DEFAULT 'draft',
        total_amount DECIMAL(20,2) DEFAULT 0,
        grand_total DECIMAL(20,2) DEFAULT 0,
        currency TEXT DEFAULT 'SAR', notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'contractors',
      sql: `CREATE TABLE IF NOT EXISTS contractors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contractor_type TEXT, is_approved BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'contracts',
      sql: `CREATE TABLE IF NOT EXISTS contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID, contract_no TEXT NOT NULL,
        contractor_id UUID, title_en TEXT NOT NULL,
        contract_type TEXT, contract_amount DECIMAL(20,2) DEFAULT 0,
        currency TEXT DEFAULT 'SAR', status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'subcontracts',
      sql: `CREATE TABLE IF NOT EXISTS subcontracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_contract_id UUID, subcontractor_id UUID,
        subcontract_no TEXT NOT NULL, title_en TEXT NOT NULL,
        amount DECIMAL(20,2) DEFAULT 0, status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'contract_invoices',
      sql: `CREATE TABLE IF NOT EXISTS contract_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID, invoice_no TEXT NOT NULL,
        invoice_type TEXT, invoice_date DATE,
        amount DECIMAL(20,2) DEFAULT 0,
        retention_pct DECIMAL(5,2) DEFAULT 10,
        retention_amount DECIMAL(20,2) DEFAULT 0,
        status TEXT DEFAULT 'draft',
        due_date DATE, paid_date DATE, paid_amount DECIMAL(20,2) DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'budget',
      sql: `CREATE TABLE IF NOT EXISTS budget (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID, budget_code TEXT NOT NULL UNIQUE,
        description TEXT, category TEXT, budget_type TEXT,
        total_budget DECIMAL(20,2) DEFAULT 0,
        used_amount DECIMAL(20,2) DEFAULT 0,
        currency TEXT DEFAULT 'SAR',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'approval_requests',
      sql: `CREATE TABLE IF NOT EXISTS approval_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_no TEXT, title_en TEXT NOT NULL,
        module_code TEXT NOT NULL, description TEXT,
        project_id UUID, approver_id UUID, ref_record_id UUID,
        requested_by UUID, status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'approval_steps',
      sql: `CREATE TABLE IF NOT EXISTS approval_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        approval_request_id UUID NOT NULL,
        step_order INT NOT NULL, step_user_id UUID,
        step_role TEXT, status TEXT DEFAULT 'pending',
        comment TEXT, decided_at TIMESTAMPTZ,
        acted_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'approval_activity_results',
      sql: `CREATE TABLE IF NOT EXISTS approval_activity_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        approval_request_id UUID, activity_id UUID, unit_id UUID,
        quantity_approved DECIMAL(15,2) DEFAULT 1, notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'project_phases',
      sql: `CREATE TABLE IF NOT EXISTS project_phases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL, phase_code TEXT NOT NULL,
        name_en TEXT NOT NULL, name_ar TEXT, description TEXT,
        start_date DATE, end_date DATE,
        budget DECIMAL(20,2), progress_percent DECIMAL(5,2) DEFAULT 0,
        status TEXT DEFAULT 'pending', "order" INT DEFAULT 0,
        UNIQUE(project_id, phase_code)
      )`
    },
    {
      name: 'work_breakdown_structure',
      sql: `CREATE TABLE IF NOT EXISTS work_breakdown_structure (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL, wbs_code TEXT NOT NULL,
        parent_id UUID, level INT DEFAULT 1,
        name_en TEXT NOT NULL, name_ar TEXT,
        weight_percent DECIMAL(5,2) DEFAULT 0,
        UNIQUE(project_id, wbs_code)
      )`
    },
    {
      name: 'work_tasks',
      sql: `CREATE TABLE IF NOT EXISTS work_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL, wbs_id UUID, unit_id UUID,
        contract_id UUID,
        task_code TEXT NOT NULL, title_en TEXT NOT NULL,
        title_ar TEXT, description TEXT, assigned_to UUID,
        start_date DATE, end_date DATE, status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium', progress DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(project_id, task_code)
      )`
    },
    {
      name: 'task_dependencies',
      sql: `CREATE TABLE IF NOT EXISTS task_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL, predecessor_id UUID NOT NULL,
        successor_id UUID NOT NULL,
        dependency_type TEXT DEFAULT 'FS',
        lag_days INT DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'resources',
      sql: `CREATE TABLE IF NOT EXISTS resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name_en TEXT NOT NULL, name_ar TEXT,
        resource_type TEXT, unit_of_measure TEXT,
        unit_price DECIMAL(15,2) DEFAULT 0,
        currency TEXT DEFAULT 'SAR', is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'task_resources',
      sql: `CREATE TABLE IF NOT EXISTS task_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL, resource_id UUID NOT NULL,
        allocated_units DECIMAL(15,2) DEFAULT 1,
        unit_price DECIMAL(15,2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    },
    {
      name: 'baselines',
      sql: `CREATE TABLE IF NOT EXISTS baselines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID, name TEXT NOT NULL,
        baseline_no INT DEFAULT 1, is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by UUID
      )`
    },
    {
      name: 'units',
      sql: `CREATE TABLE IF NOT EXISTS units (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL, block_id UUID,
        unit_code TEXT NOT NULL, unit_no TEXT,
        unit_type TEXT, floor_number INT,
        area_sqm DECIMAL(10,2), area_built DECIMAL(10,2),
        bedrooms INT DEFAULT 0, bathrooms INT DEFAULT 0,
        status TEXT DEFAULT 'available',
        price DECIMAL(20,2), currency TEXT DEFAULT 'SAR',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(project_id, unit_code)
      )`
    }
  ];

  for (const t of tables) {
    await runDDL(t.name, t.sql);
  }
  console.log('All done.');
}

main().catch(e => console.log('FATAL:', e.message));
