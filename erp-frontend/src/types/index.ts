export type UserRole =
  | 'admin' | 'developer' | 'main_contractor' | 'subcontractor'
  | 'engineer' | 'quality' | 'hse' | 'hr' | 'finance'
  | 'consultant' | 'client' | 'sales' | 'project_manager';

export interface UserProfile {
  id: string;
  email?: string;
  full_name_en: string;
  full_name_ar?: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  default_language: 'ar' | 'en';
  is_active: boolean;
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
  status: string;
  progress_percent: number;
  start_date?: string;
  end_date?: string;
  location?: string;
}

export interface SystemSettings {
  company_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  default_language: 'ar' | 'en';
  app_name: string;
  theme: 'light' | 'dark';
  [key: string]: unknown;
}

export interface RolePermission {
  role: UserRole;
  permissions: Record<string, unknown>;
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
