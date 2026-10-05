import React, { useEffect, useState } from 'react';
import { DashboardSummary, fetchDashboardSummary } from '../api';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckSquare, 
  Activity, 
  Users, 
  Layers, 
  ArrowUpRight, 
  ArrowRight,
  TrendingUp,
  RefreshCw,
  FileDown,
  AlertOctagon
} from 'lucide-react';
import { exportDashboardPDF } from '../utils/exportReport';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface DashboardViewProps {
  onNavigateToInvestigation: (accountId: string) => void;
  onNavigateToAlerts: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToInvestigation,
  onNavigateToAlerts
}) => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDashboardSummary();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96 space-x-3 text-blue-600">
        <RefreshCw className="w-7 h-7 animate-spin" />
        <span className="text-base font-semibold text-slate-700">Loading Real-Time AML Intelligence...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-3 shadow-sm max-w-xl">
        <div className="flex items-center space-x-3">
          <ShieldAlert className="w-6 h-6 text-rose-600" />
          <h2 className="text-base font-bold">API Synchronization Failure</h2>
        </div>
        <p className="text-sm font-medium">{error || 'Unknown error occurred while querying dashboard telemetry.'}</p>
        <p className="text-xs text-slate-600">
          Tip: On the free cloud tier (Render), the backend spins down after 15 minutes of inactivity and takes ~30–50 seconds to wake up.
        </p>
        <button
          onClick={loadData}
          className="mt-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const kpis = data.kpis;
  const recentTimeline = data.timeline.slice(-24); // Last 24 months for chart

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Fraud Operations Intelligence</span>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              PRODUCTION TELEMETRY
            </span>
          </h1>
          <p className="text-[13px] text-slate-500 mt-1 font-medium">
            Analyzing 7.4M retail transactions across 40,038 bank accounts (July 2020 – July 2025)
          </p>
        </div>
        <div className="flex items-center gap-2.5 text-[13px]">
          <button
            onClick={() => data && exportDashboardPDF(data)}
            className="flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-2xs hover:shadow-xs"
            title="Download executive AML forensic intelligence report as PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Report (PDF)</span>
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
          <button
            onClick={onNavigateToAlerts}
            className="flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all"
          >
            <span>Review Open Alerts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row - White Cards with Colored Ambient Elevations */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Accounts */}
        <div className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-sm mb-1.5">
            <span className="font-semibold">Total Accounts</span>
            <Users className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">{kpis.total_accounts.toLocaleString()}</div>
          <div className="text-[13px] text-slate-500 mt-1 font-medium">100% verified KYC records</div>
        </div>

        {/* Transactions Analyzed */}
        <div className="bg-white border border-slate-200/90 hover:border-sky-300 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-sm mb-1.5">
            <span className="font-semibold">Txns Analyzed</span>
            <Activity className="w-4 h-4 text-sky-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-sky-600 tracking-tight">{(kpis.transactions_analyzed / 1e6).toFixed(2)}M</div>
          <div className="text-[13px] text-sky-700 mt-1 font-medium">7,424,845 records</div>
        </div>

        {/* Suspicious Accounts */}
        <div className="bg-white border border-slate-200/90 hover:border-amber-300 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-sm mb-1.5">
            <span className="font-semibold">Suspicious Accts</span>
            <AlertTriangle className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-amber-600 tracking-tight">{kpis.suspicious_accounts.toLocaleString()}</div>
          <div className="text-[13px] text-amber-700 mt-1 font-medium">Risk score ≥ {kpis.risk_high_threshold ?? 60}</div>
        </div>

        {/* Open Alerts */}
        <div className="bg-white border border-slate-200/90 hover:border-rose-300 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-sm mb-1.5">
            <span className="font-semibold">Open Alerts</span>
            <ShieldAlert className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-rose-600 tracking-tight">{kpis.open_alerts.toLocaleString()}</div>
          <div className="text-[13px] text-rose-700 mt-1 font-medium">Actionable triage queue</div>
        </div>

        {/* Critical Risk */}
        <div className="bg-white border border-rose-200 hover:border-rose-400 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-sm mb-1.5">
            <span className="font-semibold text-rose-700">Critical Severity</span>
            <AlertOctagon className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-rose-600 tracking-tight">{kpis.critical_risk_accounts.toLocaleString()}</div>
          <div className="text-[13px] text-slate-500 mt-1 font-medium">Score {kpis.risk_critical_threshold ?? 80}–100</div>
        </div>

        {/* Confirmed */}
        <div className="bg-white border border-slate-200/90 hover:border-emerald-300 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-sm mb-1.5">
            <span className="font-semibold text-emerald-800">Confirmed Mules</span>
            <CheckSquare className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl lg:text-2xl font-bold text-emerald-600 tracking-tight">{kpis.confirmed_investigations}</div>
          <div className="text-[13px] text-emerald-700 mt-1 font-medium">Investigated & confirmed</div>
        </div>
      </div>

      {/* Main Grid: Chart & Pattern Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Transaction Volume & Flow Trends */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Monthly Transaction Volume & Flow (24-Month Telemetry)</span>
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">Aggregate Credit vs Debit inflow/outflow across all accounts</p>
            </div>
            <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              INR (₹) Millions
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentTimeline}>
                <defs>
                  <linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="debGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={9} 
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1e6).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    borderColor: '#cbd5e1', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', 
                    color: '#0f172a',
                    fontSize: '12px' 
                  }}
                  formatter={(val: any) => [`₹${(Number(val) / 1e6).toFixed(2)}M`, 'Volume']}
                />
                <Area type="monotone" dataKey="credit_volume" name="Credit Inflow" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#credGrad)" />
                <Area type="monotone" dataKey="debit_volume" name="Debit Outflow" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#debGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Fraud Pattern Breakdown */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-1.5 mb-0.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>MuleTrace Detection Breakdown</span>
            </h3>
            <p className="text-[13px] text-slate-500 mb-4">Accounts triggered across the four core engines</p>

            <div className="space-y-3">
              {Object.entries(data.pattern_breakdown).map(([pat, count]) => {
                const normalizedPattern = pat.toLowerCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ');
                const colors: Record<string, { bar: string; text: string; bg: string }> = {
                  'fan-in / fan-out': { bar: 'bg-blue-600', text: 'text-blue-700', bg: 'bg-blue-50/70 border-blue-100' },
                  'pass-through mule': { bar: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50/70 border-rose-100' },
                  'circular / reciprocal': { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50/70 border-amber-100' },
                  'new account / cluster': { bar: 'bg-indigo-600', text: 'text-indigo-700', bg: 'bg-indigo-50/70 border-indigo-100' },
                  'new account / ring': { bar: 'bg-indigo-600', text: 'text-indigo-700', bg: 'bg-indigo-50/70 border-indigo-100' },
                  'new account / shared identifiers': { bar: 'bg-indigo-600', text: 'text-indigo-700', bg: 'bg-indigo-50/70 border-indigo-100' },
                };
                const normalizedColors = Object.fromEntries(
                  Object.entries(colors).map(([key, value]) => [key, value])
                );
                const clr = normalizedColors[normalizedPattern] || {
                  bar: 'bg-slate-500',
                  text: 'text-slate-700',
                  bg: 'bg-slate-50 border-slate-100'
                };
                const pct = count > 0 ? Math.max(1, Math.min(100, (count / 40038) * 100)) : 0;

                return (
                  <div key={pat} className={`p-3 rounded-lg border ${clr.bg} transition-all`}>
                    <div className="flex justify-between items-center text-sm mb-1.5">
                      <span className="text-slate-800 font-semibold">{pat}</span>
                      <span className={`font-bold ${clr.text}`}>{count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${clr.bar} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Lower Row: Recent Alerts Table & Top Suspicious Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Alerts */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Recent High-Priority Alerts</span>
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">Automated triage queue based on explainable risk score</p>
            </div>
            <button
              onClick={onNavigateToAlerts}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold transition"
            >
              <span>View All ({kpis.open_alerts})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="text-[13px] text-slate-500 uppercase bg-slate-50/90 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-2.5 px-3.5">Alert ID</th>
                  <th className="py-2.5 px-3.5">Account</th>
                  <th className="py-2.5 px-3.5">Risk</th>
                  <th className="py-2.5 px-3.5">Pattern</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_alerts.map((alt) => (
                  <tr key={alt.alert_id} className="hover:bg-blue-50/40 transition">
                    <td className="py-2.5 px-3.5 text-blue-600 font-bold">{alt.alert_id}</td>
                    <td className="py-2.5 px-3.5 text-slate-900 font-semibold">{alt.account_id}</td>
                    <td className="py-2.5 px-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[13px] font-bold ${
                        alt.risk_score >= 80 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {alt.risk_score} - {alt.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700">{alt.pattern}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => onNavigateToInvestigation(alt.account_id)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition text-[13px] font-semibold inline-flex items-center gap-1 shadow-2xs hover:shadow-xs"
                      >
                        <span>Investigate</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Suspicious Accounts */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Top Critical Suspicious Accounts</span>
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">Ranked by composite score & total transaction turnover</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="text-[13px] text-slate-500 uppercase bg-slate-50/90 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-2.5 px-3.5">Account ID</th>
                  <th className="py-2.5 px-3.5">Score</th>
                  <th className="py-2.5 px-3.5">Pass-Through</th>
                  <th className="py-2.5 px-3.5">Txns</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.top_suspicious_accounts.map((acct) => (
                  <tr key={acct.account_id} className="hover:bg-blue-50/40 transition">
                    <td className="py-2.5 px-3.5 text-slate-900 font-bold">{acct.account_id}</td>
                    <td className="py-2.5 px-3.5">
                      <span className="text-rose-600 font-bold text-sm">{acct.risk_score}</span>
                      <span className="text-xs text-slate-500">/100</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-amber-700 font-bold">
                      {(acct.pass_through_ratio * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 font-medium">{acct.total_tx_count.toLocaleString()}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => onNavigateToInvestigation(acct.account_id)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition text-[13px] font-semibold inline-flex items-center gap-1 shadow-2xs shadow-blue-500/25"
                      >
                        <span>Investigate</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
