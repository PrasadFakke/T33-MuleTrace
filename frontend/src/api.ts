export interface DashboardSummary {
  kpis: {
    total_accounts: number;
    transactions_analyzed: number;
    suspicious_accounts: number;
    open_alerts: number;
    critical_risk_accounts: number;
    high_risk_accounts: number;
    confirmed_investigations: number;
    risk_high_threshold?: number;
    risk_critical_threshold?: number;
    fan_in_min_cps?: number;
    fan_out_min_cps?: number;
    pass_through_min_ratio?: number;
    new_account_max_days?: number;
  };
  risk_distribution: Record<string, number>;
  pattern_breakdown: Record<string, number>;
  recent_alerts: AlertItem[];
  top_suspicious_accounts: AccountSummaryItem[];
  timeline: {
    month: string;
    tx_count: number;
    total_volume: number;
    credit_volume: number;
    debit_volume: number;
  }[];
}

export interface AlertItem {
  alert_id: string;
  account_id: string;
  risk_score: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  pattern: string;
  amount: number;
  detected_at: string;
  explanation: string;
  status: 'NEW' | 'UNDER_REVIEW' | 'CONFIRMED' | 'CLEARED';
}

export interface AccountSummaryItem {
  account_id: string;
  customer_id?: string;
  risk_score: number;
  risk_level: string;
  primary_pattern: string;
  total_tx_count: number;
  credit_volume: number;
  debit_volume: number;
  pass_through_ratio: number;
  investigation_status: string;
  branch_code?: number;
  avg_balance?: number;
  account_opening_date?: string;
  kyc_compliant?: string;
}

export interface AccountProfileResponse {
  account: {
    account_id: string;
    customer_id: string;
    account_status: string;
    product_code: number;
    product_family: string;
    account_opening_date: string;
    account_age_days: number;
    branch_code: number;
    branch_pin: number;
    avg_balance: number;
    daily_avg_balance: number;
    monthly_avg_balance: number;
    kyc_compliant: string;
    total_tx_count: number;
    credit_tx_count: number;
    debit_tx_count: number;
    credit_volume: number;
    debit_volume: number;
    unique_incoming_cps: number;
    unique_outgoing_cps: number;
    reciprocal_cp_count: number;
    pass_through_ratio: number;
    risk_score: number;
    risk_level: string;
    primary_pattern: string;
    pattern_fan_in_out: number;
    pattern_pass_through: number;
    pattern_circular: number;
    pattern_shared_id: number;
    investigation_status: string;
    analyst_notes: string;
  };
  customer: {
    customer_id: string;
    date_of_birth: string;
    relationship_start_date: string;
    pan_available: string;
    aadhaar_available: string;
    passport_available: string;
    mobile_banking_flag: string;
    internet_banking_flag: string;
    atm_card_flag: string;
    demat_flag: string;
    credit_card_flag: string;
    fastag_flag: string;
    customer_pin: number;
    permanent_pin: number;
  };
  risk: {
    account_id: string;
    risk_score: number;
    risk_level: string;
    fan_in_out_score: number;
    pass_through_score: number;
    cycle_score: number;
    shared_identifier_score: number;
    velocity_score: number;
    balance_behavior_score: number;
    evidence_reasons: string[];
  };
  alert?: AlertItem;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'ACCOUNT' | 'COUNTERPARTY' | 'SECONDARY_ACCOUNT';
  is_focal?: boolean;
  category?: string;
  risk_score?: number;
  risk_level?: string;
  total_amount?: number;
  tx_count?: number;
  is_reciprocal?: boolean;
  pattern?: string;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  type: 'CREDIT' | 'DEBIT' | 'PEER_FLOW';
  amount: number;
  count: number;
  label: string;
}

export interface NetworkResponse {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  stats?: {
    total_nodes: number;
    total_edges: number;
    connected_counterparties: number;
    focal_account: string;
  };
}

export interface TransactionItem {
  transaction_id: string;
  account_id: string;
  transaction_timestamp: string;
  mcc_code: number;
  channel: string;
  amount: number;
  txn_type: 'C' | 'D';
  counterparty_id: string;
}

export interface AccountHistorySummary {
  account_id: string;
  customer_id: string;
  account_holder_name: string;
  account_status: string;
  total_inflow: number;
  total_outflow: number;
  net_balance_change: number;
  total_transactions: number;
  opening_balance: number;
  closing_balance: number;
  account_opening_date?: string;
  kyc_compliant?: string;
}

export interface AccountHistoryDayStat {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  count: number;
}

