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

const API_BASE = '/api';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE}/dashboard/summary`);
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

  const res = await fetch(`${API_BASE}/alerts?${query.toString()}`);
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

  const res = await fetch(`${API_BASE}/accounts?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch accounts');
  return res.json();
}

export async function fetchAccountProfile(accountId: string): Promise<AccountProfileResponse> {
  const res = await fetch(`${API_BASE}/accounts/${accountId}`);
  if (!res.ok) throw new Error('Failed to fetch account profile');
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

  const res = await fetch(`${API_BASE}/accounts/${accountId}/transactions?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch account transactions');
  return res.json();
}

export async function fetchAccountNetwork(accountId: string, maxCps: number = 25): Promise<NetworkResponse> {
  const res = await fetch(`${API_BASE}/accounts/${accountId}/network?max_cps=${maxCps}`);
  if (!res.ok) throw new Error('Failed to fetch account network');
  return res.json();
}

export async function updateInvestigationStatus(accountId: string, status: string, notes: string = '') {
  const res = await fetch(`${API_BASE}/investigations/${accountId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, analyst_notes: notes }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/analytics`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: Record<string, any>) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function resetSettings() {
  const res = await fetch(`${API_BASE}/settings/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to reset settings');
  return res.json();
}

export interface ChatResponse {
  reply: string;
  account_id?: string | null;
  suggested_actions?: string[];
  timestamp?: string;
}

export async function sendChatMessage(message: string, history?: { role: string; content: string }[]): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error('Failed to communicate with AI Copilot');
  return res.json();
}


