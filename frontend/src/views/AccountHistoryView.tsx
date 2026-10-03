import React, { useState, useEffect } from 'react';
import { 
  AccountHistoryResponse, 
  fetchAccountHistory 
} from '../api';
import { exportAccountHistoryPDF } from '../utils/exportReport';
import {
  Search,
  Filter,
  FileDown,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface AccountHistoryViewProps {
  initialAccountId?: string;
  onNavigateToInvestigation?: (accountId: string) => void;
}

const PRESET_ACCOUNTS = [
  'ACCT_149010',
  'ACCT_096766',
  'ACCT_000001',
  'ACCT_000006',
  'ACCT_082915',
  'ACCT_083481',
  'ACCT_127055',
  'ACCT_177174'
];

export const AccountHistoryView: React.FC<AccountHistoryViewProps> = ({
  initialAccountId = 'ACCT_149010',
  onNavigateToInvestigation
}) => {
  // Filter Inputs State
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId);
  const [inputAccountId, setInputAccountId] = useState<string>(initialAccountId);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [txnType, setTxnType] = useState<string>('ALL');

  // Applied Filters State (what is currently active in the view)
  const [appliedFilters, setAppliedFilters] = useState<{
    accountId: string;
    startDate: string;
    endDate: string;
    minAmount: string;
    maxAmount: string;
    txnType: string;
  }>({
    accountId: initialAccountId,
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    txnType: 'ALL'
  });

  // Data & Pagination State
  const [historyData, setHistoryData] = useState<AccountHistoryResponse | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  // Sync if initialAccountId changes from parent
  useEffect(() => {
    if (initialAccountId && initialAccountId !== appliedFilters.accountId) {
      setSelectedAccountId(initialAccountId);
      setInputAccountId(initialAccountId);
      setAppliedFilters(prev => ({ ...prev, accountId: initialAccountId }));
      setPage(1);
    }
  }, [initialAccountId]);

  // Load account history whenever applied filters or pagination changes
  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const minVal = appliedFilters.minAmount ? parseFloat(appliedFilters.minAmount) : undefined;
      const maxVal = appliedFilters.maxAmount ? parseFloat(appliedFilters.maxAmount) : undefined;

      const data = await fetchAccountHistory(appliedFilters.accountId, {
        start_date: appliedFilters.startDate || undefined,
        end_date: appliedFilters.endDate || undefined,
        min_amount: minVal,
        max_amount: maxVal,
        txn_type: appliedFilters.txnType !== 'ALL' ? appliedFilters.txnType : undefined,
        page,
        page_size: pageSize,
        sort_order: sortOrder
      });

      setHistoryData(data);
    } catch (err: any) {
      console.error('Error fetching account history:', err);
      setError(err.message || 'Failed to load transaction history for this account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [appliedFilters, page, sortOrder]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanAcct = (inputAccountId.trim() || selectedAccountId).toUpperCase();
    if (!cleanAcct) {
      alert('Please enter or select a valid Account ID.');
      return;
    }

    setPage(1);
    setSelectedAccountId(cleanAcct);
    setAppliedFilters({
      accountId: cleanAcct,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      txnType
    });
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setTxnType('ALL');
    setPage(1);
    setAppliedFilters(prev => ({
      accountId: prev.accountId,
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      txnType: 'ALL'
    }));
  };

  const handleQuickAccountSelect = (acctId: string) => {
    setInputAccountId(acctId);
    setSelectedAccountId(acctId);
    setPage(1);
    setAppliedFilters(prev => ({
      ...prev,
      accountId: acctId
    }));
  };

  // Export full filtered dataset as PDF (retrieves ALL records matching the filter)
  const handleExportPDF = async () => {
    if (!historyData || !historyData.summary) {
      alert('No account transaction data available to export.');
      return;
    }

    try {
      setIsExportingPDF(true);

      const minVal = appliedFilters.minAmount ? parseFloat(appliedFilters.minAmount) : undefined;
      const maxVal = appliedFilters.maxAmount ? parseFloat(appliedFilters.maxAmount) : undefined;

      // Fetch all matching records for the current filter criteria
      const fullExportData = await fetchAccountHistory(appliedFilters.accountId, {
        start_date: appliedFilters.startDate || undefined,
        end_date: appliedFilters.endDate || undefined,
        min_amount: minVal,
        max_amount: maxVal,
        txn_type: appliedFilters.txnType !== 'ALL' ? appliedFilters.txnType : undefined,
        all_records: true,
        sort_order: sortOrder
      });

      exportAccountHistoryPDF({
        summary: fullExportData.summary,
        transactions: fullExportData.items,
        filterCriteria: {
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
          minAmount: minVal,
          maxAmount: maxVal
        }
      });
    } catch (err: any) {
      console.error('Error generating PDF report:', err);
      alert('Failed to generate PDF report: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingPDF(false);
    }
  };

  const summary = historyData?.summary;
  const chartData = historyData?.chart_data || [];
  const transactions = historyData?.items || [];
  const totalItems = historyData?.total || 0;
  const totalPages = historyData?.total_pages || 1;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Account Transaction History</span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                Ledger Audit
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Forensic transaction ledger, date-wise volume visualization, and verifiable AML reporting for subject accounts
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {onNavigateToInvestigation && (
            <button
              onClick={() => onNavigateToInvestigation(appliedFilters.accountId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-all"
              title="Open Full Forensic Investigation Dossier"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Full Investigation</span>
            </button>
          )}

          <button
            onClick={handleExportPDF}
            disabled={loading || isExportingPDF || totalItems === 0}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm hover:shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all cursor-pointer"
            title="Download Comprehensive Financial Audit PDF"
          >
            <FileDown className="w-4 h-4 text-white" />
            <span>{isExportingPDF ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Criteria Selection Panel */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Search & Criteria Filters</span>
          </div>

          {/* Quick Account Selector Pills */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">Quick Pick:</span>
            {PRESET_ACCOUNTS.slice(0, 4).map(acct => (
              <button
                key={acct}
                onClick={() => handleQuickAccountSelect(acct)}
                className={`px-2 py-0.5 rounded border transition-all ${
                  appliedFilters.accountId === acct
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {acct}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleApplyFilters} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Account Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Account ID <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. ACCT_149010"
                  value={inputAccountId}
                  onChange={(e) => setInputAccountId(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono"
                  required
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                End Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Min Amount */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Min Amount (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 1000"
                value={minAmount}
                min="0"
                step="any"
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono"
              />
            </div>

            {/* Max Amount */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Max Amount (₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={maxAmount}
                min="0"
                step="any"
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono"
              />
            </div>
          </div>

          {/* Filter Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Transaction Type Filter Radio / Select */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] font-semibold text-slate-500">Flow Type:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTxnType('ALL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    txnType === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Transactions
                </button>
                <button
                  type="button"
                  onClick={() => setTxnType('C')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    txnType === 'C'
                      ? 'bg-emerald-50 text-emerald-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  Inflow Only
                </button>
                <button
                  type="button"
                  onClick={() => setTxnType('D')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    txnType === 'D'
                      ? 'bg-rose-50 text-rose-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  Outflow Only
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Filters</span>
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-white" />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold">Error loading history:</span> {error}
          </div>
        </div>
      )}

      {/* Account Summary Section (Phase 4) */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Account Identity */}
          <div className="col-span-2 bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Account Subject
            </div>
            <div className="text-base font-bold text-slate-900 mt-1 font-mono flex items-center gap-2">
              <span>{summary.account_id}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {summary.account_status}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {summary.account_holder_name} {summary.kyc_compliant === 'Y' ? '• KYC Verified' : ''}
            </div>
          </div>

          {/* Total Inflow */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Total Inflow</span>
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-sm lg:text-base font-bold text-emerald-600 mt-1">
              ₹{summary.total_inflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Cumulative credits</div>
          </div>

          {/* Total Outflow */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Total Outflow</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-sm lg:text-base font-bold text-rose-600 mt-1">
              ₹{summary.total_outflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Cumulative debits</div>
          </div>

          {/* Net Balance Change */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Net Change</span>
              {summary.net_balance_change >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              )}
            </div>
            <div className={`text-sm lg:text-base font-bold mt-1 ${
              summary.net_balance_change >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {summary.net_balance_change >= 0 ? '+' : ''}₹{summary.net_balance_change.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Net flow delta</div>
          </div>

          {/* Total Transactions */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Transactions</span>
              <Activity className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-sm lg:text-base font-bold text-slate-900 mt-1 font-mono">
              {summary.total_transactions.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Filtered count</div>
          </div>

          {/* Opening & Closing Balance */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Opening / Closing</span>
              <Wallet className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">
              ₹{summary.opening_balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Closing: ₹{summary.closing_balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Flow Visualization (Phase 5) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Date-Wise Transaction Flow Dynamics</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Daily liquidity volume distribution showing credits (inflow) vs debits (outflow) for {appliedFilters.accountId}
            </p>
          </div>

          {/* Legend Badges */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
              <span className="text-slate-600 font-medium text-[11px]">Inflow (Credit)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span>
              <span className="text-slate-600 font-medium text-[11px]">Outflow (Debit)</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Rendering ledger flow dynamics...</span>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.slice(-30)} // Show up to the last 30 active trading dates for clean presentation
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val: string) => val.substring(5)} // MM-DD
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val: number) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-800">
                          <div className="font-bold text-slate-300 pb-1 border-b border-slate-700">
                            Date: {label}
                          </div>
                          <div className="text-emerald-400 flex items-center justify-between gap-4">
                            <span>Inflow:</span>
                            <span className="font-mono font-bold">+₹{Number(data.inflow).toLocaleString()}</span>
                          </div>
                          <div className="text-rose-400 flex items-center justify-between gap-4">
                            <span>Outflow:</span>
                            <span className="font-mono font-bold">-₹{Number(data.outflow).toLocaleString()}</span>
                          </div>
                          <div className="text-slate-300 flex items-center justify-between gap-4 pt-1 border-t border-slate-700 text-[11px]">
                            <span>Transactions:</span>
                            <span className="font-mono font-bold">{data.count} txns</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="inflow" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={22} name="Inflow (₹)" />
                <Bar dataKey="outflow" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={22} name="Outflow (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 flex items-center justify-center text-slate-400 text-xs bg-slate-50 rounded-lg">
            No chart data available for the selected filters.
          </div>
        )}
      </div>

      {/* Complete Transaction History Table (Phase 6) */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        {/* Table Top Header */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Verified Transaction Ledger
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
              {totalItems.toLocaleString()} Matching Records
            </span>
          </div>

          {/* Table Sort Order Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 text-[11px]">Sort By Date:</span>
            <button
              onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold text-[11px] transition-all"
            >
              {sortOrder === 'desc' ? 'Newest First (Desc)' : 'Oldest First (Asc)'}
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-600 uppercase bg-slate-50/90 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 font-bold">Date & Time</th>
                <th className="py-3 px-3.5 font-bold">Transaction ID</th>
                <th className="py-3 px-3.5 font-bold">Type</th>
                <th className="py-3 px-3.5 font-bold">Amount (₹)</th>
                <th className="py-3 px-3.5 font-bold">Counterparty</th>
                <th className="py-3 px-3.5 font-bold">Payment Mode</th>
                <th className="py-3 px-3.5 font-bold">Balance After</th>
                <th className="py-3 px-3.5 font-bold">Status</th>
                <th className="py-3 px-3.5 font-bold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Retrieving verified transaction ledger entries...</span>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="w-6 h-6 text-slate-300" />
                      <span className="font-semibold text-slate-700">No matching transactions found</span>
                      <span className="text-[11px] text-slate-400">
                        Try adjusting your start date, end date, or amount range filters.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isCredit = t.txn_type === 'C';
                  return (
                    <tr key={t.transaction_id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                        {t.transaction_timestamp.replace('T', ' ')}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {t.transaction_id}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCredit 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isCredit ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                              <span>INFLOW</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-rose-600" />
                              <span>OUTFLOW</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className={`py-3 px-3.5 font-mono font-bold whitespace-nowrap ${
                        isCredit ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isCredit ? '+' : '-'}₹{Math.abs(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-800 font-semibold whitespace-nowrap">
                        {t.counterparty_id}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {t.payment_mode}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 whitespace-nowrap">
                        {t.balance_after !== undefined 
                          ? `₹${t.balance_after.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                          : 'N/A'}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                          <span>{t.status || 'COMPLETED'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 text-[11px] max-w-xs truncate" title={t.remarks}>
                        {t.remarks || `Channel ${t.channel}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{(page - 1) * pageSize + (totalItems > 0 ? 1 : 0)}</span> -{' '}
            <span className="font-semibold text-slate-900">{Math.min(totalItems, page * pageSize)}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalItems.toLocaleString()}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 font-semibold text-slate-800 text-xs bg-white border border-slate-200 rounded-lg shadow-2xs">
              Page {page} of {Math.max(1, totalPages)}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs font-semibold flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountHistoryView;
