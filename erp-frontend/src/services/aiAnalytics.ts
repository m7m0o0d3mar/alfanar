import { supabase } from './supabase';

export interface AnalyticsInsight {
  type: 'spend' | 'trend' | 'anomaly' | 'recommendation' | 'forecast';
  title: string;
  description: string;
  value?: string;
  change?: number;
  severity?: 'positive' | 'negative' | 'neutral';
}

export const aiAnalytics = {
  async getSpendInsights(): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = [];
    try {
      const { data: pos } = await supabase.from('purchase_orders').select('total_amount, grand_total, currency, status, created_at');
      if (!pos || pos.length === 0) return insights;

      const totalSpend = pos.reduce((s, p) => s + (Number(p.grand_total) || Number(p.total_amount) || 0), 0);
      const pendingAmount = pos.filter(p => p.status === 'draft' || p.status === 'pending_approval')
        .reduce((s, p) => s + (Number(p.grand_total) || Number(p.total_amount) || 0), 0);

      insights.push({
        type: 'spend', title: 'Total Procurement Spend',
        description: `Total across ${pos.length} purchase orders`,
        value: `${totalSpend.toLocaleString()} SAR`,
        severity: 'neutral',
      });

      if (pendingAmount > 0) {
        insights.push({
          type: 'anomaly', title: 'Pending Commitments',
          description: `${pendingAmount.toLocaleString()} SAR in unapproved POs`,
          value: `${pendingAmount.toLocaleString()} SAR`,
          change: Math.round((pendingAmount / totalSpend) * 100),
          severity: pendingAmount / totalSpend > 0.3 ? 'negative' : 'neutral',
        });
      }

      const { data: budgets } = await supabase.from('procurement_budgets').select('allocated_amount, spent_amount');
      if (budgets && budgets.length > 0) {
        const totalAllocated = budgets.reduce((s, b) => s + Number(b.allocated_amount), 0);
        const totalSpent = budgets.reduce((s, b) => s + Number(b.spent_amount), 0);
        const pctUsed = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
        insights.push({
          type: 'trend', title: 'Budget Utilization',
          description: `${pctUsed.toFixed(1)}% of procurement budget utilized`,
          value: `${pctUsed.toFixed(0)}%`,
          severity: pctUsed > 85 ? 'negative' : pctUsed > 60 ? 'neutral' : 'positive',
        });
      }

      const { data: evals } = await supabase.from('supplier_evaluations').select('overall_score, rating');
      if (evals && evals.length > 0) {
        const avgScore = evals.reduce((s, e) => s + Number(e.overall_score || 0), 0) / evals.length;
        const poorSuppliers = evals.filter(e => e.rating === 'poor' || e.rating === 'critical').length;
        if (poorSuppliers > 0) {
          insights.push({
            type: 'recommendation', title: 'Supplier Performance Alert',
            description: `${poorSuppliers} supplier(s) rated poor/critical — consider review`,
            severity: 'negative',
          });
        }
        insights.push({
          type: 'trend', title: 'Average Supplier Score',
          description: `Across ${evals.length} evaluations`,
          value: avgScore.toFixed(1) + '/5',
          severity: avgScore >= 4 ? 'positive' : avgScore >= 3 ? 'neutral' : 'negative',
        });
      }
    } catch { console.error('AI analytics spend insights failed'); }
    return insights;
  },

  async getAnomalyDetection(): Promise<AnalyticsInsight[]> {
    const anomalies: AnalyticsInsight[] = [];
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: recentPOs } = await supabase
        .from('purchase_orders')
        .select('po_no, grand_total, total_amount, created_at')
        .gte('created_at', thirtyDaysAgo);

      if (recentPOs && recentPOs.length > 0) {
        const amounts = recentPOs.map(p => Number(p.grand_total) || Number(p.total_amount) || 0);
        const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const threshold = avg * 2;
        const outliers = recentPOs.filter(p => (Number(p.grand_total) || Number(p.total_amount) || 0) > threshold);

        if (outliers.length > 0) {
          anomalies.push({
            type: 'anomaly', title: 'Unusually Large POs Detected',
            description: `${outliers.length} PO(s) exceed 2x the 30-day average of ${avg.toLocaleString()} SAR`,
            severity: 'negative',
          });
        }
      }

      let duplicates: any[] | null = null;
      try {
        const res = await supabase
          .rpc('exec_sql', { query: `SELECT po_no, COUNT(*) as cnt FROM purchase_orders GROUP BY po_no HAVING COUNT(*) > 1` });
        duplicates = res.data;
      } catch { console.error('AI analytics duplicate detection failed (exec_sql may be unavailable)'); }

      if (duplicates && Array.isArray(duplicates) && duplicates.length > 0) {
        anomalies.push({
          type: 'anomaly', title: 'Duplicate PO Numbers',
          description: `${duplicates.length} PO number(s) appear more than once`,
          severity: 'negative',
        });
      }
    } catch { console.error('AI analytics anomaly detection failed'); }
    return anomalies;
  },

  async getFinancialSummary() {
    try {
      const { data: invoices } = await supabase.from('invoices').select('amount, status');
      const totalInvoiced = (invoices || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const paidInvoices = (invoices || []).filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.amount) || 0), 0);
      return { totalInvoiced, paidInvoices, unpaid: totalInvoiced - paidInvoices, invoiceCount: (invoices || []).length };
    } catch { return { totalInvoiced: 0, paidInvoices: 0, unpaid: 0, invoiceCount: 0 }; }
  },
};

export default aiAnalytics;
