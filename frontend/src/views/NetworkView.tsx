import React, { useState, useEffect } from 'react';
import { NetworkResponse, fetchAccountNetwork } from '../api';
import { NetworkGraph } from '../components/NetworkGraph';
import { Search, ShieldAlert, Info, RefreshCw, Zap } from 'lucide-react';

interface NetworkViewProps {
  initialAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
}

export const NetworkView: React.FC<NetworkViewProps> = ({
  initialAccountId = 'ACCT_149010',
  onSelectAccount
}) => {
  const [accountId, setAccountId] = useState<string>(initialAccountId);
  const [searchInput, setSearchInput] = useState<string>(initialAccountId);
  const [maxCps, setMaxCps] = useState<number>(25);
  const [network, setNetwork] = useState<NetworkResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Quick preset sample suspicious accounts
  const presets = ['ACCT_149010', 'ACCT_120083', 'ACCT_002704', 'ACCT_136280', 'ACCT_177174'];

  const loadNetwork = async (targetId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAccountNetwork(targetId, maxCps);
      setNetwork(data);
      setAccountId(targetId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load network graph.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetwork(accountId);
  }, [maxCps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      loadNetwork(searchInput.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Bipartite Network Topology Visualizer</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              Graph Explorer
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Visualizing single-legged ledger money flow between Bank Accounts and External Counterparties
          </p>
        </div>
      </div>

      {/* Dataset Notice Alert */}
      <div className="p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-xl text-xs text-slate-700 flex items-start gap-2.5 shadow-xs">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-900 font-semibold">Bipartite Structure Clarification:</strong> In this banking ledger, transactions map from focal accounts (<code className="px-1.5 py-0.5 rounded bg-white border border-blue-200 text-blue-700 font-bold">ACCT_</code>) to counterparties (<code className="px-1.5 py-0.5 rounded bg-white border border-amber-200 text-amber-700 font-bold">CP_</code>). Direct peer-to-peer account mappings are not available. This visualizer correctly models the system as a bipartite graph, highlighting shared counterparty bridges, bidirectional reciprocal loops, and foreign/employer transactions.
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Account ID (e.g. ACCT_149010)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition font-sans"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            Explore
          </button>
        </form>

        {/* Presets and Max CPs */}
        <div className="flex flex-wrap items-center gap-3.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Presets:</span>
          </div>
          <div className="flex gap-2">
            {presets.map(p => (
              <button
                key={p}
                onClick={() => { setSearchInput(p); loadNetwork(p); }}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  accountId === p 
                    ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-[0_0_12px_rgba(37,99,235,0.3)]' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-slate-600 ml-auto font-medium">
            <span>Neighborhood Limit:</span>
            <select
              value={maxCps}
              onChange={(e) => setMaxCps(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-xs focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value={15}>15 Nodes</option>
              <option value={25}>25 Nodes</option>
              <option value={40}>40 Nodes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Graph Area */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
        {loading ? (
          <div className="flex items-center justify-center h-[540px] text-blue-600 space-x-2">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="text-xs font-mono font-medium text-slate-600">Computing Bipartite Adjacency Topology for {accountId}...</span>
          </div>
        ) : network ? (
          <NetworkGraph
            data={network}
            onSelectNode={(node) => {
              if (node.type === 'SECONDARY_ACCOUNT' && onSelectAccount) {
                onSelectAccount(node.id);
              }
            }}
          />
        ) : error ? (
          <div className="h-96 flex flex-col items-center justify-center text-center space-y-3">
            <p className="font-semibold text-rose-600 text-xs">Failed to load network graph</p>
            <p className="text-xs text-slate-500 max-w-sm">{error}</p>
            <button
              onClick={() => loadNetwork(accountId)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="h-96 flex items-center justify-center text-slate-400 text-xs">
            No transaction connections found for this account.
          </div>
        )}
      </div>
    </div>
  );
};
