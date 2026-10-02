import React, { useState, useEffect } from 'react';
import { AccountSummaryItem, fetchAccounts } from '../api';
import { Search, Filter, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Users } from 'lucide-react';

interface AccountsViewProps {
  onInvestigateAccount: (accountId: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ onInvestigateAccount }) => {
  const [accounts, setAccounts] = useState<AccountSummaryItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [riskLevel, setRiskLevel] = useState<string>('ALL');
  const [pattern, setPattern] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('risk_score');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetchAccounts({
        page,
        page_size: 20,
        risk_level: riskLevel,
        pattern,
        status,
        search,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setAccounts(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [page, riskLevel, pattern, status, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAccounts();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Accounts Registry & Risk Directory</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              {total.toLocaleString()} Accounts
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Complete database of 40,038 bank accounts scored against financial crime behavioral rules
          </p>
        </div>
        <button
          onClick={loadAccounts}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Account ID (e.g. ACCT_000001) or Customer ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-sans"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1 text-slate-600 font-semibold">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter by:</span>
          </div>

          <select
            value={riskLevel}
            onChange={(e) => { setRiskLevel(e.target.value); setPage(1); }}
            className="bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical (80-100)</option>
            <option value="HIGH">High (60-79)</option>
            <option value="MEDIUM">Medium (30-59)</option>
            <option value="LOW">Low (0-29)</option>
          </select>

          <select
            value={pattern}
            onChange={(e) => { setPattern(e.target.value); setPage(1); }}
            className="bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Detection Patterns</option>
            <option value="Fan-in / Fan-out">Fan-in / Fan-out</option>
            <option value="Pass-through Mule">Pass-through Mule</option>
            <option value="Circular / Reciprocal">Circular / Reciprocal</option>
            <option value="New Account / Cluster">New Account / Cluster</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ml-auto"
          >
            <option value="risk_score">Sort by Risk Score</option>
            <option value="credit_volume">Sort by Credit Volume</option>
            <option value="debit_volume">Sort by Debit Volume</option>
            <option value="total_tx_count">Sort by Txn Count</option>
            <option value="pass_through_ratio">Sort by Pass-Through Ratio</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-blue-600 space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-xs font-semibold">Loading Accounts...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/90 border-b border-slate-200 font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3.5">Account ID</th>
                  <th className="py-2.5 px-3.5">Customer ID</th>
                  <th className="py-2.5 px-3.5">Risk Score</th>
                  <th className="py-2.5 px-3.5">Primary Pattern</th>
                  <th className="py-2.5 px-3.5">Credit Vol (₹)</th>
                  <th className="py-2.5 px-3.5">Debit Vol (₹)</th>
                  <th className="py-2.5 px-3.5">Pass-Through</th>
                  <th className="py-2.5 px-3.5">Txns</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map(acct => (
                  <tr key={acct.account_id} className="hover:bg-blue-50/40 transition">
                    <td className="py-2.5 px-3.5 text-blue-600 font-bold">{acct.account_id}</td>
                    <td className="py-2.5 px-3.5 text-slate-600">{acct.customer_id || 'N/A'}</td>
                    <td className="py-2.5 px-3.5">
                      <span className={`font-bold text-sm ${
                        acct.risk_score >= 80 ? 'text-rose-600' :
                        acct.risk_score >= 60 ? 'text-amber-600' :
                        acct.risk_score >= 30 ? 'text-blue-600' : 'text-emerald-600'
                      }`}>
                        {acct.risk_score}
                      </span>
                      <span className="text-slate-400 text-[10px] ml-1">({acct.risk_level})</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 font-medium">{acct.primary_pattern}</td>
                    <td className="py-2.5 px-3.5 text-emerald-600 font-semibold">₹{acct.credit_volume?.toLocaleString() || 0}</td>
                    <td className="py-2.5 px-3.5 text-rose-600 font-semibold">₹{acct.debit_volume?.toLocaleString() || 0}</td>
                    <td className="py-2.5 px-3.5 text-amber-700 font-semibold">{(acct.pass_through_ratio * 100).toFixed(0)}%</td>
                    <td className="py-2.5 px-3.5 text-slate-700 font-medium">{acct.total_tx_count.toLocaleString()}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => onInvestigateAccount(acct.account_id)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs hover:shadow-xs"
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
        <div className="flex items-center justify-between p-3 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-600">
          <div>
            Showing Page <span className="text-slate-900 font-bold">{page}</span> of <span className="text-slate-900 font-bold">{totalPages}</span> ({total.toLocaleString()} total accounts)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 text-slate-700 shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 text-slate-700 shadow-2xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
