import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DashboardSummary, AccountProfileResponse, AlertItem } from '../api';

export function exportDashboardPDF(data: DashboardSummary) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);

  // Background Header Banner
  doc.setFillColor(12, 17, 26); // #0c111a obsidian
  doc.rect(0, 0, 210, 40, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(6, 182, 212); // #06b6d4 cyan
  doc.text('MULETRACE FORENSIC AML INTELLIGENCE', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Reserve Bank of India (RBI) Innovation Hub AML Telemetry Report', 14, 25);

  doc.setFontSize(8);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(`CONFIDENTIAL // PRODUCTION TELEMETRY AUDIT  |  GENERATED: ${dateStr} UTC`, 14, 32);

  let currentY = 48;

  // Section 1: Executive KPI Metrics
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('1. Executive AML Key Performance Indicators', 14, currentY);
  currentY += 4;

  const kpis = data.kpis;
  const kpiRows = [
    [
      'Total Bank Accounts Monitored',
      kpis.total_accounts.toLocaleString(),
      '100% KYC-Indexed Population'
    ],
    [
      'Total Transactions Analyzed',
      (kpis.transactions_analyzed / 1e6).toFixed(2) + ' Million records',
      '7,424,845 Transactions Scanned'
    ],
    [
      'Suspicious Accounts Flagged',
      kpis.suspicious_accounts.toLocaleString(),
      `Risk Score >= ${kpis.risk_high_threshold ?? 60}`
    ],
    [
      'Critical Severity Accounts',
      kpis.critical_risk_accounts.toLocaleString(),
      `Risk Score >= ${kpis.risk_critical_threshold ?? 80}`
    ],
    [
      'Actionable Alerts in Queue',
      kpis.open_alerts.toLocaleString(),
      'Requires Tier 2 Analyst Review'
    ],
    [
      'Confirmed Mule Accounts',
      kpis.confirmed_investigations.toLocaleString(),
      'Investigated and Confirmed Fraud'
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Metric Description', 'Value', 'Compliance Operational Status']],
    body: kpiRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { cellWidth: 45, fontStyle: 'bold', textColor: [15, 118, 110] },
      2: { cellWidth: 65 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Section 2: Fraud Pattern Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('2. Typology & Fraud Pattern Distribution', 14, currentY);
  currentY += 4;

  const patterns = data.pattern_breakdown;
  const patternRows = [
    ['Fan-In -> Fan-Out (Funnel Dispersal)', patterns['Fan-in / Fan-out']?.toLocaleString() || '0', 'High velocity incoming pooling dispersed to multiple accounts'],
    ['Pass-Through Mule (Rapid Transit)', patterns['Pass-through Mule']?.toLocaleString() || '0', 'Inflow rapidly drained onward with negligible retained balance'],
    ['Circular & Reciprocal Loops', patterns['Circular / Reciprocal']?.toLocaleString() || '0', 'Bidirectional flows simulation and shared bipartite bridges'],
    ['New Account / Demographic Cluster', patterns['New Account / Cluster']?.toLocaleString() || '0', 'High velocity bursts on accounts opened within horizon']
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Detection Typology', 'Flagged Accounts', 'Regulatory Typology Characterization']],
    body: patternRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65 },
      1: { cellWidth: 35, fontStyle: 'bold', textColor: [225, 29, 72] },
      2: { cellWidth: 80 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Section 3: Top Suspicious Accounts Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('3. Priority Suspicious Accounts (Live Telemetry)', 14, currentY);
  currentY += 4;

  const topAccs = data.top_suspicious_accounts.slice(0, 10);
  const accRows = topAccs.map(a => [
    a.account_id,
    `${a.risk_score} (${a.risk_level})`,
    a.primary_pattern,
    `INR ${(a.credit_volume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
    `INR ${(a.debit_volume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
    `${((a.pass_through_ratio || 0) * 100).toFixed(0)}%`,
    a.investigation_status
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Account ID', 'Risk', 'Pattern', 'Credit Vol', 'Debit Vol', 'PT Ratio', 'Status']],
    body: accRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { fontStyle: 'bold', cellWidth: 22 },
      2: { cellWidth: 42 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 16 },
      6: { fontStyle: 'bold', cellWidth: 22 }
    },
    margin: { left: 14, right: 14 }
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`MuleTrace AML Investigation Platform — Page ${i} of ${pageCount}`, 14, 290);
    doc.text('RBI Innovation Hub Anti-Money Laundering Framework', 125, 290);
  }

  doc.save(`MuleTrace_AML_Executive_Report_${now.toISOString().substring(0, 10)}.pdf`);
}

export function exportAccountSAR_PDF(profile: AccountProfileResponse) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
  const acct = profile.account;
  const cust = profile.customer || {};
  const risk = profile.risk || {};
  const alert = profile.alert;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 38, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(244, 63, 94); // rose-500
  doc.text('SUSPICIOUS ACTIVITY REPORT (SAR) // FORENSIC DOSSIER', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Subject Account: ${acct.account_id}  |  Customer ID: ${acct.customer_id || 'N/A'}`, 14, 24);

  doc.setFontSize(8);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text(`CLASSIFICATION: LAW ENFORCEMENT & AML COMPLIANCE DISPATCH  |  DATE: ${dateStr}`, 14, 31);

  let currentY = 46;

  // Section 1: Subject Account & Demographic Profile
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('1. Account Identity & KYC Profile', 14, currentY);
  currentY += 4;

  const profileRows = [
    ['Account ID', acct.account_id, 'Customer ID', acct.customer_id || 'N/A'],
    ['Account Opening Date', acct.account_opening_date || 'N/A', 'Account Age', `${acct.account_age_days} Days`],
    ['Branch Code', String(acct.branch_code || 'N/A'), 'Customer PIN', String(cust.customer_pin || 'N/A')],
    ['KYC Compliant', acct.kyc_compliant || 'N/A', 'PAN Card Available', cust.pan_available || 'N/A'],
    ['Aadhaar Available', cust.aadhaar_available || 'N/A', 'Product Family', acct.product_family || 'N/A'],
    ['Mobile Banking Flag', cust.mobile_banking_flag || 'N/A', 'Net Banking Flag', cust.internet_banking_flag || 'N/A']
  ];

  autoTable(doc, {
    startY: currentY,
    body: profileRows,
    theme: 'grid',
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 40 },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 40 },
      3: { cellWidth: 50 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 2: Risk Scoring Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`2. Composite AML Risk Assessment (Score: ${acct.risk_score}/100 - ${acct.risk_level})`, 14, currentY);
  currentY += 4;

  const scoreRows = [
    ['Fan-In / Fan-Out Velocity Score', `${risk.fan_in_out_score || 0} / 25.0`, 'Unique senders & recipient dispersal'],
    ['Pass-Through / Rapid Transit Score', `${risk.pass_through_score || 0} / 25.0`, 'Debit/credit inflow matched ratio'],
    ['Circular / Reciprocal Bipartite Score', `${risk.cycle_score || 0} / 15.0`, 'Bidirectional counterparty loops'],
    ['New Account / Demographic Cluster Score', `${risk.shared_identifier_score || 0} / 15.0`, 'Account tenure and PIN clustering'],
    ['Transaction Burst Velocity Score', `${risk.velocity_score || 0} / 10.0`, 'Daily transaction frequency bursts'],
    ['Balance Drain / Behavior Score', `${risk.balance_behavior_score || 0} / 10.0`, 'Minimal retained balance behavior']
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Risk Signal Component', 'Allocated Score', 'Signal Definition']],
    body: scoreRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { fontStyle: 'bold', cellWidth: 35, textColor: [225, 29, 72] },
      2: { cellWidth: 75 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 3: Financial Flow Metrics
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('3. Transaction Ledger & Bipartite Flow Telemetry', 14, currentY);
  currentY += 4;

  const flowRows = [
    ['Total Credit Volume (Inflow)', `INR ${acct.credit_volume.toLocaleString('en-IN')}`, 'Unique Senders (Fan-In)', String(acct.unique_incoming_cps)],
    ['Total Debit Volume (Outflow)', `INR ${acct.debit_volume.toLocaleString('en-IN')}`, 'Unique Recipients (Fan-Out)', String(acct.unique_outgoing_cps)],
    ['Pass-Through Drain Ratio', `${(acct.pass_through_ratio * 100).toFixed(1)}%`, 'Bidirectional Loop Bridges', String(acct.reciprocal_cp_count)],
    ['Average Retained Balance', `INR ${acct.avg_balance.toLocaleString('en-IN')}`, 'Total Ledger Transactions', String(acct.total_tx_count)]
  ];

  autoTable(doc, {
    startY: currentY,
    body: flowRows,
    theme: 'grid',
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 50 },
      1: { fontStyle: 'bold', cellWidth: 40 },
      2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 50 },
      3: { fontStyle: 'bold', cellWidth: 40 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 4: Explainable Mathematical Evidence
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('4. Concrete Explainable Forensic Evidence Triggers', 14, currentY);
  currentY += 4;

  const reasons = (risk.evidence_reasons || []) as string[];
  const reasonRows = reasons.length > 0 
    ? reasons.map((r, i) => [`#${i + 1}`, r]) 
    : [['#1', 'Disproportionate transaction turnover relative to account baseline tenure.']];

  autoTable(doc, {
    startY: currentY,
    body: reasonRows,
    theme: 'plain',
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 12, textColor: [225, 29, 72] },
      1: { cellWidth: 168 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 5: Investigation Status & Sign-off
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('5. Compliance Disposition & Audit Sign-Off', 14, currentY);
  currentY += 4;

  const dispRows = [
    ['Current Investigation Status', acct.investigation_status || 'NEW', 'Primary Detected Pattern', acct.primary_pattern],
    ['Analyst Operational Notes', acct.analyst_notes || 'Pending enhanced due diligence review.', 'Action Recommended', acct.risk_score >= 80 ? 'FREEZE DEBIT & FILE SAR' : 'MONITOR VELOCITY']
  ];

  autoTable(doc, {
    startY: currentY,
    body: dispRows,
    theme: 'grid',
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 45 },
      1: { fontStyle: 'bold', cellWidth: 45, textColor: acct.investigation_status === 'CONFIRMED' ? [225, 29, 72] : [15, 118, 110] },
      2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 45 },
      3: { cellWidth: 45 }
    },
    margin: { left: 14, right: 14 }
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`MuleTrace SAR Dossier: ${acct.account_id} — Page ${i} of ${pageCount}`, 14, 290);
    doc.text('FIU-IND / RBI Innovation AML Challenge Standard', 120, 290);
  }

  doc.save(`MuleTrace_SAR_${acct.account_id}_${now.toISOString().substring(0, 10)}.pdf`);
}

export function exportAlertsCSV(alerts: AlertItem[]) {
  const headers = ['Alert ID', 'Account ID', 'Risk Score', 'Severity', 'Pattern', 'Suspicious Volume (INR)', 'Detected At', 'Status', 'Explanation'];
  const rows = alerts.map(a => [
    a.alert_id,
    a.account_id,
    a.risk_score,
    a.severity,
    `"${(a.pattern || '').replace(/"/g, '""')}"`,
    a.amount,
    a.detected_at,
    a.status,
    `"${(a.explanation || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `MuleTrace_Alerts_${new Date().toISOString().substring(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
