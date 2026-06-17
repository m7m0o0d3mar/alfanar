# Construction ERP - Schema Documentation

## 1. Entities Relationship Diagram (Textual ERD)

### Core Dynamic Tables
```
modules
  ├── module_settings (1:N via module_code)
  ├── status_definitions (1:N via module_code)
  ├── workflow_definitions (1:N via module_code)
  │     └── workflow_steps (1:N via workflow_id)
  ├── custom_fields (1:N via module_code)
  │     └── custom_field_values (1:N via field_id) -- polymorphic to any record
  └── kpi_definitions (1:N via module_code)
        └── kpi_logs (1:N via kpi_id)
```

### Users & Auth
```
auth.users (Supabase)
  └── user_profiles (1:1 via id)
        └── user_projects (1:N via user_id) -- polymorphic to projects
```

### Projects & Units
```
projects
  ├── project_phases (1:N)
  ├── project_stakeholders (1:N) -- links to companies
  ├── blocks (1:N)
  │     └── units (1:N)
  │           └── unit_progress (1:N)
  │                 └── item_progress (1:N)
  ├── daily_reports (1:N)
  │     └── daily_report_items (1:N)
  └── work_breakdown_structure (self-referencing via parent_id)
```

### Contracts & Contractors
```
companies
  └── contractors (1:1) -- extends company with contractor_type
        ├── contracts (1:N via contractor_id) -- linked to project
        │     ├── subcontracts (1:N)
        │     ├── contract_scope_items (1:N, self-referencing via parent_item_id)
        │     ├── contract_variations (1:N)
        │     └── contract_invoices (1:N)
        │           └── contract_invoice_items (1:N) -- links to scope items
        └── (parent_contractor_id self-ref for sub-tier)
```

### Work Execution & Quality
```
work_items (standard definitions)
work_tasks
  ├── work_requests (WIR) (1:N)
  │     └── work_request_lines (1:N)
  └── unit / contract references

work_requests -> unit / contract / task (N:1)
  ├── audit_trail (polymorphic via module_code + record_id)
```

### HSE
```
safety_incidents -> project
safety_observations -> project
toolbox_talks -> project
ppe_issuance -> project (optional -> employee)
safety_audits -> project
```

### HR & Payroll
```
employees -> project / company / labor_group
  └── attendance (1:N)
shifts -> project
labor_groups -> project / contractor
payroll_runs -> project
  └── payroll_details (1:N) -> employee
payroll_settings -> project
```

### Procurement & Inventory
```
suppliers -> company
materials_catalog
purchase_requests -> project
  └── purchase_request_items (1:N) -> material
purchase_orders -> project / supplier / pr
  └── purchase_order_items (1:N) -> material
goods_receipts -> project / po
  └── goods_receipt_items (1:N) -> po_item
inventory_stocks -> project / material (per warehouse)
material_issues -> project / unit / task
  └── material_issue_items (1:N) -> material
```

### Sales & Customers
```
leads -> project / assigned_to
customers -> company
unit_sales -> unit / customer / project
  ├── payment_plans (1:N)
  │     └── collections_schedule (1:N)
  └── handover_records (1:N)
```

### Technical Office & RFIs
```
technical_tickets -> project
  ├── ticket_comments (1:N)
  └── ticket_references (1:N) -- polymorphic links to any record
```

### Approvals
```
approval_requests (polymorphic via module_code + record_id)
  └── approval_steps (1:N)
```

### Documents
```
documents -> project
  ├── document_versions (1:N)
  └── document_references (1:N) -- polymorphic links to any record
```

### Polymorphic Patterns Used
| Table | Polymorphic Fields | Purpose |
|-------|-------------------|---------|
| custom_field_values | module_code + record_id | Custom fields on any record |
| audit_trail | module_code + record_id | History on any record |
| ticket_references | ref_module_code + ref_record_id | Link tickets to any record |
| document_references | ref_module_code + ref_record_id | Link docs to any record |
| approval_requests | module_code + record_id | Approvals on any record |

---

## 2. RLS Strategy (High-Level)

### Role Hierarchy & Access Levels

| Role | Global Access | Project Scope |
|------|---------------|---------------|
| **admin** | Full access to everything | All projects |
| **developer** / **owner** | Their own company data | All projects where they are owner |
| **project_manager** | Limited to assigned projects | Full project data (read/write) |
| **main_contractor** | Their own company data | Their contracts, WIRs, invoices |
| **subcontractor** | Very limited | Only their own work scope |
| **engineer** | Per-project assignments | Execution, WIR, RFI, Drawings |
| **quality** | Per-project assignments | WIR, NCR, inspections |
| **hse** | Per-project assignments | Safety incidents, observations |
| **hr** | Cross-project for people data | Employees, attendance, payroll |
| **finance** | Cross-project for financial data | Contracts, invoices, budgets |
| **sales** | Cross-project for sales data | Leads, customers, unit sales |
| **consultant** | Per-project | RFIs, drawings, quality docs |
| **client** | Own units only | Their unit, sales, handover |

### RLS Policy Categories

1. **Admin bypass** (is_admin() function) — applied to all tables
2. **Project-scoped access** (has_project_access / has_project_role) — most business tables
3. **Self-owned data** (requested_by = auth.uid()) — WIRs, RFIs, PRs
4. **Role-based access** (current_user_role() IN (...)) — HR, Finance, Sales
5. **Polymorphic visibility** — approvals, documents linked to accessible records

### Key RLS Design Decisions

- **Helper functions** reduce policy duplication and are SECURITY DEFINER for consistency
- **user_projects** is the central permission mapping table — every project-scoped policy depends on it
- **No DELETE policies** for most business tables — use status-based soft delete or admin-only physical delete
- **INSERT vs UPDATE policies** differ — e.g., any authenticated user can create an audit trail entry, but only admins can query it broadly
- **Client role** sees only their own unit data via implicit joins, ensuring they never see other clients' information
- **Polymorphic tables** (custom_field_values, audit_trail) grant access if the user can access the referenced record

### Storage RLS (Supabase Storage)

For Supabase Storage, create a bucket `erp-documents` with RLS:

```sql
-- Bucket: erp-documents (public for upload, restricted for read)
CREATE POLICY "storage_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'erp-documents' AND (
    auth.role() = 'authenticated'
  )
);

CREATE POLICY "storage_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'erp-documents' AND auth.role() = 'authenticated'
);
```
