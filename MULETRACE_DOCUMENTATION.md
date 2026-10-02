# MuleTrace — Fintech AML & Fraud Investigation Platform

> **Production-grade Anti-Money Laundering (AML) platform for detecting mule accounts across 7.42 million retail banking transactions.** Built for the RBI Innovation Hub Hackathon.

---

## 1. Executive Summary & Architecture

Money laundering through **mule accounts** — ordinary bank accounts used by criminal syndicates to rapidly receive and disperse illicit funds — is one of the hardest financial crimes to detect at scale. 

**MuleTrace** provides an end-to-end detection engine and analyst-first investigation interface:
- **High-Performance Ingestion:** Scans and aggregates 7.42M transaction records across 40,038 accounts in seconds using Polars lazy execution and SQLite indexing.
- **Bipartite Network Analysis:** Faithfully models retail banking single-legged ledgers as an Account $\leftrightarrow$ Counterparty bipartite graph without fabricating artificial account-to-account mappings.
- **Explainable Risk Scoring:** Normalised 0–100 score driven by concrete mathematical signals with human-readable evidence.
- **60-Second Analyst Workflow:** Dashboard $\to$ Alert Queue $\to$ Deep Forensic Profile $\to$ Bipartite Graph $\to$ Confirm/Clear Action.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. RAW BANKING DATASET                          │
│  ./EDA-Phase-1/ (accounts.csv, customers.csv, transactions_part_0..5)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    2. POLARS HIGH-SPEED INGESTION                      │
│  - 7,424,845 Transactions Scanned via LazyFrames                      │
│  - Reversals & negative values handled without data loss               │
│  - Fast Parquet caching (transactions.parquet) for <10ms lookups       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  3. FOUR CORE DETECTION ENGINES                        │
│  ├── [1] Fan-In → Fan-Out: High distinct incoming & outgoing CPs       │
│  ├── [2] Bipartite Reciprocal Loops: Bidirectional A ↔ CP flows        │
│  ├── [3] Pass-Through / Rapid Transit: High velocity, ~100% turnover   │
│  └── [4] New Accounts / Clusters: Co-located PIN & branch anomalies    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                4. REST APIS & FASTAPI BACKEND (Port 8000)              │
│  - /api/dashboard/summary  - /api/alerts  - /api/accounts/{id}/network │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│             5. PROFESSIONAL REACT / TYPESCRIPT UI (Port 3000)          │
│  - Dark-first fintech operations interface                             │
│  - Interactive Bipartite Canvas Topology Graph                         │
│  - Case triage with status persistence & analyst notes                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Critical Banking Data Understanding

The inspection revealed that the retail dataset has a **single-legged ledger architecture**:
- `account_id` (`ACCT_XXXXXX`): Focal account held at the bank.
- `customer_id` (`CUST_XXXXXX`): Customer holding the account (1:1 or 1:2 linkage).
- `counterparty_id` (`CP_XXXXXX`): External entity interacting with the account. Includes special designated prefixes:
  - `CP_FOREIGN_XXXX`: Cross-border foreign remittances
  - `CP_EMPL_XXXXX`: Corporate employer / payroll entities
  - `CP_BRXXXX_XXX`: Branch-level clearing entities

### Why Bipartite Modeling?
In single-legged ledgers, when `ACCT_A` sends funds to `CP_X`, there is **no corresponding record** showing which internal account received it. Therefore, fabricating direct $A \to B \to C \to A$ cycles is technically invalid.
**MuleTrace solves this defensibly** by constructing a bipartite graph:
1. **Reciprocal Flows ($A \leftrightarrow CP_X$):** Detecting accounts that both receive funds from and send funds to the same counterparty within short windows.
2. **2-Hop Bipartite Bridges ($A \to CP_X \to B$):** Identifying shared counterparties acting as high-degree bridges between multiple accounts.

---

## 3. Four Core Detection Engines

### Engine 1: Fan-In → Fan-Out
- **Behavior:** The account acts as an aggregation and dispersal hub, receiving funds from many disparate counterparties and rapidly fanning them out to multiple destinations.
- **Metrics:** `unique_incoming_cps` (credits), `unique_outgoing_cps` (debits), credit-to-debit diversity ratio, transaction count.
- **Output Explanation:** *"Account received funds from 24 unique counterparties and sent funds to 21 counterparties within the observation window."*

### Engine 2: Circular & Reciprocal Flow (Bipartite)
- **Behavior:** Detecting bidirectional loops where funds flow between an account and a counterparty, or through shared counterparty rings.
- **Metrics:** Count of counterparties with both credit and debit operations, transaction latency, loop volume.
- **Output Explanation:** *"Detected suspicious reciprocal loops with 6 bidirectional counterparties (inflow and outflow cycles)."*

