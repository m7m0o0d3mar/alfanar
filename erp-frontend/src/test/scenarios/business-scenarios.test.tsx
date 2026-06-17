import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  validNextStatuses,
  statusLabel,
  canPerform,
  canAllocate,
  validateInvoiceAmount,
  validateDocChain,
  DocType,
  calculateProgressPercent,
  budgetVariance,
  canDeleteRecord,
  canTransitionAfterConflict,
  budgetRemaining,
} from '../utils/business-rules';

// ─────────────────────────────────────────────────────────────────────────────
// 1. MULTI-ENTITY SCENARIOS (company / branch / project)
// ─────────────────────────────────────────────────────────────────────────────
describe('Multi-entity (company / branch / project) scenarios', () => {
  it('tracks budget per project independently', () => {
    const projectA = { booked: 1_000_000, open: 800_000, spent: 200_000 };
    const projectB = { booked: 500_000, open: 400_000, spent: 400_000 };

    expect(budgetRemaining(projectA)).toBe(600_000);
    expect(budgetRemaining(projectB)).toBe(0);
  });

  it('allows allocation when budget is available in one project but not another', () => {
    const projectA = { booked: 1_000_000, open: 800_000, spent: 200_000 };
    const projectB = { booked: 500_000, open: 400_000, spent: 400_000 };

    expect(canAllocate(projectA, 50_000).allowed).toBe(true);
    expect(canAllocate(projectB, 1).allowed).toBe(false);
  });

  it('rejects allocation when open budget exceeds booked budget (data integrity)', () => {
    const invalid = { booked: 100_000, open: 150_000, spent: 0 };
    expect(canAllocate(invalid, 10_000).allowed).toBe(false);
    expect(canAllocate(invalid, 10_000).reason).toContain('exceeds booked');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. MULTI-ROLE SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────
describe('Multi-role access control', () => {
  it('grants admin full access to all actions', () => {
    for (const entity of ['work_request', 'purchase_order', 'invoice'] as const) {
      for (const action of ['create', 'edit', 'delete', 'approve', 'reject'] as const) {
        expect(canPerform('admin', entity, action)).toBe(true);
      }
    }
  });

  it('distinguishes PM approval scope (WR + PO, but not invoice)', () => {
    expect(canPerform('project_manager', 'work_request', 'approve')).toBe(true);
    expect(canPerform('project_manager', 'purchase_order', 'approve')).toBe(true);
    expect(canPerform('project_manager', 'invoice', 'approve')).toBe(false);
  });

  it('prevents PM from deleting records', () => {
    expect(canPerform('project_manager', 'work_request', 'delete')).toBe(false);
    expect(canPerform('project_manager', 'purchase_order', 'delete')).toBe(false);
  });

  it('restricts QC to work_request entity only', () => {
    expect(canPerform('qc', 'work_request', 'create')).toBe(true);
    expect(canPerform('qc', 'work_request', 'approve')).toBe(true);
    expect(canPerform('qc', 'purchase_order', 'create')).toBe(false);
    expect(canPerform('qc', 'invoice', 'create')).toBe(false);
  });

  it('restricts accountant to invoice entity', () => {
    expect(canPerform('accountant', 'invoice', 'create')).toBe(true);
    expect(canPerform('accountant', 'invoice', 'approve')).toBe(true);
    expect(canPerform('accountant', 'work_request', 'create')).toBe(false);
    expect(canPerform('accountant', 'purchase_order', 'create')).toBe(false);
  });

  it('restricts procurement to purchase_order entity', () => {
    expect(canPerform('procurement', 'purchase_order', 'create')).toBe(true);
    expect(canPerform('procurement', 'purchase_order', 'edit')).toBe(true);
    expect(canPerform('procurement', 'invoice', 'create')).toBe(false);
  });

  it('allows client to view only', () => {
    expect(canPerform('client', 'work_request', 'view')).toBe(true);
    expect(canPerform('client', 'purchase_order', 'view')).toBe(true);
    expect(canPerform('client', 'invoice', 'create')).toBe(false);
    expect(canPerform('client', 'work_request', 'edit')).toBe(false);
  });

  it('allows owner to edit their own draft', () => {
    expect(canPerform('engineer', 'work_request', 'edit', true)).toBe(true);
    expect(canPerform('engineer', 'work_request', 'edit', false)).toBe(true);
    // But cannot delete even if owner
    expect(canPerform('engineer', 'work_request', 'delete', true)).toBe(false);
  });

  it('allows all roles to view and export', () => {
    for (const role of ['admin', 'project_manager', 'engineer', 'qc', 'consultant', 'accountant', 'procurement', 'sales', 'client'] as const) {
      expect(canPerform(role, 'work_request', 'view')).toBe(true);
      expect(canPerform(role, 'work_request', 'export')).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECORD LIFECYCLE (draft → approved → closed)
// ─────────────────────────────────────────────────────────────────────────────
describe('Record lifecycle (draft → approved → closed)', () => {
  it('allows valid forward transitions for work requests', () => {
    expect(isValidTransition('work_request', 'draft', 'pending')).toBe(true);
    expect(isValidTransition('work_request', 'pending', 'pending_qc')).toBe(true);
    expect(isValidTransition('work_request', 'pending_qc', 'pending_consultant')).toBe(true);
    expect(isValidTransition('work_request', 'pending_consultant', 'pending_pm')).toBe(true);
    expect(isValidTransition('work_request', 'pending_pm', 'approved')).toBe(true);
    expect(isValidTransition('work_request', 'approved', 'closed')).toBe(true);
  });

  it('allows rejection from any QC/consultant/PM step', () => {
    expect(isValidTransition('work_request', 'pending_qc', 'rejected')).toBe(true);
    expect(isValidTransition('work_request', 'pending_consultant', 'rejected')).toBe(true);
    expect(isValidTransition('work_request', 'pending_pm', 'rejected')).toBe(true);
  });

  it('allows re-submit after rejection', () => {
    expect(isValidTransition('work_request', 'rejected', 'draft')).toBe(true);
  });

  it('blocks invalid transitions', () => {
    expect(isValidTransition('work_request', 'draft', 'approved')).toBe(false);
    expect(isValidTransition('work_request', 'draft', 'closed')).toBe(false);
    expect(isValidTransition('work_request', 'approved', 'draft')).toBe(false);
  });

  it('provides valid next statuses for given current state', () => {
    expect(validNextStatuses('work_request', 'draft')).toEqual(['pending', 'cancelled']);
    expect(validNextStatuses('work_request', 'pending_pm')).toEqual(['approved', 'rejected']);
    expect(validNextStatuses('purchase_order', 'draft')).toEqual(['pending', 'cancelled']);
    expect(validNextStatuses('purchase_order', 'approved')).toEqual(['closed', 'cancelled']);
  });

  it('returns empty list for terminal states', () => {
    expect(validNextStatuses('work_request', 'closed')).toEqual([]);
    expect(validNextStatuses('purchase_order', 'cancelled')).toEqual([]);
  });

  it('generates human-readable status labels', () => {
    expect(statusLabel('draft')).toBe('Draft');
    expect(statusLabel('pending_qc')).toBe('QC Review');
    expect(statusLabel('in_progress')).toBe('In Progress');
    expect(statusLabel('closed')).toBe('Closed');
  });

  it('supports PO lifecycle: draft → pending → approved → closed', () => {
    expect(isValidTransition('purchase_order', 'draft', 'pending')).toBe(true);
    expect(isValidTransition('purchase_order', 'pending', 'approved')).toBe(true);
    expect(isValidTransition('purchase_order', 'approved', 'closed')).toBe(true);
  });

  it('supports invoice lifecycle: draft → pending → approved → paid → closed', () => {
    expect(isValidTransition('invoice', 'draft', 'pending')).toBe(true);
    expect(isValidTransition('invoice', 'pending', 'approved')).toBe(true);
    expect(isValidTransition('invoice', 'approved', 'paid')).toBe(true);
    expect(isValidTransition('invoice', 'paid', 'closed')).toBe(true);
  });

  it('supports task lifecycle: open → in_progress → review → completed → closed', () => {
    expect(isValidTransition('task', 'open', 'in_progress')).toBe(true);
    expect(isValidTransition('task', 'in_progress', 'review')).toBe(true);
    expect(isValidTransition('task', 'review', 'completed')).toBe(true);
    expect(isValidTransition('task', 'completed', 'closed')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PERMISSIONS BY ROLE, PROJECT, AND BRANCH
// ─────────────────────────────────────────────────────────────────────────────
describe('Permissions by role, project, and branch', () => {
  it('restricts engineer from approving anything', () => {
    expect(canPerform('engineer', 'work_request', 'approve')).toBe(false);
    expect(canPerform('engineer', 'purchase_order', 'approve')).toBe(false);
    expect(canPerform('engineer', 'invoice', 'approve')).toBe(false);
  });

  it('allows only specific roles to manage users and roles', () => {
    expect(canPerform('admin', 'purchase_order', 'manage_users')).toBe(true);
    expect(canPerform('admin', 'purchase_order', 'manage_roles')).toBe(true);
    expect(canPerform('project_manager', 'purchase_order', 'manage_users')).toBe(false);
    expect(canPerform('engineer', 'purchase_order', 'manage_roles')).toBe(false);
  });

  it('allows sales role to create invoices and documents only', () => {
    expect(canPerform('sales', 'invoice', 'create')).toBe(true);
    expect(canPerform('sales', 'document', 'create')).toBe(true);
    expect(canPerform('sales', 'purchase_order', 'create')).toBe(false);
    expect(canPerform('sales', 'work_request', 'create')).toBe(false);
  });

  it('allows QC to import data', () => {
    expect(canPerform('qc', 'work_request', 'import')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. FINANCIAL & OPERATIONAL CONSTRAINTS
// ─────────────────────────────────────────────────────────────────────────────
describe('Financial and operational constraints', () => {
  describe('budget validation', () => {
    it('rejects zero or negative allocation', () => {
      const budget = { booked: 100_000, open: 80_000, spent: 0 };
      expect(canAllocate(budget, 0).allowed).toBe(false);
      expect(canAllocate(budget, -100).allowed).toBe(false);
    });

    it('rejects allocation exceeding remaining budget', () => {
      const budget = { booked: 100_000, open: 80_000, spent: 75_000 };
      const result = canAllocate(budget, 10_000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient budget');
    });

    it('allows allocation within remaining budget', () => {
      const budget = { booked: 100_000, open: 80_000, spent: 30_000 };
      expect(canAllocate(budget, 50_000).allowed).toBe(true);
    });
  });

  describe('invoice amount validation', () => {
    it('rejects invoice exceeding PO total', () => {
      const result = validateInvoiceAmount({ invoiceAmount: 150_000, poAmount: 100_000, paidSoFar: 0 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds PO');
    });

    it('rejects invoice exceeding remaining PO balance', () => {
      const result = validateInvoiceAmount({ invoiceAmount: 60_000, poAmount: 100_000, paidSoFar: 50_000 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds remaining');
    });

    it('allows invoice within remaining balance', () => {
      const result = validateInvoiceAmount({ invoiceAmount: 40_000, poAmount: 100_000, paidSoFar: 50_000 });
      expect(result.valid).toBe(true);
    });

    it('rejects zero invoice amount', () => {
      const result = validateInvoiceAmount({ invoiceAmount: 0, poAmount: 100_000, paidSoFar: 0 });
      expect(result.valid).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DOCUMENT LINKAGE (Request → Quote → PO → Receipt → Invoice → Payment)
// ─────────────────────────────────────────────────────────────────────────────
describe('Document linkage chain', () => {
  it('requires no predecessor for initial request', () => {
    const result = validateDocChain(DocType.REQUEST, new Set());
    expect(result.valid).toBe(true);
  });

  it('requires a request before a quote', () => {
    const result = validateDocChain(DocType.QUOTE, new Set([DocType.REQUEST]));
    expect(result.valid).toBe(true);
  });

  it('rejects quote without prior request', () => {
    const result = validateDocChain(DocType.QUOTE, new Set());
    expect(result.valid).toBe(false);
    expect(result.missing).toContain(DocType.REQUEST);
  });

  it('requires quote before PO', () => {
    expect(validateDocChain(DocType.PO, new Set([DocType.REQUEST, DocType.QUOTE])).valid).toBe(true);
    expect(validateDocChain(DocType.PO, new Set([DocType.REQUEST])).valid).toBe(false);
  });

  it('requires PO before receipt', () => {
    expect(validateDocChain(DocType.RECEIPT, new Set([DocType.PO])).valid).toBe(true);
    expect(validateDocChain(DocType.RECEIPT, new Set()).valid).toBe(false);
  });

  it('requires PO before invoice', () => {
    expect(validateDocChain(DocType.INVOICE, new Set([DocType.PO])).valid).toBe(true);
    expect(validateDocChain(DocType.INVOICE, new Set([DocType.REQUEST])).valid).toBe(false);
  });

  it('requires invoice before payment', () => {
    expect(validateDocChain(DocType.PAYMENT, new Set([DocType.INVOICE])).valid).toBe(true);
    expect(validateDocChain(DocType.PAYMENT, new Set([DocType.PO])).valid).toBe(false);
  });

  it('reports all missing predecessors', () => {
    const result = validateDocChain(DocType.PAYMENT, new Set());
    expect(result.missing).toContain(DocType.INVOICE);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PROJECT LINKAGE (Project → Contract → Line Item → Payment → Progress)
// ─────────────────────────────────────────────────────────────────────────────
describe('Project linkage hierarchy', () => {
  it('calculates weighted progress from multiple items', () => {
    const items = [
      { weight: 30, completed: 10, total: 10 },  // 100% done, weight 30
      { weight: 70, completed: 5, total: 20 },    //  25% done, weight 70
    ];
    // Weighted: (30 * 1.0 + 70 * 0.25) / (30 + 70) = (30 + 17.5) / 100 = 47.5 -> 48%
    expect(calculateProgressPercent(items)).toBe(48);
  });

  it('returns 0% when no items exist', () => {
    expect(calculateProgressPercent([])).toBe(0);
  });

  it('returns 0% when total weight is zero', () => {
    const items = [{ weight: 0, completed: 5, total: 10 }];
    expect(calculateProgressPercent(items)).toBe(0);
  });

  it('returns 100% when all items are complete', () => {
    const items = [
      { weight: 50, completed: 10, total: 10 },
      { weight: 50, completed: 20, total: 20 },
    ];
    expect(calculateProgressPercent(items)).toBe(100);
  });

  it('caps at 100% even if over-completed', () => {
    const items = [{ weight: 100, completed: 15, total: 10 }];
    expect(calculateProgressPercent(items)).toBe(100);
  });

  it('calculates budget variance correctly', () => {
    const underBudget = { bookedBudget: 1_000_000, openBudget: 800_000, contingency: 200_000, actualSpent: 600_000 };
    expect(budgetVariance(underBudget).variance).toBe(400_000);
    expect(budgetVariance(underBudget).status).toBe('under_budget');

    const overBudget = { bookedBudget: 1_000_000, openBudget: 800_000, contingency: 200_000, actualSpent: 1_200_000 };
    expect(budgetVariance(overBudget).variance).toBe(-200_000);
    expect(budgetVariance(overBudget).status).toBe('over_budget');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. REPORT AGGREGATIONS & DERIVED NUMBERS
// ─────────────────────────────────────────────────────────────────────────────
describe('Report aggregations and derived numbers', () => {
  it('sums activity weights correctly', () => {
    const items = [
      { weight: 30, completed: 3, total: 10 },
      { weight: 20, completed: 8, total: 10 },
      { weight: 50, completed: 0, total: 10 },
    ];
    const totalWeight = items.reduce((s, i) => s + i.weight, 0);
    expect(totalWeight).toBe(100);
  });

  it('calculates combined progress from multiple sub-items', () => {
    // Two sub-items each with weight 50 in a division
    const items = [
      { weight: 50, completed: 10, total: 10 },  // 100%
      { weight: 50, completed: 2, total: 10 },    //  20%
    ];
    const pct = calculateProgressPercent(items);
    // (50 * 1.0 + 50 * 0.2) / 100 = 60/100 = 60%
    expect(pct).toBe(60);
  });

  it('derives contingency as booked - open budget', () => {
    const booked = 1_000_000;
    const open = 850_000;
    const contingency = booked - open;
    expect(contingency).toBe(150_000);
  });

  it('tracks approval counts across status categories', () => {
    const wrs = [
      { status: 'approved' }, { status: 'approved' }, { status: 'approved' },
      { status: 'pending_qc' }, { status: 'pending_pm' },
      { status: 'rejected' },
    ];
    const approved = wrs.filter(w => w.status === 'approved').length;
    const pending = wrs.filter(w => ['pending_qc', 'pending_consultant', 'pending_pm'].includes(w.status)).length;
    const rejected = wrs.filter(w => w.status === 'rejected').length;

    expect(approved).toBe(3);
    expect(pending).toBe(2);
    expect(rejected).toBe(1);
    expect(approved + pending + rejected).toBe(wrs.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. CONFLICT TESTING
// ─────────────────────────────────────────────────────────────────────────────
describe('Conflict testing', () => {
  describe('delete protection with linked data', () => {
    it('allows deletion of record with no links', () => {
      const result = canDeleteRecord('work_request', 'wr-1', []);
      expect(result.allowed).toBe(true);
    });

    it('blocks deletion when linked invoices exist', () => {
      const links = [
        { entityType: 'invoice' as const, id: 'inv-1', summary: 'INV-001' },
      ];
      const result = canDeleteRecord('purchase_order', 'po-1', links);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('invoice');
    });

    it('provides count of blocking invoice links', () => {
      const links = [
        { entityType: 'invoice' as const, id: 'inv-1', summary: 'INV-001' },
        { entityType: 'invoice' as const, id: 'inv-2', summary: 'INV-002' },
      ];
      const result = canDeleteRecord('purchase_order', 'po-1', links);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('2 linked invoice');
    });

    it('returns blocking links for UI display', () => {
      const links = [
        { entityType: 'invoice' as const, id: 'inv-1', summary: 'INV-001' },
      ];
      const result = canDeleteRecord('purchase_order', 'po-1', links);
      expect(result.blockingLinks).toHaveLength(1);
      expect(result.blockingLinks[0].id).toBe('inv-1');
    });
  });

  describe('state transition conflicts', () => {
    it('blocks cancelling an approved record with children', () => {
      const links = [{ entityType: 'invoice' as const, id: 'inv-1', summary: 'INV-001' }];
      const result = canTransitionAfterConflict('approved', 'cancelled', links);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('depend');
    });

    it('allows cancelling an approved record without children', () => {
      expect(canTransitionAfterConflict('approved', 'cancelled', []).allowed).toBe(true);
    });

    it('blocks approving a rejected record (must re-submit first)', () => {
      const result = canTransitionAfterConflict('rejected', 'approved', []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Re-submit');
    });

    it('allows re-drafting from rejected', () => {
      expect(isValidTransition('work_request', 'rejected', 'draft')).toBe(true);
    });

    it('blocks re-approving a closed record', () => {
      expect(isValidTransition('work_request', 'closed', 'approved')).toBe(false);
      expect(isValidTransition('purchase_order', 'closed', 'approved')).toBe(false);
      expect(isValidTransition('invoice', 'closed', 'approved')).toBe(false);
    });
  });
});
