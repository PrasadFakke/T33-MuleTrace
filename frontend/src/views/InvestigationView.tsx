import React, { useState, useEffect } from 'react';
import { 
  AccountProfileResponse, 
  NetworkResponse, 
  TransactionItem, 
  fetchAccountProfile, 
  fetchAccountNetwork, 
  fetchAccountTransactions,
  updateInvestigationStatus 
} from '../api';
import { NetworkGraph } from '../components/NetworkGraph';
import { 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  User, 
  Building, 
  CreditCard, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Info,
  FileDown,
  RotateCcw
} from 'lucide-react';
import { exportAccountSAR_PDF } from '../utils/exportReport';

interface InvestigationViewProps {
  accountId: string;
  onBack?: () => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({ accountId, onBack }) => {
  const [profile, setProfile] = useState<AccountProfileResponse | null>(null);
  const [network, setNetwork] = useState<NetworkResponse | null>(null);
  const [txns, setTxns] = useState<TransactionItem[]>([]);
  const [txnTotal, setTxnTotal] = useState<number>(0);
  const [txnPage, setTxnPage] = useState<number>(1);
  const [txnTypeFilter, setTxnTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Status Action Modal
  const [analystNotes, setAnalystNotes] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadAccountData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profData, netData, txnData] = await Promise.all([
        fetchAccountProfile(accountId),
        fetchAccountNetwork(accountId, 25),
        fetchAccountTransactions(accountId, { page: txnPage, page_size: 25, txn_type: txnTypeFilter })
      ]);
      setProfile(profData);
      setNetwork(netData);
      setTxns(txnData.items);
      setTxnTotal(txnData.total);
      if (profData.account.analyst_notes) {
        setAnalystNotes(profData.account.analyst_notes);
      }
    } catch (err: any) {
      console.error('Error fetching investigation details:', err);
      setError(err.message || 'Failed to fetch forensic account details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountData();
  }, [accountId]);

  useEffect(() => {
    // Reload transactions when pagination or filter changes
    fetchAccountTransactions(accountId, { page: txnPage, page_size: 25, txn_type: txnTypeFilter })
      .then(res => {
        setTxns(res.items);
        setTxnTotal(res.total);
      });
  }, [txnPage, txnTypeFilter]);