### Engine 3: Pass-Through / Rapid Transit Mule Behavior
- **Behavior:** Large volumes of money enter the account and are immediately drained onward with minimal balance retention (the signature mule behavior).
- **Metrics:** Pass-through ratio ($\text{Debit Volume} / \text{Credit Volume}$), average balance relative to turnover, turnover velocity.
- **Output Explanation:** *"98.4% of incoming funds (₹1,515,968) were dispersed onward; retained balance is -₹2,100 (negative overdraft)."*

### Engine 4: New Accounts & Shared Identifiers
- **Behavior:** Freshly opened accounts exhibiting immediate high velocity, or clusters of accounts sharing identical physical branches, PIN codes, or incomplete KYC documentation.
- **Metrics:** `account_age_days <= 180`, `pin_cluster_size >= 15`, `customer_accounts_count > 1`, missing PAN/Aadhaar flags.
- **Documentation Note:** Digital identifiers (device ID, IP address, GPS, phone, email) are not present in the dataset; detection relies on spatial/demographic co-location.

---

## 4. Explainable Risk Scoring

The risk engine computes a normalised **0–100 score**:
- **0–29:** LOW
- **30–59:** MEDIUM
- **60–79:** HIGH (Generates automated alert)
- **80–100:** CRITICAL (Generates high-priority alert)

### Component Signals:
1. `fan_in_out_score` (0–25)
2. `pass_through_score` (0–25)
3. `cycle_score` (0–15)
4. `shared_identifier_score` (0–15)
5. `velocity_score` (0–10)
6. `balance_behavior_score` (0–10)

Every flagged account includes **concrete, human-readable bullet points** explaining why it was flagged, with exact figures.

---

## 5. API Reference

All endpoints return JSON and are hosted on `http://127.0.0.1:8000`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/summary` | Top KPIs, monthly telemetry, pattern breakdown, recent alerts |
| `GET` | `/api/alerts` | Paginated alert queue with severity, pattern, status filters |
| `GET` | `/api/alerts/{id}` | Detailed alert record |
| `GET` | `/api/accounts` | Searchable directory of all 40,038 accounts |
| `GET` | `/api/accounts/{id}` | Full account profile, customer KYC, and risk breakdown |
| `GET` | `/api/accounts/{id}/transactions` | Paginated transactions queried from Parquet cache |
| `GET` | `/api/accounts/{id}/network` | Bipartite network nodes and directed edges |
| `POST` | `/api/investigations/{id}/status` | Update status (`CONFIRMED`, `CLEARED`, `UNDER_REVIEW`) & save notes |
| `GET` | `/api/analytics` | 5-year volume trends, channel distribution, risk histograms |
| `GET` | `/api/settings` | Current detection threshold configuration |
| `POST` | `/api/settings` | Update thresholds in runtime |

---

## 6. How to Run the Platform

### Single Command (Recommended):
Run the provided root launcher:
```bash
python run_muletrace.py
```
*Or double-click `start_muletrace.bat` on Windows.*

### Manual Startup:
**1. Backend:**
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
**2. Frontend:**
```bash
cd frontend
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

## 7. 60-Second Demo Script for Presentations

1. **Dashboard (0:00 - 0:15):**
   - Point out real KPIs: 40,038 Accounts, 7.42M Transactions analyzed, 1,912 Alerts generated.
   - Show 24-month transaction flow chart and four MuleTrace detection breakdown bars.
2. **Alert Queue (0:15 - 0:30):**
   - Click "Review Open Alerts" or the Alerts tab.
   - Filter by `Severity: Critical` or `Pattern: Pass-through Mule`.
   - Click **Investigate** on top account `ACCT_149010`.
3. **Forensic Investigation (0:30 - 0:50):**
   - Show Account Profile: Opening date, average balance, KYC status.
   - Highlight **Why Flagged Evidence**: Show exact pass-through percentage, fan-in/fan-out numbers.
   - Interact with the **Bipartite Network Graph**: Pan, zoom, click counterparty nodes to inspect volume and reciprocal loop indicators.
   - Scroll to Transaction Timeline to inspect individual credit/debit records.
4. **Action & Triage (0:50 - 1:00):**
   - Add analyst note: *"Confirmed mule: high velocity pass-through with minimal retained balance."*
   - Click **[ Confirm Mule ]** button. Observe live status badge transition to CONFIRMED.
