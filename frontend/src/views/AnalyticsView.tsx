import React, { useState, useEffect } from 'react';
import { fetchAnalytics } from '../api';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, BarChart2, PieChart as PieIcon, Layers, RefreshCw } from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAnalytics();
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96 space-x-3 text-blue-600">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="text-sm font-medium font-mono text-slate-600">Aggregating 5-Year Macro Telemetry...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-slate-700 bg-white border border-rose-200 rounded-xl shadow-sm space-y-3 max-w-lg mx-auto my-12">
        <p className="font-semibold text-rose-600 text-sm">Failed to load analytics telemetry</p>
        <p className="text-xs text-slate-500">{error || 'Unable to connect to backend service.'}</p>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs transition"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const { monthly_volume, channel_distribution, risk_score_distribution, pass_through_distribution } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>AML Behavioral Analytics & Patterns</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
              5-Year Horizon
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Macro-level statistical distributions computed across all 7.42 million transaction records
          </p>
        </div>
      </div>

      {/* Row 1: 5-Year Volume Trends & Credit vs Debit */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-5 transition-all">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>5-Year Monthly Inflow (Credit) vs Outflow (Debit)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Aggregate flow volume in INR (₹ Millions)</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly_volume}>
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={9} 
                tickLine={false}
                tickFormatter={(val) => `₹${(val / 1e6).toFixed(0)}M`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(val: any) => [`₹${(Number(val) / 1e6).toFixed(2)}M`, 'Volume']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="credit_volume" name="Credit Inflow" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="debit_volume" name="Debit Outflow" fill="#f43f5e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Channel Distribution & Pass-Through Ratio Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pass-Through Ratio Distribution */}
        <div className="bg-white border border-slate-200 shadow-sm hover:shadow-card-hover rounded-2xl p-6 lg:p-8 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base lg:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                <BarChart2 className="w-5 h-5 text-amber-500" />
                <span>Pass-Through Ratio Distribution (Active Inflow &gt; ₹20k)</span>
              </h3>
              <p className="text-sm text-slate-500 mt-1">Ratio of Outgoing Debit to Incoming Credit</p>
            </div>
          </div>

          <div className="h-72 lg:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pass_through_distribution}>
                <XAxis dataKey="pt_bucket" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="count" name="Accounts" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {pass_through_distribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.pt_bucket.includes('Mule Zone') ? '#f43f5e' : '#2563eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-xs lg:text-sm text-slate-600">
            <span className="text-rose-600 font-bold">Red Highlight:</span> Accounts in the 85%–115% transit zone where almost 100% of received money is quickly moved out.
          </div>
        </div>

        {/* Channel Volume Distribution */}
        <div className="bg-white border border-slate-200 shadow-sm hover:shadow-card-hover rounded-2xl p-6 lg:p-8 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base lg:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                <PieIcon className="w-5 h-5 text-blue-600" />
                <span>Payment Channel Distribution</span>
              </h3>
              <p className="text-sm text-slate-500 mt-1">Top payment rails by total transaction volume</p>
            </div>
          </div>

          <div className="h-72 lg:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channel_distribution.slice(0, 8)} layout="vertical">
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${(v/1e6).toFixed(0)}M`} />
                <YAxis type="category" dataKey="channel" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="volume" name="Volume (₹)" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 text-xs lg:text-sm text-slate-600">
            UPI Credit (UPC) and UPI Debit (UPD) account for &gt;74% of retail transaction frequency.
          </div>
        </div>
      </div>

      {/* Row 3: Risk Score Distribution */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 lg:p-8">
        <h3 className="text-base lg:text-lg font-bold text-slate-900 flex items-center gap-2.5 mb-4">
          <Layers className="w-5 h-5 text-blue-600" />
          <span>Explainable Risk Score Population Histogram (0–100)</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {risk_score_distribution.map((bin: any) => (
            <div key={bin.bucket} className="bg-slate-50 hover:bg-blue-50/50 p-4 rounded-xl border border-slate-200 hover:border-blue-300 text-center transition-all group">
              <div className="text-sm text-slate-600 font-semibold group-hover:text-blue-700">Score {bin.bucket}</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{bin.count.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">
                {((bin.count / 40038) * 100).toFixed(1)}% of population
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
