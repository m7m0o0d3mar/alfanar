// ---------------------------------------------------------------------------
// Business Rules – pure functions extracted from ERP page patterns.
// Each function is independently testable and mirrors real inline logic.
// ---------------------------------------------------------------------------

// ── 1. State Machine ──────────────────────────────────────────────────────

export type RecordStatus = 'draft' | 'pending' | 'pending_qc' | 'pending_consultant' | 'pending_pm' | 'approved' | 'rejected' | 'closed' | 'cancelled' | 'open' | 'in_progress' | 'review' | 'completed' | 'paid' | 'current' | 'archived';
// 'open','in_progress','review','completed' are used for tasks
// 'paid' is used for invoices
// 'current','archived' are used for documents

export type EntityType = 'work_request' | 'purchase_order' | 'invoice' | 'task' | 'document';

/** Valid state transitions for each entity type. */
export const transitions: Record<EntityType, { from: RecordStatus; to: RecordStatus }[]> = {
  work_request: [
    { from: 'draft', to: 'pending' },
    { from: 'draft', to: 'cancelled' },
    { from: 'pending', to: 'pending_qc' },
    { from: 'pending_qc', to: 'pending_consultant' },
    { from: 'pending_qc', to: 'rejected' },
    { from: 'pending_consultant', to: 'pending_pm' },
    { from: 'pending_consultant', to: 'rejected' },
    { from: 'pending_pm', to: 'approved' },
    { from: 'pending_pm', to: 'rejected' },
    { from: 'rejected', to: 'draft' },           // re-submit
    { from: 'approved', to: 'closed' },
  ],
  purchase_order: [
    { from: 'draft', to: 'pending' },
    { from: 'draft', to: 'cancelled' },
    { from: 'pending', to: 'approved' },
    { from: 'pending', to: 'rejected' },
    { from: 'approved', to: 'closed' },
    { from: 'approved', to: 'cancelled' },
    { from: 'rejected', to: 'draft' },
  ],
  invoice: [
    { from: 'draft', to: 'pending' },
    { from: 'pending', to: 'approved' },
    { from: 'pending', to: 'rejected' },
    { from: 'approved', to: 'paid' as RecordStatus },
    { from: 'paid' as RecordStatus, to: 'closed' },
    { from: 'rejected', to: 'draft' },
  ],
  task: [
    { from: 'open', to: 'in_progress' as RecordStatus },
    { from: 'in_progress' as RecordStatus, to: 'review' as RecordStatus },
    { from: 'review' as RecordStatus, to: 'completed' as RecordStatus },
    { from: 'completed' as RecordStatus, to: 'closed' },
    { from: 'open', to: 'cancelled' },
  ],
  document: [
    { from: 'draft', to: 'current' as RecordStatus },
    { from: 'current' as RecordStatus, to: 'archived' as RecordStatus },
  ],
};

export function isValidTransition(entity: EntityType, from: RecordStatus, to: RecordStatus): boolean {
  const rules = transitions[entity];
  return rules.some(t => t.from === from && t.to === to);
}

/** Return list of valid next statuses for a given entity+status combination. */
export function validNextStatuses(entity: EntityType, current: RecordStatus): RecordStatus[] {
  return transitions[entity]
    .filter(t => t.from === current)
    .map(t => t.to);
}

/** Human-readable label for a status value. */
export function statusLabel(s: RecordStatus): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending',
    pending_qc: 'QC Review',
    pending_consultant: 'Consultant Review',
    pending_pm: 'PM Review',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
    cancelled: 'Cancelled',
    open: 'Open',
    in_progress: 'In Progress',
    review: 'Under Review',
    completed: 'Completed',
    paid: 'Paid',
    current: 'Current',
    archived: 'Archived',
  };
  return labels[s] || s;
}

// ── 2. Role-based Permissions ─────────────────────────────────────────────

export type Role = 'admin' | 'project_manager' | 'engineer' | 'quality' | 'consultant' | 'accountant' | 'procurement' | 'sales' | 'client' | 'developer';

export type Action = 'create' | 'edit' | 'delete' | 'approve' | 'reject' | 'view' | 'close' | 'export' | 'import' | 'manage_users' | 'manage_roles';

