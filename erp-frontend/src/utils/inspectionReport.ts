interface InspectionItem {
  description_en: string;
  is_critical: boolean;
  result: string;
  notes: string;
}

interface ReportData {
  inspection_no: string;
  title: string;
  inspection_date: string;
  status: string;
  score_percent: number;
  inspector_name?: string;
  template_name?: string;
  project_name?: string;
  supplier_name?: string;
  material_name?: string;
  items: InspectionItem[];
}

export function generateInspectionReport(data: ReportData) {
  const passCount = data.items.filter(i => i.result === 'pass').length;
  const failCount = data.items.filter(i => i.result === 'fail').length;
  const naCount = data.items.filter(i => i.result === 'na').length;
  const criticalFails = data.items.filter(i => i.is_critical && i.result === 'fail').length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Inspection Report - ${data.inspection_no}</title>
  <style>
    @page { margin: 20mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a1a2e; line-height: 1.5; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a56db; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; color: #1a56db; }
    .header .badge { font-size: 11px; background: #e5e7eb; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .badge.completed { background: #22c55e; color: white; }
    .header .badge.draft { background: #6b7280; color: white; }
    .header .badge.in\\_progress { background: #f59e0b; color: white; }
    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .summary table { width: 100%; border-collapse: collapse; }
    .summary td { padding: 4px 8px; font-size: 13px; }
    .summary td:first-child { font-weight: 600; color: #6b7280; width: 120px; }
    .score-box { text-align: center; padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .score-box .score-value { font-size: 36px; font-weight: 700; }
    .score-box .score-label { font-size: 11px; color: #6b7280; }
    .score-box.pass { border-color: #22c55e; }
    .score-box.pass .score-value { color: #22c55e; }
    .score-box.fail { border-color: #ef4444; }
    .score-box.fail .score-value { color: #ef4444; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table.items th { background: #1a56db; color: white; font-size: 12px; text-transform: uppercase; padding: 8px 10px; text-align: left; letter-spacing: 0.5px; }
    table.items td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    table.items tr.critical { background: #fef2f2; }
    .result-pass { color: #22c55e; font-weight: 600; }
    .result-fail { color: #ef4444; font-weight: 600; }
    .result-na { color: #6b7280; }
    .stats { display: flex; gap: 15px; margin: 15px 0; }
    .stats .stat { flex: 1; text-align: center; padding: 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .stats .stat .num { font-size: 20px; font-weight: 700; }
    .stats .stat .lbl { font-size: 11px; color: #6b7280; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #9ca3af; text-align: center; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
    .signatures .sig { text-align: center; }
    .signatures .sig .line { width: 180px; height: 1px; background: #1a1a2e; margin: 30px auto 5px; }
    .critical-warning { background: #fef2f2; border: 1px solid #ef4444; border-radius: 6px; padding: 10px; margin: 10px 0; font-size: 13px; color: #dc2626; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Inspection Report</h1>
      <p style="color:#6b7280;font-size:13px">${data.inspection_no}</p>
    </div>
    <span class="badge ${data.status}">${data.status}</span>
  </div>

  <div class="summary">
    <table>
      <tr><td>Title</td><td>${data.title}</td></tr>
      <tr><td>Date</td><td>${data.inspection_date}</td></tr>
      ${data.template_name ? `<tr><td>Template</td><td>${data.template_name}</td></tr>` : ''}
      ${data.inspector_name ? `<tr><td>Inspector</td><td>${data.inspector_name}</td></tr>` : ''}
      ${data.project_name ? `<tr><td>Project</td><td>${data.project_name}</td></tr>` : ''}
      ${data.supplier_name ? `<tr><td>Supplier</td><td>${data.supplier_name}</td></tr>` : ''}
    </table>
    <div class="score-box ${data.score_percent >= 80 ? 'pass' : 'fail'}">
      <div class="score-value">${data.score_percent ?? 0}%</div>
      <div class="score-label">Overall Score</div>
    </div>
  </div>

  ${criticalFails > 0 ? `<div class="critical-warning">⚠ ${criticalFails} critical item${criticalFails > 1 ? 's' : ''} failed — immediate action required.</div>` : ''}

  <div class="stats">
    <div class="stat"><div class="num" style="color:#22c55e">${passCount}</div><div class="lbl">Passed</div></div>
    <div class="stat"><div class="num" style="color:#ef4444">${failCount}</div><div class="lbl">Failed</div></div>
    <div class="stat"><div class="num" style="color:#6b7280">${naCount}</div><div class="lbl">N/A</div></div>
    <div class="stat"><div class="num">${data.items.length}</div><div class="lbl">Total Items</div></div>
  </div>

  <table class="items">
    <thead><tr><th>#</th><th>Check Item</th><th>Critical</th><th>Result</th><th>Notes</th></tr></thead>
    <tbody>
      ${data.items.map((item, idx) => `
        <tr class="${item.is_critical && item.result === 'fail' ? 'critical' : ''}">
          <td>${idx + 1}</td>
          <td>${item.description_en}</td>
          <td>${item.is_critical ? '⚠ Yes' : 'No'}</td>
          <td class="result-${item.result || 'na'}">${(item.result || 'na').toUpperCase()}</td>
          <td>${item.notes || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig"><div class="line"></div>Inspector Signature</div>
    <div class="sig"><div class="line"></div>Reviewer Signature</div>
  </div>

  <div class="footer">
    Generated by Alfanar ERP — ${new Date().toISOString().slice(0, 10)}<br>
    This is a computer-generated document.
  </div>
  <script>window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
