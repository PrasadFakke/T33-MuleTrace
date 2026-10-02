import React, { useState, useEffect } from 'react';
import { AlertItem, fetchAlerts } from '../api';
import { Search, Filter, ShieldAlert, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, FileDown } from 'lucide-react';
import { exportAlertsCSV } from '../utils/exportReport';

interface AlertsViewProps {
  onInvestigateAccount: (accountId: string) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ onInvestigateAccount }) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [severity, setSeverity] = useState<string>('ALL');
  const [pattern, setPattern] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('risk_score');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetchAlerts({
        page,
        page_size: 20,
        severity,
        pattern,
        status,
        search,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setAlerts(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [page, severity, pattern, status, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAlerts();
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>AML Alert Triage Registry</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
              {total.toLocaleString()} Suspicious Incidents
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time alert queue filtered across the four MuleTrace detection engines
          </p>
        </div>
        <div className="flex items-center gap-2.5 text-xs">
          <button
            onClick={() => alerts.length > 0 && exportAlertsCSV(alerts)}
            className="flex items-center gap-1.5 px-3 py-1.5 font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-all shadow-2xs hover:shadow-xs"
            title="Download active alerts registry as CSV"
          >
            <FileDown className="w-3.5 h-3.5 text-rose-600" />
            <span>Export Alerts (CSV)</span>
          </button>
          <button
            onClick={loadAlerts}
            className="flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Alert ID (e.g. ALT-00001) or Account ID (e.g. ACCT_149010)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-sans"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            Filter
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-600 font-semibold">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filters:</span>
          </div>

          {/* Severity */}
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
            className="bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical (80-100)</option>
            <option value="HIGH">High (60-79)</option>
          </select>

          {/* Pattern */}
          <select
            value={pattern}
            onChange={(e) => { setPattern(e.target.value); setPage(1); }}
            className="bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Patterns</option>
            <option value="Fan-in / Fan-out">Fan-in / Fan-out</option>
            <option value="Pass-through Mule">Pass-through Mule</option>
            <option value="Circular / Reciprocal">Circular / Reciprocal</option>
            <option value="New Account / Cluster">New Account / Cluster</option>
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="CONFIRMED">Confirmed Mule</option>
            <option value="CLEARED">Cleared</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ml-auto"
          >
            <option value="risk_score">Sort by Risk Score</option>
            <option value="amount">Sort by Volume</option>
            <option value="detected_at">Sort by Date</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-blue-600 space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-xs font-mono font-medium">Fetching Alert Records...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No alerts found matching the current search & filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/90 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-2.5 px-3.5">Alert ID</th>
                  <th className="py-2.5 px-3.5">Account ID</th>
                  <th className="py-2.5 px-3.5">Risk Score</th>
                  <th className="py-2.5 px-3.5">Severity</th>
                  <th className="py-2.5 px-3.5">Pattern</th>
                  <th className="py-2.5 px-3.5">Suspicious Volume</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <tr key={alert.alert_id} className="hover:bg-blue-50/40 transition">
                    <td className="py-2.5 px-3.5 text-blue-600 font-bold">{alert.alert_id}</td>
                    <td className="py-2.5 px-3.5 text-slate-900 font-semibold">{alert.account_id}</td>
                    <td className="py-2.5 px-3.5">
                      <span className={`font-bold text-sm ${
                        alert.risk_score >= 80 ? 'text-rose-600' : 'text-amber-600'
                      }`}>
                        {alert.risk_score}
                      </span>
                      <span className="text-slate-400 text-[10px]">/100</span>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        alert.severity === 'CRITICAL' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700">{alert.pattern}</td>
                    <td className="py-2.5 px-3.5 text-slate-800 font-semibold">₹{alert.amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        alert.status === 'NEW' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        alert.status === 'UNDER_REVIEW' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        alert.status === 'CONFIRMED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {alert.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => onInvestigateAccount(alert.account_id)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition shadow-2xs shadow-blue-500/25"
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
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50/80 text-sm text-slate-600">
          <div>
            Showing Page <span className="text-slate-900 font-bold">{page}</span> of <span className="text-slate-900 font-bold">{totalPages}</span> ({total.toLocaleString()} total alerts)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-700 shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-700 shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
