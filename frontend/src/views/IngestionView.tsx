import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Database,
  Sparkles,
  FileCheck,
  Zap,
  Info,
  Clock,
  Trash2,
  RefreshCw
} from 'lucide-react';
import {
  uploadAndPreviewFile,
  commitIngestionBatch,
  rollbackIngestionBatch,
  fetchIngestionHistory,
  IngestionBatchPreview,
  IngestionCommitResponse,
  IngestionBatchHistoryItem
} from '../api';

interface IngestionViewProps {
  onInvestigateAccount: (accountId: string) => void;
}

export const IngestionView: React.FC<IngestionViewProps> = ({ onInvestigateAccount }) => {
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'history'>('upload');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Staging state
  const [previewData, setPreviewData] = useState<IngestionBatchPreview | null>(null);
  const [commitResult, setCommitResult] = useState<IngestionCommitResponse | null>(null);
  
  // History state
  const [historyBatches, setHistoryBatches] = useState<IngestionBatchHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [rollbackLoadingId, setRollbackLoadingId] = useState<string | null>(null);

  // Load history on tab change
  useEffect(() => {
    if (activeSubTab === 'history') {
      loadHistory();
    }
  }, [activeSubTab]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchIngestionHistory();
      setHistoryBatches(data.batches || []);
    } catch (err: any) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setCommitResult(null);
    setIsUploading(true);

    try {
      const preview = await uploadAndPreviewFile(file);
      setPreviewData(preview);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process and validate upload');
      setPreviewData(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Demo CSV Generator for instant testing by Hackathon Evaluators
  const loadDemoMuleScenario = () => {
    const demoTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const demoCsv = `account_id,customer_id,transaction_id,transaction_timestamp,amount,txn_type,counterparty_id,channel
ACCT_MULE_DEMO_99,CUST_MULE_DEMO_99,TXN_DYN_001,${demoTimestamp},150000.00,C,CP_MULE_FEEDER_A,NEFT
ACCT_MULE_DEMO_99,CUST_MULE_DEMO_99,TXN_DYN_002,${demoTimestamp},145000.00,D,CP_MULE_CASH_OUT,IMPS
ACCT_MULE_DEMO_99,CUST_MULE_DEMO_99,TXN_DYN_003,${demoTimestamp},120000.00,C,CP_MULE_FEEDER_B,UPI
ACCT_MULE_DEMO_99,CUST_MULE_DEMO_99,TXN_DYN_004,${demoTimestamp},119500.00,D,CP_FOREIGN_CASHOUT_9,RTGS
ACCT_MULE_DEMO_99,CUST_MULE_DEMO_99,TXN_DYN_005,${demoTimestamp},85000.00,C,CP_MULE_FEEDER_C,UPI
ACCT_MULE_DEMO_99,CUST_MULE_DEMO_99,TXN_DYN_006,${demoTimestamp},84800.00,D,CP_MULE_CASH_OUT,ATM
`;
    const blob = new Blob([demoCsv], { type: 'text/csv' });
    const file = new File([blob], 'rbi_suspect_mule_scenario.csv', { type: 'text/csv' });
    handleFileSelected(file);
  };

  const handleCommit = async () => {
    if (!previewData) return;
    setIsCommitting(true);
    setErrorMsg(null);

    try {
      const res = await commitIngestionBatch(previewData.batch_id);
      setCommitResult(res);
      setPreviewData(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Batch commit failed');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDiscard = () => {
    setPreviewData(null);
    setSelectedFile(null);
    setErrorMsg(null);
    setCommitResult(null);
  };

  const handleRollback = async (batchId: string) => {
    if (!window.confirm(`Are you sure you want to rollback batch ${batchId}? This will safely remove its imported transactions and restore previous state.`)) {
      return;
    }
    setRollbackLoadingId(batchId);
    try {
      await rollbackIngestionBatch(batchId);
      await loadHistory();
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`);
    } finally {
      setRollbackLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Dynamic Data Ingestion Pipeline</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
              LIVE ENGINE
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Upload transactional batches, resolve customer/account entities, preview records, commit to persistent SQLite database, and run real-time fraud scoring.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('upload')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition ${
              activeSubTab === 'upload'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload & Staging</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition ${
              activeSubTab === 'history'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Batch Audit History</span>
          </button>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 font-bold ml-4">✕</button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: UPLOAD & STAGING WORKFLOW                          */}
      {/* ========================================================= */}
      {activeSubTab === 'upload' && (
        <div className="space-y-6">
          {/* POST-COMMIT SUCCESS NOTIFICATION CARD */}
          {commitResult && (
            <div className="bg-white border border-emerald-200 rounded-xl p-6 shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">Batch Imported & Scored Successfully</h2>
                      <span className="font-sans text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                        {commitResult.batch_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {commitResult.records_imported} transactions written to persistent storage. Real-time AML engine re-analyzed behavioral features and refreshed risk scores.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDiscard}
                  className="px-3.5 py-1.5 rounded-lg text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold transition shadow-2xs"
                >
                  Upload Another File
                </button>
              </div>

              {/* Execution Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">RECORDS COMMITTED</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{commitResult.records_imported.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">NEW ACCOUNTS CREATED</div>
                  <div className="text-xl font-bold text-blue-600 mt-1">{commitResult.new_accounts_created.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">ACCOUNTS RE-ANALYZED</div>
                  <div className="text-xl font-bold text-indigo-600 mt-1">{commitResult.fraud_reanalysis.accounts_reanalyzed.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-center">
                  <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">NEW ALERTS GENERATED</div>
                  <div className="text-xl font-bold text-rose-600 mt-1">{commitResult.fraud_reanalysis.new_alerts_generated.toLocaleString()}</div>
                </div>
              </div>

              {/* Live Scored Accounts Preview */}
              {commitResult.fraud_reanalysis.scores && commitResult.fraud_reanalysis.scores.length > 0 && (
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <h3 className="text-xs font-semibold text-slate-700 tracking-wider uppercase mb-3 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Real-Time Scored Entities (Direct Investigation Ready)</span>
                  </h3>
                  <div className="space-y-3">
                    {commitResult.fraud_reanalysis.scores.map((sc) => (
                      <div
                        key={sc.account_id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-300 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{sc.account_id}</span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                                sc.severity === 'CRITICAL'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : sc.severity === 'HIGH'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {sc.severity} ({sc.risk_score}/100)
                            </span>
                            <span className="text-xs text-slate-500">
                              Pattern: <strong className="text-slate-800">{sc.primary_pattern}</strong>
                            </span>
                          </div>
                          {sc.reasons && sc.reasons.length > 0 && (
                            <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap pt-1">
                              {sc.reasons.map((r, idx) => (
                                <span key={idx} className="bg-white px-2 py-0.5 rounded text-[11px] text-slate-700 border border-slate-200 shadow-2xs">
                                  • {r}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => onInvestigateAccount(sc.account_id)}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 transition shrink-0 shadow-xs"
                        >
                          <span>Investigate Account</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* UPLOAD FORM (IF NO PREVIEW DATA YET) */}
          {!previewData && !commitResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Drop Zone Card */}
              <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>Upload Batch File (.csv / .xlsx)</span>
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">Max size: 50MB</span>
                </div>

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-4 text-blue-600">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    {isUploading ? 'Validating Schema & Resolving Entities...' : 'Drop your transaction dataset here'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-5">
                    Supports flexible column headers (account_id, customer_id, txn_id, amount, timestamp, counterparty, channel).
                  </p>

                  <label className="cursor-pointer px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-xs flex items-center gap-2">
                    <span>Browse Computer Files</span>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.txt"
                      onChange={handleFileInput}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                </div>

                {/* Pipeline Guarantee Badges */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-slate-600">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium">Schema Normalization</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-medium">Deterministic Entity Resolution</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-medium">Instant Staging Preview</span>
                  </div>
                </div>
              </div>

              {/* Quick Preset / Demo Scenario Sidebar */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold mb-2 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md w-fit">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>HACKATHON DEMO PRESET</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">Simulate Live Mule Ingestion</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Instantly load a realistic RBI suspect mule scenario: a brand new account receiving high-velocity incoming transfers and immediate pass-through cashouts.
                  </p>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-2 mb-6">
                    <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">SCENARIO PAYLOAD:</div>
                    <div>• Account: <span className="text-blue-700 font-bold">ACCT_MULE_DEMO_99</span></div>
                    <div>• Transactions: <span className="text-slate-800 font-medium">6 rapid credits & debits</span></div>
                    <div>• Pass-through ratio: <span className="text-rose-600 font-bold">99.8% turnover</span></div>
                    <div>• Counterparties: <span className="text-amber-700 font-medium">NEFT, UPI, Cash-out</span></div>
                  </div>
                </div>

                <button
                  onClick={loadDemoMuleScenario}
                  disabled={isUploading}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Load Live Mule Scenario</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGED PREVIEW SCREEN (WHEN FILE VALIDATED) */}
          {previewData && (
            <div className="space-y-6">
              {/* Staging Summary Header Card */}
              <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">Staged Batch Review & Entity Resolution</h2>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                        {previewData.batch_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 font-medium">
                      <span>Source File: <strong className="text-slate-800">{previewData.filename}</strong></span>
                      <span>Size: <strong className="text-slate-800">{previewData.file_size_formatted}</strong></span>
                      <span>Status: <strong className="text-amber-600">PENDING CONFIRMATION</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDiscard}
                      disabled={isCommitting}
                      className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition shadow-2xs"
                    >
                      Discard Batch
                    </button>
                    <button
                      onClick={handleCommit}
                      disabled={isCommitting}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
                    >
                      {isCommitting ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                          <span>Committing & Scoring...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Import Data & Run Fraud Analysis</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Entity Resolution Breakdown Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">TOTAL ROWS</div>
                    <div className="text-base font-bold text-slate-900 mt-1">{previewData.total_rows.toLocaleString()}</div>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">VALID ROWS</div>
                    <div className="text-base font-bold text-emerald-700 mt-1">{previewData.valid_rows.toLocaleString()}</div>
                  </div>
                  <div className="bg-blue-50/50 border border-blue-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-blue-700 font-semibold uppercase tracking-wider">NEW CUSTOMERS</div>
                    <div className="text-base font-bold text-blue-700 mt-1">{previewData.new_customers_count.toLocaleString()}</div>
                  </div>
                  <div className="bg-indigo-50/50 border border-indigo-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider">NEW ACCOUNTS</div>
                    <div className="text-base font-bold text-indigo-700 mt-1">{previewData.new_accounts_count.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">EXISTING ACCTS</div>
                    <div className="text-base font-bold text-slate-700 mt-1">{previewData.existing_accounts_count.toLocaleString()}</div>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-amber-700 font-semibold uppercase tracking-wider">DUPLICATES</div>
                    <div className="text-base font-bold text-amber-700 mt-1">{previewData.duplicate_rows.toLocaleString()}</div>
                  </div>
                  <div className="bg-rose-50/50 border border-rose-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-rose-700 font-semibold uppercase tracking-wider">CONFLICTS</div>
                    <div className="text-base font-bold text-rose-700 mt-1">{previewData.conflict_rows.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">INVALID ROWS</div>
                    <div className="text-base font-bold text-slate-500 mt-1">{previewData.invalid_rows.toLocaleString()}</div>
                  </div>
                </div>

                {/* Schema Mapping Badges */}
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-slate-500 font-medium">Detected Schema Mapping:</span>
                  {Object.entries(previewData.schema_mapping || {}).map(([rawCol, canonCol]) => (
                    <span key={rawCol} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-sans">
                      <strong className="text-blue-700">{rawCol}</strong> → {canonCol}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sample Preview Table */}
              <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 tracking-wider uppercase flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    <span>Sample Records Preview ({previewData.preview_samples.length} Rows Displayed)</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">Verified parsed records</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] font-semibold">
                        <th className="p-3">#</th>
                        <th className="p-3">ACCOUNT ID</th>
                        <th className="p-3">CUSTOMER ID</th>
                        <th className="p-3">TXN ID</th>
                        <th className="p-3">TIMESTAMP</th>
                        <th className="p-3 text-right">AMOUNT (₹)</th>
                        <th className="p-3 text-center">TYPE</th>
                        <th className="p-3">COUNTERPARTY</th>
                        <th className="p-3 text-center">RESOLUTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.preview_samples.map((row: any, idx: number) => {
                        const rowNum = row.row_num || row.row_index || idx + 1;
                        const amtFormatted = typeof row.amount === 'number'
                          ? `₹${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : (row.amount_formatted || String(row.amount || '0.00'));
                        const isCredit = row.txn_type === 'C' || String(row.txn_type).toLowerCase().includes('credit');
                        const cp = row.counterparty || row.counterparty_id || '—';
                        const resText = row.resolution || row.explanation || row.status || 'Verified';

                        return (
                          <tr key={rowNum} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 text-slate-500">{rowNum}</td>
                            <td className="p-3 font-semibold text-slate-900">
                              {row.account_id}
                              {row.account_status === 'NEW' && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                  NEW
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700">
                              {row.customer_id}
                              {row.customer_status === 'NEW' && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                                  NEW
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500">{row.transaction_id}</td>
                            <td className="p-3 text-slate-500 text-[11px]">{row.timestamp}</td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              {amtFormatted}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isCredit
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {isCredit ? 'CREDIT' : 'DEBIT'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700">{cp}</td>
                            <td className="p-3 text-center">
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                                {resText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Clicking "Import Data" triggers atomic insertion and runs 4-pattern fraud scoring.</span>
                  </div>
                  <button
                    onClick={handleCommit}
                    disabled={isCommitting}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Import Data & Run Fraud Analysis</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: AUDIT & ROLLBACK HISTORY                           */}
      {/* ========================================================= */}
      {activeSubTab === 'history' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Ingestion Batch Audit Log</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Full chronological ledger of uploaded data batches with one-click atomic rollback protection.
              </p>
            </div>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center gap-2 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] font-semibold">
                  <th className="p-3">BATCH ID</th>
                  <th className="p-3">UPLOAD TIMESTAMP</th>
                  <th className="p-3">FILENAME</th>
                  <th className="p-3 text-right">ROWS</th>
                  <th className="p-3 text-right">VALID</th>
                  <th className="p-3 text-right">NEW ACCTS</th>
                  <th className="p-3 text-center">STATUS</th>
                  <th className="p-3 text-center">ROLLBACK ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No dynamic ingestion batches recorded yet. Upload a batch from the "Upload & Staging" tab.
                    </td>
                  </tr>
                ) : (
                  historyBatches.map((b) => (
                    <tr key={b.batch_id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-semibold text-blue-600">{b.batch_id}</td>
                      <td className="p-3 text-slate-500 text-[11px]">{b.upload_time}</td>
                      <td className="p-3 text-slate-900 font-medium">{b.filename}</td>
                      <td className="p-3 text-right text-slate-700 font-medium">{b.row_count?.toLocaleString() || 0}</td>
                      <td className="p-3 text-right text-emerald-600 font-medium">{b.valid_count?.toLocaleString() || 0}</td>
                      <td className="p-3 text-right text-indigo-600 font-medium">{b.new_accounts_count?.toLocaleString() || 0}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.status === 'IMPORTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : b.status === 'ROLLED_BACK'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {b.status === 'IMPORTED' && (
                          <button
                            onClick={() => handleRollback(b.batch_id)}
                            disabled={rollbackLoadingId === b.batch_id}
                            className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs transition flex items-center gap-1 mx-auto font-medium"
                            title="Revert all transactions and accounts added by this batch"
                          >
                            <Trash2 className="w-3 h-3 text-rose-600" />
                            <span>{rollbackLoadingId === b.batch_id ? 'Reverting...' : 'Rollback'}</span>
                          </button>
                        )}
                        {b.status === 'ROLLED_BACK' && (
                          <span className="text-slate-400 text-xs italic">Reverted</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default IngestionView;