  const handleStatusChange = async (newStatus: 'UNDER_REVIEW' | 'CONFIRMED' | 'CLEARED' | 'NEW' | 'REDO') => {
    try {
      setIsUpdatingStatus(true);
      const res = await updateInvestigationStatus(accountId, newStatus, analystNotes);
      const finalStatus = res?.new_status || newStatus;
      if (newStatus === 'NEW' || newStatus === 'REDO' || finalStatus === 'NEW' || finalStatus === 'UNFLAGGED') {
        setStatusMessage('Account status reverted to previous state (Pending / Unreviewed)');
      } else {
        setStatusMessage(`Account marked as ${finalStatus.replace('_', ' ')}`);
      }
      setTimeout(() => setStatusMessage(null), 3000);
      loadAccountData();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center h-96 space-x-3 text-blue-600">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="text-sm font-medium font-mono text-slate-600">Assembling Forensic Profile for {accountId}...</span>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="p-8 text-center text-slate-700 bg-white border border-rose-200 rounded-xl shadow-sm space-y-3 max-w-lg mx-auto my-12">
        <p className="font-semibold text-rose-600 text-sm">Failed to connect to investigation service</p>
        <p className="text-xs text-slate-500">{error}</p>
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={loadAccountData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs transition"
          >
            Retry Loading
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-200 transition"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm">
        <p className="font-medium">Account not found.</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-200 transition">
            Go Back
          </button>
        )}
      </div>
    );
  }

  const { account, customer, risk } = profile;
  const isCritical = risk.risk_score >= 80;
  const isHigh = risk.risk_score >= 60 && risk.risk_score < 80;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Notification */}
      {statusMessage && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Top Banner / Account Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="mt-0.5 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition"
              title="Return"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900">{account.account_id}</h1>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                isCritical ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                isHigh ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                RISK {risk.risk_score}/100 ({risk.risk_level})
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                account.investigation_status === 'CONFIRMED' ? 'bg-rose-600 text-white shadow-xs' :
                account.investigation_status === 'CLEARED' ? 'bg-emerald-600 text-white shadow-xs' :
                account.investigation_status === 'UNDER_REVIEW' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {account.investigation_status === 'NEW' ? 'NEW (UNREVIEWED)' : account.investigation_status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2 font-medium">
              <span>Customer ID: <strong className="text-slate-900">{customer.customer_id || 'N/A'}</strong></span>
              <span>•</span>
              <span>Product Family: <strong className="text-blue-700 font-semibold">{account.product_family}</strong> (Savings)</span>
              <span>•</span>
              <span>Branch Code: <strong className="text-slate-900">{account.branch_code}</strong></span>
            </p>
          </div>
        </div>

        {/* Action Buttons: Confirm / Clear / Review with Redo State */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => profile && exportAccountSAR_PDF(profile)}
            className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium flex items-center gap-1.5 transition shadow-2xs hover:shadow-xs"
            title="Download official Suspicious Activity Report (SAR) PDF Dossier"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span>Export SAR (PDF)</span>
          </button>

          {/* Under Review Button: becomes Redo when active */}
          {account.investigation_status === 'UNDER_REVIEW' ? (
            <button
              onClick={() => handleStatusChange('NEW')}
              disabled={isUpdatingStatus}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-amber-500/30"
              title="Click to Redo / Revert back to previous unreviewed state (not under review)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Redo (Prev State)</span>
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange('UNDER_REVIEW')}
              disabled={isUpdatingStatus}
              className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Under Review</span>
            </button>
          )}

          {/* Clear Account Button: becomes Redo when active */}
          {account.investigation_status === 'CLEARED' ? (
            <button
              onClick={() => handleStatusChange('NEW')}
              disabled={isUpdatingStatus}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-500/30"
              title="Click to Redo / Revert back to previous unreviewed state (not cleared)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Redo (Prev State)</span>
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange('CLEARED')}
              disabled={isUpdatingStatus}
              className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Clear Account</span>
            </button>
          )}

          {/* Confirm Mule Button: becomes Redo when active */}
          {account.investigation_status === 'CONFIRMED' ? (
            <button
              onClick={() => handleStatusChange('NEW')}
              disabled={isUpdatingStatus}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-rose-600/30"
              title="Click to Redo / Revert back to previous unreviewed state (not confirmed mule)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Redo (Prev State)</span>
            </button>
          ) : (
            <button
              onClick={() => handleStatusChange('CONFIRMED')}
              disabled={isUpdatingStatus}
              className="px-4 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-rose-600/25 hover:shadow-rose-600/40"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Confirm Mule</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 1: Profile, Customer KYC, Risk Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Account Profile Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 text-xs shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Account Ledger Profile</span>
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Opening Date:</span>
              <span className="font-mono text-slate-800 font-semibold">{account.account_opening_date} ({account.account_age_days}d ago)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Ledger Status:</span>
              <span className="font-mono text-slate-900 uppercase font-bold">{account.account_status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Average Balance:</span>
              <span className={`font-mono font-bold ${account.avg_balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                ₹{account.avg_balance?.toLocaleString() || '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Daily Avg Balance:</span>
              <span className="font-mono text-slate-800 font-semibold">₹{account.daily_avg_balance?.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Branch PIN:</span>
              <span className="font-mono text-slate-800">{account.branch_pin || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">KYC Compliant Flag:</span>
              <span className="font-mono font-semibold text-emerald-600">{account.kyc_compliant}</span>
            </div>
          </div>
        </div>

        {/* Customer KYC Demographics Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 text-xs shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <User className="w-4 h-4 text-indigo-600" />
            <span>Customer KYC & Demographics</span>
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">PAN Available:</span>
              <span className={`font-mono font-semibold ${customer.pan_available === 'Y' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {customer.pan_available || 'Missing / Null'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Aadhaar Available:</span>
              <span className={`font-mono font-semibold ${customer.aadhaar_available === 'Y' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {customer.aadhaar_available || 'Missing / Null'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Date of Birth:</span>
              <span className="font-mono text-slate-800">{customer.date_of_birth || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Residential PIN:</span>
              <span className="font-mono text-slate-800 font-semibold">{customer.customer_pin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Permanent PIN:</span>
              <span className="font-mono text-slate-800 font-semibold">{customer.permanent_pin}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 italic flex items-center gap-1">
              <Info className="w-3 h-3 text-blue-500 shrink-0" />
              <span>Note: IP address, device ID, phone number are absent in this dataset.</span>
            </div>
          </div>
        </div>

        {/* Risk Breakdown Signals Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 text-xs shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Explainable Risk Signals</span>
          </h3>
          <div className="space-y-2 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans font-medium">Fan-In / Fan-Out:</span>
              <span className="text-blue-600 font-bold">{risk.fan_in_out_score} / 25</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans font-medium">Pass-Through Velocity:</span>
              <span className="text-rose-600 font-bold">{risk.pass_through_score} / 25</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans font-medium">Bipartite Loop / Cycle:</span>
              <span className="text-amber-600 font-bold">{risk.cycle_score} / 15</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans font-medium">Shared Identifier Cluster:</span>
              <span className="text-indigo-600 font-bold">{risk.shared_identifier_score} / 10</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans font-medium">Burst Velocity:</span>
              <span className="text-slate-700 font-semibold">{risk.velocity_score} / 10</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans font-medium">Balance Anomaly:</span>
              <span className="text-slate-700 font-semibold">{risk.balance_behavior_score} / 10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Why Flagged (Human-Readable Evidence) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-amber-500" />
          <span>Why This Account Was Flagged (Concrete Evidence)</span>
        </h3>
        {risk.evidence_reasons && risk.evidence_reasons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {risk.evidence_reasons.map((reason, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3 text-sm text-slate-700 font-medium hover:border-blue-200 hover:bg-blue-50/20 transition-all">
                <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Standard operational transaction volume. No severe anomalies detected.</p>
        )}
      </div>

      {/* Row 3: Interactive Bipartite Network Graph */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-600" />
              <span>Bipartite Transaction Network Topology</span>
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Direct Account ↔ Counterparty graph layout with multi-hop flow detection
            </p>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-200">
            Single-Legged Ledger Representation
          </span>
        </div>

        {network && <NetworkGraph data={network} />}
      </div>

      {/* Row 4: Transaction Timeline & Ledger */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              <span>Transaction History & Flow Timeline</span>
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {txnTotal.toLocaleString()} total transactions recorded in the 5-year ledger
            </p>
          </div>

          {/* Transaction Filter Buttons */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => { setTxnTypeFilter(''); setTxnPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg border transition font-semibold ${
                txnTypeFilter === '' ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setTxnTypeFilter('C'); setTxnPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg border transition font-semibold ${
                txnTypeFilter === 'C' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Incoming Credits
            </button>
            <button
              onClick={() => { setTxnTypeFilter('D'); setTxnPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg border transition font-semibold ${
                txnTypeFilter === 'D' ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/20' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Outgoing Debits
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">Txn ID</th>
                <th className="py-3 px-4 font-bold">Timestamp</th>
                <th className="py-3 px-4 font-bold">Type</th>
                <th className="py-3 px-4 font-bold">Channel</th>
                <th className="py-3 px-4 font-bold">Amount (₹)</th>
                <th className="py-3 px-4 font-bold">Counterparty ID</th>
                <th className="py-3 px-4 font-bold">MCC Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.map(t => {
                const isCredit = t.txn_type === 'C';
                return (
                  <tr key={t.transaction_id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-4 text-blue-600 font-bold">{t.transaction_id}</td>
                    <td className="py-3 px-4 text-slate-600">{t.transaction_timestamp.replace('T', ' ')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        isCredit ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {isCredit ? 'CREDIT (IN)' : 'DEBIT (OUT)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{t.channel}</td>
                    <td className={`py-3 px-4 font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCredit ? '+' : '-'}₹{Math.abs(t.amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-semibold">{t.counterparty_id}</td>
                    <td className="py-3 px-4 text-slate-600">{t.mcc_code}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Transactions Pagination */}
        <div className="flex items-center justify-between text-sm text-slate-600 pt-3">
          <div>
            Showing transactions {(txnPage - 1) * 25 + 1} - {Math.min(txnTotal, txnPage * 25)} of {txnTotal.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTxnPage(p => Math.max(1, p - 1))}
              disabled={txnPage <= 1}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs font-semibold"
            >
              Previous
            </button>
            <span className="font-bold text-slate-900">{txnPage}</span>
            <button
              onClick={() => setTxnPage(p => p + 1)}
              disabled={txnPage * 25 >= txnTotal}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Row 5: Analyst Notes Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Case Investigation Log & Notes</span>
        </h3>
        <textarea
          rows={3}
          value={analystNotes}
          onChange={(e) => setAnalystNotes(e.target.value)}
          placeholder="Record notes, suspicious counterparties identified, or regulatory filing references..."
          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-mono transition-all"
        />
        <div className="flex justify-end">
          <button
            onClick={() => handleStatusChange(account.investigation_status as any)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/25 transition-all"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
};