/** Permission matrix – true = role can perform action on the given entity. */
export function canPerform(role: Role, entity: EntityType, action: Action, ownedByUser?: boolean): boolean {
  // Admin overrides everything.
  if (role === 'admin' || role === 'developer') return true;

  // View is broadly allowed.
  if (action === 'view') return true;
  if (action === 'export') return true;

  // Owner can edit their own draft records.
  if (action === 'edit' && ownedByUser) return true;

  switch (role) {
    case 'project_manager':
      if (action === 'create') return true;
      if (action === 'edit') return true;
      if (action === 'delete') return false; // PMs cannot delete permanently
      if (action === 'approve') return entity === 'work_request' || entity === 'purchase_order';
      if (action === 'reject') return entity === 'work_request' || entity === 'purchase_order';
      if (action === 'close') return entity === 'work_request' || entity === 'task';
      return false;
    case 'engineer':
      if (action === 'create') return entity === 'work_request' || entity === 'task';
      if (action === 'edit') return entity === 'work_request' || entity === 'task';
      if (action === 'delete') return false;
      return false;
    case 'quality':
      if (action === 'create') return entity === 'work_request';
      if (action === 'edit') return entity === 'work_request';
      if (action === 'approve') return entity === 'work_request'; // QC approval
      if (action === 'reject') return entity === 'work_request';
      if (action === 'import') return true;
      return false;
    case 'consultant':
      if (action === 'approve') return entity === 'work_request';
      if (action === 'reject') return entity === 'work_request';
      return false;
    case 'accountant':
      if (action === 'create') return entity === 'invoice';
      if (action === 'edit') return entity === 'invoice';
      if (action === 'approve') return entity === 'invoice';
      if (action === 'close') return entity === 'invoice';
      return false;
    case 'procurement':
      if (action === 'create') return entity === 'purchase_order';
      if (action === 'edit') return entity === 'purchase_order';
      if (action === 'close') return entity === 'purchase_order';
      return false;
    case 'sales':
      if (action === 'create') return entity === 'invoice' || entity === 'document';
      if (action === 'edit') return entity === 'invoice' || entity === 'document';
      return false;
    case 'client':
      return false;
  }
  return false;
}

// ── 3. Financial Constraints ──────────────────────────────────────────────

export interface Budget {
  booked: number;
  open: number;
  spent: number;
}

export function budgetRemaining(budget: Budget): number {
  return budget.open - budget.spent;
}

export function canAllocate(budget: Budget, amount: number): { allowed: boolean; reason?: string } {
  if (amount <= 0) return { allowed: false, reason: 'Amount must be positive' };
  const remaining = budgetRemaining(budget);
  if (amount > remaining) {
    return { allowed: false, reason: `Insufficient budget: ${amount.toLocaleString()} requested, ${remaining.toLocaleString()} remaining` };
  }
  if (budget.open > budget.booked) {
    return { allowed: false, reason: `Open budget (${budget.open.toLocaleString()}) exceeds booked budget (${budget.booked.toLocaleString()})` };
  }
  return { allowed: true };
}

export interface InvoiceValidation {
  invoiceAmount: number;
  poAmount: number;
  paidSoFar: number;
}

export function validateInvoiceAmount(input: InvoiceValidation): { valid: boolean; reason?: string } {
  if (input.invoiceAmount <= 0) return { valid: false, reason: 'Invoice amount must be positive' };
  if (input.invoiceAmount > input.poAmount) {
    return { valid: false, reason: `Invoice (${input.invoiceAmount.toLocaleString()}) exceeds PO total (${input.poAmount.toLocaleString()})` };
  }
  const remaining = input.poAmount - input.paidSoFar;
  if (input.invoiceAmount > remaining) {
    return { valid: false, reason: `Invoice (${input.invoiceAmount.toLocaleString()}) exceeds remaining PO balance (${remaining.toLocaleString()})` };
  }
  return { valid: true };
}

// ── 4. Document Linkage Validation ────────────────────────────────────────

export enum DocType {
  REQUEST = 'request',
  QUOTE = 'quote',
  PO = 'po',
  RECEIPT = 'receipt',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
}

/** Required predecessors in the procurement-to-payment chain. */
export const docChain: Record<DocType, DocType[]> = {
  [DocType.REQUEST]: [],
  [DocType.QUOTE]: [DocType.REQUEST],
  [DocType.PO]: [DocType.QUOTE],
  [DocType.RECEIPT]: [DocType.PO],
  [DocType.INVOICE]: [DocType.PO],
  [DocType.PAYMENT]: [DocType.INVOICE],
};

export function validateDocChain(docType: DocType, existingTypes: Set<DocType>): { valid: boolean; missing: DocType[] } {
  const required = docChain[docType];
  const missing = required.filter(t => !existingTypes.has(t));
  return { valid: missing.length === 0, missing };
}

// ── 5. Progress & Aggregation ─────────────────────────────────────────────

export interface ProgressItem {
  weight: number;
  completed: number;
  total: number;
}