export interface AccountHistoryItem {
  transaction_id: string;
  account_id: string;
  transaction_timestamp: string;
  mcc_code?: number;
  channel: string;
  payment_mode: string;
  amount: number;
  txn_type: 'C' | 'D';
  type_label: string;
  counterparty_id: string;
  counterparty_account?: string;
  balance_after?: number;
  status: string;
  remarks: string;
}

export interface AccountHistoryResponse {
  summary: AccountHistorySummary;
  chart_data: AccountHistoryDayStat[];
  items: AccountHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const API_BASE = (import.meta.env.VITE_API_BASE as string) || 
  (import.meta.env.DEV ? '/api' : 'https://muletrace-backend.onrender.com/api');

export type ServerStatusListener = (isWaking: boolean, retryCount: number, errorMsg?: string) => void;
const serverStatusListeners = new Set<ServerStatusListener>();

export function subscribeServerStatus(listener: ServerStatusListener): () => void {
  serverStatusListeners.add(listener);
  return () => serverStatusListeners.delete(listener);
}

function notifyServerStatus(isWaking: boolean, retryCount: number = 0, errorMsg?: string): void {
  serverStatusListeners.forEach(listener => listener(isWaking, retryCount, errorMsg));
}

export async function apiFetch(endpoint: string, options: RequestInit = {}, retries = 4, delayMs = 3500): Promise<Response> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${cleanEndpoint}`;
  
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, options);
      // Statuses 502, 503, 504 are typical Render free cold boot / gateway responses
      if (!res.ok && [502, 503, 504].includes(res.status) && attempt < retries) {
        attempt++;
        notifyServerStatus(true, attempt, `Free cloud server is waking up (status ${res.status}). Retrying...`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      notifyServerStatus(false, 0);
      return res;
    } catch (err: any) {
      if (attempt < retries) {
        attempt++;
        notifyServerStatus(true, attempt, 'Connecting to server. Standby while cloud instance spins up...');
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      notifyServerStatus(false, 0);
      throw err;
    }
  }
  return fetch(url, options);
}

export function warmUpServer(): void {
  const healthUrl = API_BASE.replace(/\/api$/, '') + '/health';
  fetch(healthUrl).catch(() => {});
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiFetch('/dashboard/summary');
  if (!res.ok) throw new Error('Failed to fetch dashboard summary');
  return res.json();
}

export async function fetchAlerts(params: {
  page?: number;
  page_size?: number;
  severity?: string;
  pattern?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.page_size) query.set('page_size', params.page_size.toString());
  if (params.severity) query.set('severity', params.severity);
  if (params.pattern) query.set('pattern', params.pattern);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.sort_by) query.set('sort_by', params.sort_by);
  if (params.sort_order) query.set('sort_order', params.sort_order);

  const res = await apiFetch(`/alerts?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function fetchAccounts(params: {
  page?: number;
  page_size?: number;
  risk_level?: string;
  pattern?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.page_size) query.set('page_size', params.page_size.toString());
  if (params.risk_level) query.set('risk_level', params.risk_level);
  if (params.pattern) query.set('pattern', params.pattern);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.sort_by) query.set('sort_by', params.sort_by);
  if (params.sort_order) query.set('sort_order', params.sort_order);

