export type UserRole =
  | 'admin' | 'developer' | 'main_contractor' | 'subcontractor'
  | 'engineer' | 'quality' | 'hse' | 'hr' | 'finance'
  | 'consultant' | 'client' | 'sales' | 'project_manager';

export interface Role {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  description?: string;
  is_system: boolean;
  hierarchy_level: number;
  is_active: boolean;
}

export interface Specialization {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  description?: string;
  is_active: boolean;
}

export interface JobRole {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  hierarchy_level: number;
  is_active: boolean;
}

export interface Region {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  is_active: boolean;
}

export interface Block {
  id: string;
  region_id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  is_active: boolean;
}

export interface PageRegistryEntry {
  id?: string;
  code: string;
  path: string;
  icon?: string;
  name_en: string;
  name_ar?: string;
  parent_code?: string;
  section_key?: string;
  section_label_en?: string;
  section_label_ar?: string;
  sort_order: number;
  is_enabled: boolean;
  is_admin: boolean;
  require_module?: string;
  config?: PageRegistryConfig;
}

export interface PageRegistryConfig {
  view?: 'crud' | 'table' | 'grid' | 'stats' | 'custom';
  entity_type?: string;
  list_fields?: string[];
  detail_fields?: string[];
  custom_component?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  user_profiles?: { full_name_en: string; full_name_ar?: string };
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name_en: string;
  full_name_ar?: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  role_id?: string;
  specialization_id?: string;
  job_role_id?: string;
  region_id?: string;
  block_id?: string;
  department_id?: string;
  default_language: 'ar' | 'en';
  is_active: boolean;
  employee_code?: string;
  hire_date?: string;
  employment_status?: string;
  nationality?: string;
  id_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  last_login?: string;
  created_at?: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  token: string;
  invited_by?: string;
  role?: string;
  specialization_id?: string;
  job_role_id?: string;
  region_id?: string;
  department_id?: string;
  full_name_en?: string;
  full_name_ar?: string;
  phone?: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
  accepted_at?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  device_info?: string;
  location?: string;
  is_active: boolean;
  last_active_at: string;
  started_at: string;
  ended_at?: string;
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface UserProject {
  id: string;
  user_id: string;
  project_id: string;
  project_role: string;
}

export interface Module {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  icon: string;
  is_enabled: boolean;
  order: number;
}

export interface StatusDefinition {
  id: string;
  module_code: string;
  status_code: string;
  label_en: string;
  label_ar: string;
  color: string;
  icon?: string;
  order: number;
  is_default: boolean;
  is_final: boolean;
  is_cancelled: boolean;
}

export interface WorkflowDefinition {
  id: string;
  module_code: string;
  name_en: string;
  name_ar: string;
  is_default: boolean;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  from_status_code: string;
  to_status_code: string;
  allowed_roles: string[];
  action_label_en: string;
  action_label_ar: string;
  require_attachment: boolean;
  require_comment: boolean;
  notify_roles: string[];
}

export interface ApprovalRequest {
  id: string;
  request_no: string;
  module_code: string;
  record_id: string;
  title_en: string;
  title_ar?: string;
  description?: string;
  current_step: number;
  total_steps: number;
  status: string;
  requested_by: string;
  project_id?: string;
  approver_id?: string;
  ref_record_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep {
  id: string;
  approval_request_id: string;
  step_order: number;
  step_role: string;
  step_user_id?: string;
  status: string;
  comment?: string;
  decided_at?: string;
  decided_by?: string;
  acted_by?: string;
}

export interface CustomField {
  id: string;
  module_code: string;
  name: string;
  label_en: string;
  label_ar: string;
  field_type: 'text' | 'number' | 'date' | 'enum' | 'lookup' | 'boolean' | 'textarea' | 'json';
  enum_values?: string[];
  lookup_module?: string;
  is_required: boolean;
  is_visible: boolean;
  order: number;
}

export interface KpiDefinition {
  id: string;
  module_code: string;
  code: string;
  name_en: string;
  name_ar: string;
  formula_type: 'count' | 'sum' | 'ratio' | 'avg_duration' | 'custom';
  config_json: Record<string, unknown>;
  unit: string;
  target_value?: number;
  is_active: boolean;
}

export interface Project {
  id: string;
  project_code: string;
  name_en: string;
  name_ar?: string;
  project_type?: string;
  status: string;
  progress_percent: number;
  start_date?: string;
  end_date?: string;
  location?: string;
  budget_amount?: number;
  latitude?: number;
  longitude?: number;
}

export interface SystemSettings {
  company_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  success_color: string;
  danger_color: string;
  warning_color: string;
  info_color: string;
  sidebar_bg: string;
  sidebar_text: string;
  header_bg: string;
  header_text: string;
  card_bg: string;
  default_language: 'ar' | 'en';
  app_name: string;
  theme: 'light' | 'dark';
  font_family: string;
  custom_css: string;
  login_message: string;
  login_logo_url: string;
  favicon_url: string;
  timezone: string;
  date_format: string;
  currency: string;
  currency_symbol: string;
  max_upload_size_mb: number;
  session_timeout_minutes: number;
  maintenance_mode: boolean;
  enable_registration: boolean;
  privacy_policy_url: string;
  terms_url: string;
  email_from_name: string;
  email_from_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  notification_email: string;
  google_maps_api_key: string;
  sms_provider: string;
  webhook_url: string;
  rtl_enabled: boolean;
  date_format_display: string;
  time_format: string;
  dashboard_widgets: string;
  dashboard_layout: string;
  [key: string]: unknown;
}

export type PermissionScope = 'global' | 'project' | 'block' | 'unit';

export interface RolePermission {
  id: string;
  role: UserRole;
  role_id?: string;
  permissions: Record<string, unknown>;
  scope_type: PermissionScope;
  scope_id?: string;
  name_en?: string;
  name_ar?: string;
  is_active: boolean;
}

export interface SQLResult {
  columns: string[];
  rows: Record<string, unknown>[];
  error?: string;
}

// === Scheduling / Timeline Types ===
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type ResourceType = 'labor' | 'material' | 'equipment' | 'subcontractor';

export interface TaskDependency {
  id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  lag_days: number;
  dependency_type: DependencyType;
  created_at?: string;
}

export interface ScheduleTask {
  id: string;
  project_id?: string;
  task_code: string;
  title_en: string;
  title_ar?: string;
  description?: string;
  wbs_id?: string;
  unit_id?: string;
  contract_id?: string;
  assigned_to?: string;
  assignee_name?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  duration_type?: 'calendar' | 'work';
  status: string;
  priority: string;
  progress: number;
  early_start?: string;
  early_finish?: string;
  late_start?: string;
  late_finish?: string;
  total_float?: number;
  is_critical?: boolean;
  baseline_start?: string;
  baseline_end?: string;
  suspend_date?: string;
  resume_date?: string;
  target_date?: string;
  actual_completion_date?: string;
  division?: string;
  sub_division?: string;
  activity?: string;
  zone?: string;
  block?: string;
  unit_code?: string;
  unit_type?: string;
  created_at?: string;
}

export interface WBSNode {
  id: string;
  project_id: string;
  wbs_code: string;
  parent_id?: string;
  level: number;
  name_en: string;
  name_ar?: string;
  weight_percent: number;
  children?: WBSNode[];
  tasks?: ScheduleTask[];
  expanded?: boolean;
}

export interface ScheduleFilter {
  project_id?: string;
  status?: string[];
  priority?: string[];
  assigned_to?: string[];
  search?: string;
  is_critical?: boolean;
  level?: 'project' | 'phase' | 'wbs' | 'task';
  scale?: 'day' | 'week' | 'month';
}

export interface Resource {
  id: string;
  project_id: string;
  resource_code: string;
  name_en: string;
  name_ar?: string;
  resource_type: ResourceType;
  unit_of_measure: string;
  cost_per_unit: number;
  currency: string;
  calendar_id?: string;
  max_units?: number;
  is_active: boolean;
}

export interface TaskResource {
  id: string;
  task_id: string;
  resource_id: string;
  allocated_units: number;
  unit_price: number;
  total_cost?: number;
  resource?: Resource;
}

export interface Baseline {
  id: string;
  project_id: string;
  baseline_no: number;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface Calendar {
  id: string;
  project_id?: string;
  name: string;
  is_base: boolean;
  work_week: Record<string, boolean>;
  work_hours_start: string;
  work_hours_end: string;
}

// === Attendance Types ===
export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  project_id?: string;
  project_name?: string;
  unit_id?: string;
  unit_name?: string;
  check_in: string;
  check_out?: string;
  check_in_location?: string;
  check_out_location?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_out_lat?: number;
  check_out_lng?: number;
  check_in_method?: string;
  check_out_method?: string;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'overtime';
  total_hours?: number;
  overtime_hours?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  half_day: number;
  overtime: number;
  total_hours: number;
  avg_hours: number;
}

export interface ShiftDefinition {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_night_shift: boolean;
  is_active: boolean;
  overtime_rate?: number;
  deduction_rate?: number;
  max_overtime_hours?: number;
  timezone?: string;
  work_days?: string[];
  color?: string;
  description?: string;
}

export interface EmployeeShift {
  id: string;
  employee_id: string;
  shift_id: string;
  shift_name?: string;
  effective_from: string;
  effective_to?: string;
}

export interface OvertimeRule {
  id: string;
  project_id?: string;
  shift_id?: string;
  employee_id?: string;
  overtime_rate: number;
  max_overtime_hours?: number;
  is_active: boolean;
  effective_from?: string;
  effective_to?: string;
  created_at: string;
}

export interface AttendanceRequest {
  id: string;
  employee_id: string;
  request_type: 'leave' | 'permission' | 'remote' | 'missed_punch' | 'correction' | 'escalation';
  leave_type?: 'sick' | 'annual' | 'emergency' | 'personal' | 'other';
  title_en?: string;
  title_ar?: string;
  reason?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  total_days?: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  escalation_to?: string;
  escalation_reason?: string;
  attachment_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RandomVerification {
  id: string;
  employee_id: string;
  attendance_record_id?: string;
  verification_type: 'photo' | 'location' | 'biometric' | 'qr_code' | 'pin';
  status: 'pending' | 'verified' | 'failed' | 'expired';
  requested_at: string;
  responded_at?: string;
  photo_url?: string;
  location_lat?: number;
  location_lng?: number;
  location_name?: string;
  pin_code?: string;
  qr_code?: string;
  notes?: string;
  verified_by?: string;
}

// === EVM & Cost Types ===
export interface EVMMetric {
  id: string;
  project_id: string;
  period: string;
  planned_value: number;
  earned_value: number;
  actual_cost: number;
  created_at: string;
}

export interface EVMBaseline {
  id: string;
  project_id: string;
  baseline_date: string;
  total_planned_value: number;
  budget_at_completion: number;
  estimate_at_completion: number;
  estimate_to_complete: number;
  variance_at_completion: number;
  cost_performance_index: number;
  schedule_performance_index: number;
  created_at: string;
}

export interface ProjectCostItem {
  id: string;
  project_id: string;
  category: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'consultant' | 'overhead' | 'admin' | 'contingency' | 'other';
  name_en: string;
  name_ar?: string;
  planned_amount: number;
  actual_amount: number;
  committed_amount: number;
  currency: string;
  notes?: string;
  created_at: string;
}

export interface CostReport {
  id: string;
  project_id: string;
  report_date: string;
  report_type: 'monthly' | 'weekly' | 'quarterly' | 'custom';
  total_budget: number;
  total_committed: number;
  total_actual: number;
  total_forecast: number;
  budget_variance: number;
  cost_performance_index: number;
  schedule_performance_index: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface BudgetForecast {
  id: string;
  project_id: string;
  forecast_date: string;
  forecast_type: 'optimistic' | 'pessimistic' | 'most_likely';
  estimate_at_completion: number;
  estimate_to_complete: number;
  variance_at_completion: number;
  assumptions?: string;
  created_by?: string;
  created_at: string;
}

// === Report Types ===
export interface ReportTemplate {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  description?: string;
  category: 'daily' | 'weekly' | 'monthly' | 'progress' | 'quality' | 'safety' | 'custom';
  icon: string;
  layout_config: Record<string, unknown>;
  is_active: boolean;
  version: number;
  created_by?: string;
  created_at: string;
  sections?: ReportTemplateSection[];
  approval_stages?: ReportApprovalStage[];
}

export interface ReportTemplateSection {
  id: string;
  template_id: string;
  sort_order: number;
  section_key: string;
  title_en: string;
  title_ar?: string;
  section_type: 'text' | 'table' | 'chart' | 'image' | 'signature' | 'dynamic' | 'checkbox' | 'select';
  content_template?: string;
  config: Record<string, unknown>;
  is_required: boolean;
}

export interface Report {
  id: string;
  template_id: string;
  project_id?: string;
  department_id?: string;
  unit_id?: string;
  block_id?: string;
  activity_id?: string;
  created_by?: string;
  assigned_to?: string;
  title_en: string;
  title_ar?: string;
  report_date: string;
  due_date?: string;
  status: 'draft' | 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'archived';
  progress_pct: number;
  report_data: Record<string, unknown>;
  is_locked: boolean;
  previous_version_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportApprovalStage {
  id: string;
  template_id: string;
  stage_order: number;
  stage_name_en: string;
  stage_name_ar?: string;
  approver_role?: string;
  approver_user_id?: string;
  required_signatures: number;
  timeout_hours?: number;
}

export interface ReportApproval {
  id: string;
  report_id: string;
  stage_id: string;
  approver_id?: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  comments?: string;
  signed_at?: string;
}

export interface ReportTracking {
  id: string;
  report_id: string;
  event_type: 'created' | 'submitted' | 'approved' | 'rejected' | 'revised' | 'archived' | 'reminder_sent' | 'escalated' | 'stage_approved' | 'stage_rejected';
  event_data: Record<string, unknown>;
  created_by?: string;
  created_at: string;
}

// === Call & Bot Types ===
export interface CallLog {
  id: string;
  caller_id?: string;
  callee_id?: string;
  call_type: 'audio' | 'video' | 'conference';
  status: 'ringing' | 'ongoing' | 'completed' | 'missed' | 'rejected' | 'cancelled';
  started_at?: string;
  ended_at?: string;
  duration_seconds: number;
  project_id?: string;
  conversation_id?: string;
  created_at: string;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  joined_at?: string;
  left_at?: string;
  is_muted: boolean;
  is_video_on: boolean;
}

export interface ChatBot {
  id: string;
  name_en: string;
  name_ar?: string;
  description?: string;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export interface BotIntent {
  id: string;
  bot_id: string;
  intent_key: string;
  name_en: string;
  name_ar?: string;
  patterns: string[];
  response_en: string;
  response_ar?: string;
  action_type?: 'reply' | 'create_task' | 'create_log' | 'create_ticket' | 'create_meeting' | 'send_email' | 'webhook';
  action_config: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}

// === Map Types ===
export interface ProjectLocation {
  id: string;
  project_id: string;
  project_name: string;
  project_code: string;
  lat: number;
  lng: number;
  unit_count: number;
  status: string;
  progress_percent: number;
}

export interface UnitLocation {
  id: string;
  unit_no: string;
  project_id: string;
  project_name: string;
  lat: number;
  lng: number;
  status: string;
  unit_type?: string;
}

// === Procurement Enhancement Types ===
export interface ProcurementCategory {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  parent_id?: string;
  is_active: boolean;
}

export interface PurchaseRequisition {
  id: string;
  pr_no: string;
  title_en: string;
  title_ar?: string;
  project_id?: string;
  department?: string;
  requester_id?: string;
  urgency: string;
  category_id?: string;
  total_estimated: number;
  currency: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
}

export interface PRLineItem {
  id: string;
  pr_id: string;
  line_no: number;
  description_en?: string;
  description_ar?: string;
  catalog_item_id?: string;
  quantity: number;
  unit?: string;
  estimated_unit_price: number;
  estimated_total: number;
  need_by_date?: string;
  notes?: string;
}

export interface SourcingEvent {
  id: string;
  event_no: string;
  title_en: string;
  title_ar?: string;
  type: string;
  category_id?: string;
  project_id?: string;
  status: string;
  issue_date?: string;
  close_date?: string;
  currency: string;
  budget_range_min?: number;
  budget_range_max?: number;
  terms_conditions?: string;
  award_criteria?: string;
  award_method: string;
  awarded_supplier_id?: string;
  awarded_amount?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface SourcingBid {
  id: string;
  event_id: string;
  supplier_id: string;
  supplier_name?: string;
  bid_no?: string;
  bid_date?: string;
  total_amount: number;
  currency: string;
  delivery_days?: number;
  validity_days?: number;
  payment_terms?: string;
  notes?: string;
  score?: number;
  rank?: number;
  is_winner: boolean;
  status: string;
}

export interface ProcurementContract {
  id: string;
  contract_no: string;
  title_en: string;
  title_ar?: string;
  supplier_id: string;
  supplier_name?: string;
  project_id?: string;
  sourcing_event_id?: string;
  type: string;
  status: string;
  start_date?: string;
  end_date?: string;
  total_value: number;
  currency: string;
  payment_terms?: string;
  delivery_terms?: string;
  warranty_period?: number;
  auto_renew: boolean;
  notice_period_days?: number;
  attachment_url?: string;
  notes?: string;
  created_by?: string;
}

export interface SupplierEvaluation {
  id: string;
  supplier_id: string;
  contract_id?: string;
  evaluated_by?: string;
  evaluation_date: string;
  period?: string;
  quality_score?: number;
  delivery_score?: number;
  price_score?: number;
  responsiveness_score?: number;
  compliance_score?: number;
  overall_score?: number;
  rating?: string;
  comments?: string;
}

export interface ProcurementBudget {
  id: string;
  fiscal_year: number;
  category_id?: string;
  project_id?: string;
  allocated_amount: number;
  spent_amount: number;
  currency: string;
  notes?: string;
}

export interface CatalogItem {
  id: string;
  supplier_id?: string;
  category_id?: string;
  item_code: string;
  name_en: string;
  name_ar?: string;
  description?: string;
  unit?: string;
  unit_price: number;
  currency: string;
  minimum_order_qty: number;
  lead_time_days?: number;
  is_active: boolean;
}

// === Finance Enhancement Types ===
export interface ChartOfAccount {
  id: string;
  account_code: string;
  name_en: string;
  name_ar?: string;
  type: string;
  parent_id?: string;
  is_active: boolean;
  is_system: boolean;
}

export interface JournalEntry {
  id: string;
  entry_no: string;
  entry_date: string;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  currency: string;
  exchange_rate: number;
  total_debit: number;
  total_credit: number;
  status: string;
  posted_by?: string;
  posted_at?: string;
  created_at: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_name?: string;
  line_no: number;
  description?: string;
  debit: number;
  credit: number;
  cost_center?: string;
  project_id?: string;
}

export interface ExpenseClaim {
  id: string;
  claim_no: string;
  employee_id: string;
  employee_name?: string;
  title: string;
  description?: string;
  total_amount: number;
  currency: string;
  status: string;
  project_id?: string;
  project?: { project_code: string; name_en: string };
  approved_by?: string;
  approved_at?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
}

export interface ExpenseClaimItem {
  id: string;
  claim_id: string;
  expense_date: string;
  category: string;
  description?: string;
  amount: number;
  currency: string;
  receipt_url?: string;
  notes?: string;
}

export interface CurrencyRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  source: string;
}

export interface TaxRate {
  id: string;
  tax_code: string;
  name_en: string;
  name_ar?: string;
  rate: number;
  is_active: boolean;
  is_default: boolean;
}

// === HR Enhancement Types ===
export interface Department {
  id: string;
  code: string;
  name_en: string;
  name_ar?: string;
  parent_id?: string;
  manager_id?: string;
  manager_name?: string;
  is_active: boolean;
}

export interface EmployeeContract {
  id: string;
  employee_id: string;
  employee_name?: string;
  contract_no: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  probation_end_date?: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  total_salary: number;
  status: string;
  attachment_url?: string;
  notes?: string;
}

export interface EmployeeAdvance {
  id: string;
  advance_no: string;
  employee_id: string;
  employee_name?: string;
  type: string;
  amount: number;
  installment_count: number;
  installment_amount: number;
  reason?: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  disbursed_at?: string;
  created_at: string;
}

export interface AdvanceInstallment {
  id: string;
  advance_id: string;
  installment_no: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_date?: string;
  status: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  issue_date?: string;
  expiry_date?: string;
  is_verified: boolean;
  notes?: string;
}

// === Notification Types ===
export interface AppNotification {
  id: string;
  user_id: string;
  title_en: string;
  title_ar?: string;
  body_en?: string;
  body_ar?: string;
  type: string;
  channel: string;
  priority: string;
  reference_type?: string;
  reference_id?: string;
  is_read: boolean;
  read_at?: string;
  email_sent: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id?: string;
  user_id: string;
  email_notifications: boolean;
  in_app_notifications: boolean;
  notify_on_approval: boolean;
  notify_on_rejection: boolean;
  notify_on_status_change: boolean;
  notify_on_new_assignment: boolean;
  notify_on_comments: boolean;
  notify_on_deadline: boolean;
  daily_digest: boolean;
}

// === Document Types ===
export interface FileUpload {
  id: string;
  bucket_name: string;
  file_name: string;
  file_size: number;
  mime_type?: string;
  storage_path: string;
  public_url?: string;
  uploaded_by?: string;
  uploader_name?: string;
  reference_type?: string;
  reference_id?: string;
  folder?: string;
  tags?: string[];
  is_public: boolean;
  created_at: string;
}

export interface DocumentFolder {
  id: string;
  name_en: string;
  name_ar?: string;
  parent_id?: string;
  icon?: string;
  sort_order: number;
  created_by?: string;
}

// === Form Definitions ===
export interface FormFieldConfig {
  key: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'toggle' | 'email' | 'phone' | 'user_lookup' | 'entity_lookup';
  label_en: string;
  label_ar: string;
  required?: boolean;
  placeholder_en?: string;
  placeholder_ar?: string;
  options?: { value: string; label_en: string; label_ar: string }[];
  validation?: { min?: number; max?: number; pattern?: string; min_length?: number; max_length?: number };
  default_value?: string;
  order: number;
  width?: 'full' | 'half';
}

export interface FormDefinitionConfig {
  fields: FormFieldConfig[];
  layout?: 'single' | 'two_column' | 'three_column';
  submit_label_en?: string;
  submit_label_ar?: string;
}

export interface FormDefinition {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  entity_type?: string;
  config: FormDefinitionConfig;
  is_active: boolean;
  updated_at: string;
}

// === Email Templates ===
export interface EmailTemplate {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  subject_en: string;
  subject_ar: string;
  body_en: string;
  body_ar: string;
  variables: string[];
  is_active: boolean;
  updated_at: string;
}