export function calculateProgressPercent(items: ProgressItem[]): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = items.reduce((s, i) => {
    const fraction = i.total > 0 ? Math.min(1, i.completed / i.total) : 0;
    return s + i.weight * fraction;
  }, 0);
  return Math.min(100, Math.round((weighted / totalWeight) * 100));
}

export interface BudgetSummary {
  bookedBudget: number;
  openBudget: number;
  contingency: number;
  actualSpent: number;
}

export function budgetVariance(b: BudgetSummary): { variance: number; variancePct: number; status: 'under_budget' | 'over_budget' | 'on_track' } {
  const variance = b.bookedBudget - b.actualSpent;
  const variancePct = b.bookedBudget > 0 ? Math.round((variance / b.bookedBudget) * 100) : 0;
  const status = variance > 0 ? 'under_budget' : variance < 0 ? 'over_budget' : 'on_track';
  return { variance, variancePct, status };
}

// ── 6. Conflict Detection ─────────────────────────────────────────────────

export interface LinkedRecord {
  entityType: EntityType;
  id: string;
  summary: string;
}

export function canDeleteRecord(entity: EntityType, id: string, linkedRecords: LinkedRecord[]): { allowed: boolean; reason?: string; blockingLinks: LinkedRecord[] } {
  if (linkedRecords.length === 0) return { allowed: true, blockingLinks: [] };

  // Check for financial approvals
  const approvals = linkedRecords.filter(r => r.entityType === 'invoice' || r.entityType === 'purchase_order');
  const approvedLinks = approvals.filter(r => r.entityType === 'invoice');

  if (approvedLinks.length > 0) {
    return {
      allowed: false,
      reason: `Cannot delete: ${approvedLinks.length} linked invoice(s) exist. Remove or void them first.`,
      blockingLinks: approvedLinks,
    };
  }

  return { allowed: true, blockingLinks: [] };
}

export function canTransitionAfterConflict(current: RecordStatus, target: RecordStatus, linkedRecords: LinkedRecord[]): { allowed: boolean; reason?: string } {
  // Cannot cancel an already-approved record with linked children.
  if (target === 'cancelled' && current === 'approved' && linkedRecords.length > 0) {
    return { allowed: false, reason: `Cannot cancel: ${linkedRecords.length} linked record(s) depend on this.` };
  }
  // Cannot approve a previously rejected record without re-drafting (for work requests).
  if (target === 'approved' && current === 'rejected') {
    return { allowed: false, reason: 'Cannot approve a rejected record. Re-submit first (draft → pending).' };
  }
  return { allowed: true };
}

// ── 7. Procurement Enhancement ────────────────────────────────────────────

export interface EvalScores {
  quality?: number; delivery?: number; price?: number;
  responsiveness?: number; compliance?: number;
}

export function supplierScore(scores: EvalScores): number {
  const vals = [scores.quality, scores.delivery, scores.price, scores.responsiveness, scores.compliance]
    .filter((v): v is number => v !== undefined && v !== null);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

export function evalRating(score: number): string {
  if (score >= 4.5) return 'excellent';
  if (score >= 3.5) return 'good';
  if (score >= 2.5) return 'average';
  if (score >= 1.5) return 'poor';
  return 'critical';
}

// ── 8. HR Enhancement ─────────────────────────────────────────────────────

export function calculateOvertimePay(hourlyRate: number, overtimeHours: number, multiplier: number = 1.5): number {
  return Math.round(hourlyRate * overtimeHours * multiplier * 100) / 100;
}

export interface ContractInfo {
  startDate: Date; endDate?: Date; probationEndDate?: Date;
}

export function evaluateContractExpiry(contract: ContractInfo): { status: string; daysRemaining?: number } {
  if (!contract.endDate) return { status: 'indefinite' };
  const now = new Date();
  const daysRemaining = Math.ceil((contract.endDate.getTime() - now.getTime()) / 86400000);
  if (daysRemaining < 0) return { status: 'expired', daysRemaining };
  if (daysRemaining <= 30) return { status: 'expiring_soon', daysRemaining };
  return { status: 'active', daysRemaining };
}

// ── 9. Finance Enhancement ────────────────────────────────────────────────

export function getTaxAmount(amount: number, taxRatePercent: number): number {
  return Math.round(amount * (taxRatePercent / 100) * 100) / 100;
}

export function getCurrencyConversion(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export interface ExpenseClaimItem {
  amount: number; approvedAmount?: number;
}

export function processExpenseClaim(items: ExpenseClaimItem[]): {
  totalSubmitted: number; totalApproved: number; itemCount: number;
} {
  return {
    totalSubmitted: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
    totalApproved: Math.round(items.reduce((s, i) => s + (i.approvedAmount ?? i.amount), 0) * 100) / 100,
    itemCount: items.length,
  };
}