  const res = await apiFetch(`/accounts?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch accounts');
  return res.json();
}

export async function fetchAccountProfile(accountId: string): Promise<AccountProfileResponse> {
  const res = await apiFetch(`/accounts/${accountId}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Account ${accountId} not found`);
    throw new Error('Failed to fetch account profile');
  }
  return res.json();
}

export async function fetchAccountTransactions(accountId: string, params?: {
  page?: number;
  page_size?: number;
  txn_type?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.page_size) query.set('page_size', params.page_size.toString());
  if (params?.txn_type) query.set('txn_type', params.txn_type);

  const res = await apiFetch(`/accounts/${accountId}/transactions?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch account transactions');
  return res.json();
}

export async function fetchAccountHistory(
  accountId: string,
  params?: {
    start_date?: string;
    end_date?: string;
    min_amount?: number;
    max_amount?: number;
    txn_type?: string;
    page?: number;
    page_size?: number;
    sort_order?: string;
    all_records?: boolean;
  }
): Promise<AccountHistoryResponse> {
  const query = new URLSearchParams();
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  if (params?.min_amount !== undefined && params.min_amount !== null && !isNaN(params.min_amount)) {
    query.set('min_amount', params.min_amount.toString());
  }
  if (params?.max_amount !== undefined && params.max_amount !== null && !isNaN(params.max_amount)) {
    query.set('max_amount', params.max_amount.toString());
  }
  if (params?.txn_type) query.set('txn_type', params.txn_type);
  if (params?.page) query.set('page', params.page.toString());
  if (params?.page_size) query.set('page_size', params.page_size.toString());
  if (params?.sort_order) query.set('sort_order', params.sort_order);
  if (params?.all_records) query.set('all_records', 'true');

  const res = await apiFetch(`/accounts/${accountId}/history?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch account history' }));
    throw new Error(err.detail || 'Failed to fetch account history');
  }
  return res.json();
}

export async function fetchAccountNetwork(accountId: string, maxCps: number = 25): Promise<NetworkResponse> {
  const res = await apiFetch(`/accounts/${accountId}/network?max_cps=${maxCps}`);
  if (!res.ok) throw new Error('Failed to fetch account network');
  return res.json();
}

export async function updateInvestigationStatus(accountId: string, status: string, notes: string = '') {
  const res = await apiFetch(`/investigations/${accountId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, analyst_notes: notes }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function fetchAnalytics() {
  const res = await apiFetch('/analytics');
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function fetchSettings() {
  const res = await apiFetch('/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: Record<string, any>) {
  const res = await apiFetch('/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function resetSettings() {
  const res = await apiFetch('/settings/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to reset settings');
  return res.json();
}


// ==========================================
// DYNAMIC INGESTION & FRAUD RE-ANALYSIS API
// ==========================================

export interface IngestionPreviewRow {
  row_num: number;
  account_id: string;
  customer_id: string;
  transaction_id: string;
  timestamp: string;
  amount: number;
  txn_type: string;
  counterparty: string;
  account_status: 'NEW' | 'EXISTING';
  customer_status: 'NEW' | 'EXISTING';
  resolution: string;
}

export interface IngestionBatchPreview {
  success: boolean;
  batch_id: string;
  filename: string;
  file_size_formatted: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  conflict_rows: number;
  new_customers_count: number;
  existing_customers_count: number;
  new_accounts_count: number;
  existing_accounts_count: number;
  schema_mapping: Record<string, string>;
  unmapped_columns: string[];
  preview_samples: IngestionPreviewRow[];
}

export interface IngestionCommitResponse {
  success: boolean;
  batch_id: string;
  message: string;
  records_imported: number;
  new_customers_created: number;
  new_accounts_created: number;
  affected_accounts_count: number;
  fraud_reanalysis: {
    accounts_reanalyzed: number;
    new_alerts_generated: number;
    high_risk_accounts: number;
    scores: Array<{
      account_id: string;
      risk_score: number;
      severity: string;
      primary_pattern: string;
      reasons: string[];
    }>;
  };
}

export interface IngestionBatchHistoryItem {
  batch_id: string;
  filename: string;
  upload_time: string;
  row_count: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  conflict_count: number;
  new_customers_count: number;
  existing_customers_count: number;
  new_accounts_count: number;
  existing_accounts_count: number;
  new_transactions_count: number;
  status: string;
}

export async function uploadAndPreviewFile(file: File): Promise<IngestionBatchPreview> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch('/ingestion/upload', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload and validation failed' }));
    throw new Error(err.detail || 'Upload and validation failed');
  }
  return res.json();
}

export async function commitIngestionBatch(batchId: string): Promise<IngestionCommitResponse> {
  const res = await apiFetch('/ingestion/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch_id: batchId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Batch commit failed' }));
    throw new Error(err.detail || 'Batch commit failed');
  }
  return res.json();
}

export async function rollbackIngestionBatch(batchId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/ingestion/${batchId}/rollback`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Batch rollback failed' }));
    throw new Error(err.detail || 'Batch rollback failed');
  }
  return res.json();
}

export async function fetchIngestionHistory(): Promise<{ batches: IngestionBatchHistoryItem[] }> {
  const res = await apiFetch('/ingestion/history');
  if (!res.ok) throw new Error('Failed to fetch ingestion history');
  const data = await res.json();
  return { batches: Array.isArray(data) ? data : (data.batches || []) };
}

export interface ChatResponse {
  reply: string;
  account_id?: string | null;
  suggested_actions?: string[];
  timestamp?: string;
}

export async function sendChatMessage(message: string, history?: { role: string; content: string }[]): Promise<ChatResponse> {
  const res = await apiFetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error('Failed to communicate with AI Copilot');
  return res.json();
}


