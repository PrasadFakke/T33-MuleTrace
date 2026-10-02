# MuleTrace - Enterprise AML & Mule Account Forensic Intelligence Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/Frontend-React_18_%2B_TypeScript-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/UI-Tailwind_CSS_Executive_White--Blue-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Polars](https://img.shields.io/badge/Engine-Polars_LazyFrames-CD792C.svg?logo=polars&logoColor=white)](https://pola.rs)
[![SQLite](https://img.shields.io/badge/Storage-SQLite_Materialized_Indexes-003B57.svg?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Dynamic Ingestion](https://img.shields.io/badge/Pipeline-Dynamic_Ingestion_%26_Rollback-0ea5e9.svg)](#6-key-features--analyst-tools)
[![Compliance](https://img.shields.io/badge/Compliance-RBI_Innovation_Hub_AML-blue.svg)](https://rbihub.in)
[![Tests](https://img.shields.io/badge/Tests-18%2F18_Passing_(100%25)-brightgreen.svg)](#8-verification--unit-testing)

> **High-performance, explainable Anti-Money Laundering (AML) platform designed for the Reserve Bank of India (RBI) Innovation Hub Challenge.** Analyzes **7.42 million retail banking transactions** across **40,038 bank accounts** to uncover mule networks, transit funnels, and circular laundering syndicates with sub-second latency, live batch ingestion, and regulatory-grade reporting.

---
Live website link: https://t33-mule-trace.vercel.app/
---
<img width="1917" height="1075" alt="image" src="https://github.com/user-attachments/assets/4bcc5f69-e4d6-4d9e-89ee-3b8adf977ec5" />

## 1. Executive Summary & Problem Context

Money laundering through **mule accounts** (accounts rented, purchased, or coerced by criminal syndicates to rapidly aggregate and disperse illicit funds) is one of the greatest threats to digital financial systems. Traditional rule-based engines suffer from massive false-positive fatigue and fail to catch multi-legged transit flows. Conversely, black-box deep learning models violate statutory compliance because bank analysts cannot explain to regulators or law enforcement *why* an account was frozen.

**MuleTrace** solves this with a mathematically defensible, analyst-first architecture:

1. **Sub-30-Second Big Data Ingestion:** Processes **7,424,845 raw transactions** and **40,038 KYC accounts** in ~25 seconds via Polars multi-threaded LazyFrames and indexed SQLite materialized views.
2. **Defensible Bipartite Graph Modeling:** Accurately models single-legged banking ledgers as an Account $\leftrightarrow$ Counterparty bipartite graph without fabricating artificial account-to-account linkages.
3. **Four RBI-Aligned Forensic Engines:** Detects Fan-In/Fan-Out funnels, Bipartite Reciprocal Loops, Pass-Through Transit funnels, and New Account Demographic Rings.
4. **Explainable Composite Risk Score (0–100):** Every flagged account includes normalized scoring backed by concrete, human-readable bullet points and transaction figures.
5. **Live Dynamic Data Ingestion Pipeline:** Upload new CSV/XLSX transaction batches, perform deterministic entity resolution, verify staging previews, commit to persistent storage, and trigger real-time fraud scoring with 1-click atomic rollback.
6. **Conversational AI Forensic Copilot:** An intelligent assistant with natural language access to live ledger telemetry, rule heuristics, and case summaries.
7. **Regulatory Compliance Dossiers:** One-click automated generation of executive AML PDF reports and official law-enforcement Suspicious Activity Report (SAR) PDF dossiers.
8. **Dynamic Runtime Threshold Tuning:** On-the-fly threshold adjustments with persistent instant re-evaluation across all 40,038 accounts.
9. **Reversible Case Triage:** Enterprise investigation workflow featuring *Under Review*, *Confirm Mule*, *Clear Account*, and *Redo (Revert to Previous State)*.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              1. RAW BANKING DATASETS                                   │
│        ./Datasets/ (accounts.csv, customers.csv, transactions_part_0..5.csv)           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                    2. POLARS HIGH-PERFORMANCE INGESTION ENGINE                         │
│  - 7,424,845 Transactions Scanned via Multi-Threaded LazyFrames                        │
│  - Zero-Loss Reversal Handling & Clean Decimal Casting                                 │
│  - Materialized SQLite DB & Parquet Columnar Caches (<15ms Query Latency)              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                     3. FOUR RBI-COMPLIANT DETECTION ENGINES                            │
│  ├── [Engine 1] Velocity Fan-In → Fan-Out: High Distinct Counterparty Funnels          │
│  ├── [Engine 2] Bipartite Reciprocal Loops: Bidirectional A ↔ CP Flows & Shared Bridges │
│  ├── [Engine 3] Pass-Through / Rapid Transit: High Inflow, ≥85% Drain, Zero Retention  │
│  └── [Engine 4] New Accounts & Ring Clusters: High Early Velocity & PIN Co-Location   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                 4. FASTAPI ASYNCHRONOUS BACKEND SERVICES (Port 8000)                   │
│  ├── /api/dashboard/summary  ── Macro Telemetry, 24M Volumes & Engine Breakdown        │
│  ├── /api/alerts             ── Paginated Triage Queue with Multi-Filter Support       │
│  ├── /api/accounts           ── Directory of 40,038 Accounts with Search & Sorting     │
│  ├── /api/accounts/{id}      ── Deep Forensic Profiles, KYC & 100-Score Signals        │
│  ├── /api/accounts/{id}/net  ── Bipartite Adjacency Topology Generator                │
│  ├── /api/ingestion/*        ── Upload, Staging Preview, Atomic Commit & Rollback      │
│  ├── /api/settings           ── Persistent Threshold Configuration & Auto-Recalc      │
│  └── /api/chat               ── AI Forensic Copilot LLM & Natural Language Reasoning   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│               5. EXECUTIVE WHITE-BLUE REACT 18 / TYPESCRIPT INTERFACE (Port 3000)       │
│  - Authoritative Times New Roman Typography & Enterprise Visual Polish                 │
│  - Dynamic Data Ingestion Hub with Live Drag-and-Drop & Batch Staging Preview          │
│  - Interactive Radial Bipartite Canvas Topology Visualizer                             │
│  - One-Click PDF Dossiers (Dashboard Executive Report & Formal SAR Dossier)           │
│  - AI AML Forensic Copilot Chat Drawer with Quick Prompt Chips                         │
│  - Reversible 3-State Triage (Under Review, Confirm Mule, Clear, Redo)                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Critical Banking Ledger & Graph Modeling

### The Single-Legged Ledger Reality
Banking core ledgers are structured as **single-legged transaction journals**:
- `account_id` (`ACCT_XXXXXX`): Focal account held at the bank.
- `customer_id` (`CUST_XXXXXX`): KYC entity linked to the focal account.
- `counterparty_id`: External entity sending or receiving money.
  - Standard Counterparties: `CP_XXXXXX` (100,429 unique entities)
  - Foreign Remittances: `CP_FOREIGN_XXXX` (Cross-border transfers)
  - Employer / Payroll Rails: `CP_EMPL_XXXXX` (Corporate payroll sources)
  - Branch Clearing Accounts: `CP_BRXXXX_XXX` (Branch transit entities)

### Why Bipartite Graphs?
In single-legged records, when `ACCT_A` transfers funds to `CP_X`, the bank does not record which internal account downstream receives it. **Inventing artificial $A \to B \to C \to A$ direct cycles is methodologically invalid.**

MuleTrace solves this by constructing a strict **Bipartite Adjacency Graph**:
1. **Reciprocal Loops ($A \leftrightarrow CP_X$):** Identifies suspicious counterparties that both send credit to and receive debit from the same focal account within tight velocity windows.
2. **2-Hop Counterparty Bridges ($A \to CP_X \to B$):** Discovers high-degree external counterparty nodes that act as liquidity bridges between multiple internal accounts.

---

## 4. The Four Core Detection Engines

| Engine | Methodology & Regulatory Criteria | Concrete Evidence Generated |
|---|---|---|
| **1. Fan-In $\to$ Fan-Out** | Identifies accounts collecting funds from numerous distinct senders (default $\ge 6$ counterparties) and rapidly dispersing them to multiple recipients (default $\ge 5$ counterparties). | *"Received funds from 24 unique counterparties and dispersed funds across 21 counterparties within observation window."* |
| **2. Circular / Reciprocal Flow** | Detects bidirectional loops ($A \leftrightarrow CP$) where funds cycle back and forth, or flow across shared high-degree bipartite bridges. | *"Suspicious Reciprocal Network: Loop flows detected with 6 bidirectional counterparties (inflow and outflow cycles)."* |
| **3. Pass-Through / Mule Behavior** | Flags accounts where $\ge 85\%$ of incoming funds are dispersed within short horizons, maintaining negligible or negative average retained balances. | *"Critical Pass-Through: 98.4% of ₹1,515,968 credit volume rapidly moved out; retained balance ratio is only -1.4% (overdraft)."* |
| **4. New Accounts & Shared Clusters** | Evaluates accounts opened $\le 90$ days ago exhibiting immediate volume spikes, co-located in high-density PIN clusters ($\ge 15$ accounts), or with incomplete KYC documentation. | *"New Account Ring Indicator: Opened 64 days ago with volume spike; PIN cluster of 18 co-located accounts; incomplete KYC."* |

---

## 5. Explainable Composite Risk Scoring Engine

Every account receives a normalized **0–100 Risk Score**:

$$\text{Risk Score} = \min\left(100, \; S_{\text{Fan-In/Out}} + S_{\text{Pass-Through}} + S_{\text{Loop}} + S_{\text{Cluster}} + S_{\text{Velocity}} + S_{\text{Balance}}\right)$$

### Score Cutoff Bands:
- **0–29 (`LOW`):** Standard everyday consumer retail activity.
- **30–59 (`MEDIUM`):** Elevated volume; standard monitoring.
- **60–79 (`HIGH`):** Generates automated alert; triage required.
- **80–100 (`CRITICAL`):** Severe multi-engine violation; immediate freeze recommendation.

### Zero Post-Detection Leakage Guarantee
To maintain strict analytical validity, post-investigation outcome columns (`freeze_date`, `unfreeze_date`, and historical audit tags) are **strictly excluded** from all heuristic scoring equations.

---

## 6. Key Features & Analyst Tools

### 📥 Dynamic Data Ingestion & Fraud Re-Analysis Pipeline
- **Flexible Batch Ingestion:** Drag-and-drop `.csv` or `.xlsx` files with flexible column headers.
- **Deterministic Entity Resolution:** Automatically identifies whether incoming records represent new or existing accounts/customers and detects conflicting status attributes.
- **Interactive Staging Verification:** Preview parsed samples, column mappings, and resolution classifications prior to committing.
- **Atomic Persistence & Instant Rescoring:** Atomic SQLite insertion triggers real-time fraud scoring across all four forensic engines, immediately updating risk scores and triage alerts.
- **Safe Rollback Engine:** Revert any imported batch with a single click, cleanly restoring baseline state without data corruption.

### 🤖 AI AML Forensic Copilot
- Natural language investigation assistant trained on RBI detection guidelines.
- Directly queries live database telemetry across all 40,038 accounts.
- Provides interactive quick-prompt chips (*"Why is ACCT_149010 flagged?"*, *"Top Suspicious Accounts"*, *"Explain Pass-Through vs Fan-In"*).
- One-click navigation from AI responses directly into the Forensic Studio.

### 📄 Compliance Dossiers & Export Hub
- **Executive AML Dashboard PDF:** Full visual report of macro flows, detection engine distributions, and top high-risk accounts.
- **Suspicious Activity Report (SAR) PDF:** Official regulatory-grade dossier detailing customer KYC, behavioral scores, complete transaction ledgers, and investigator notes.
- **Alert Queue CSV:** Instant export of active alerts for external SIEM and audit tracking.

### ⚙️ Dynamic Parameter Configuration
- Investigators can modify engine thresholds in real time (Fan-in/Fan-out counts, Pass-through ratio, New account horizons, and Risk thresholds).
- Updates trigger immediate background re-evaluation across all 40,038 accounts with database persistence and one-click baseline reset.

### 🔄 Reversible Case Triage & Redo Workflow
- Change account status between *Under Review*, *Confirm Mule*, and *Clear Account*.
- Any decision can be undone via the **Redo (Previous State)** button, reverting accounts back to the unreviewed pending state.

### 🌐 Radial Bipartite Network Visualizer
- Interactive HTML5 Canvas graph rendering focal accounts, counterparty nodes, foreign rails, and reciprocal loops with smooth zoom, pan, and node inspector drawers.

---

## 7. Project Structure

```
T33-MuleTrac/
├── backend/
│   ├── app/
│   │   ├── config.py                 # Application settings & dataset path resolvers
│   │   ├── db.py                     # SQLite connection manager & auto-init
│   │   ├── main.py                   # FastAPI initialization & router mounting
│   │   ├── ingestion/
│   │   │   ├── build_db.py           # Polars big data ingestion & SQLite builder
│   │   │   ├── dynamic_ingestion.py  # Live batch validation, scoring & rollback engine
│   │   │   └── init_dynamic_db.py    # Schema upgrade & table migration utility
│   │   ├── routes/
│   │   │   ├── dashboard.py          # /api/dashboard/summary
│   │   │   ├── alerts.py             # /api/alerts
│   │   │   ├── accounts.py           # /api/accounts
│   │   │   ├── investigations.py     # /api/investigations
│   │   │   ├── analytics.py          # /api/analytics
│   │   │   ├── ingestion.py          # /api/ingestion (upload, commit, rollback, history)
│   │   │   ├── settings_routes.py    # /api/settings
│   │   │   └── chat_routes.py        # /api/chat
│   │   └── services/
│   │       ├── detection_engine.py   # 4 core mathematical AML scoring algorithms
│   │       ├── query_service.py      # Unified SQLite + Parquet query handlers
│   │       └── ai_chat_service.py    # Forensic AI Copilot reasoning engine
│   ├── cache/
│   │   └── transactions.parquet      # 7.42M columnar transactions cache (ZSTD compressed)
│   ├── data/
│   │   ├── muletrace.db              # Materialized SQLite operational database
│   │   └── staging/                  # Temporary staging directory for batch uploads
│   ├── tests/
│   │   ├── test_detection_and_api.py # Platform & endpoint unit test suite (10 tests)
│   │   └── test_dynamic_ingestion.py # Dynamic upload, scoring & rollback test suite (8 tests)
│   └── requirements.txt              # Backend runtime dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── NetworkGraph.tsx      # Canvas bipartite network visualizer
│   │   ├── utils/
│   │   │   └── exportReport.ts       # jsPDF Executive Dashboard & SAR generator
│   │   ├── views/
│   │   │   ├── DashboardView.tsx     # Executive operations overview
│   │   │   ├── AlertsView.tsx        # Alert queue & multi-filter triage
│   │   │   ├── InvestigationView.tsx # Deep-dive forensic account dossier
│   │   │   ├── AccountsView.tsx      # 40,038 bank accounts registry
│   │   │   ├── NetworkView.tsx       # Bipartite topology graph studio
│   │   │   ├── AnalyticsView.tsx     # 5-year behavioral distributions
│   │   │   ├── IngestionView.tsx     # Dynamic data ingestion & rollback hub
│   │   │   ├── AIChatView.tsx        # AML Forensic Copilot chat interface
│   │   │   └── SettingsView.tsx      # Detection parameter tuner
│   │   ├── App.tsx                   # Main layout & executive navigation
│   │   ├── api.ts                    # Type-safe API client & interfaces
│   │   └── index.css                 # Times New Roman typography & design tokens
│   ├── tailwind.config.js            # Design tokens & color system
│   └── package.json                  # Frontend dependencies
├── Datasets/                         # The 9 Core Raw Banking Dataset CSV Files
│   ├── accounts.csv
│   ├── customers.csv
│   ├── customer_account_linkage.csv
│   └── transactions_part_0..5.csv
├── run_muletrace.py                  # One-command dual-server launcher
├── requirements.txt                  # Streamlined Python runtime dependencies
└── README.md                         # Comprehensive documentation
```

---

## 8. Verification & Unit Testing

MuleTrace includes an automated test suite verifying ingestion, detection models, database queries, and all REST endpoints:

```bash
cd backend
python -m pytest
```

### Test Suite Results:
```text
============================= test session starts =============================
platform win32 -- Python 3.14.2, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\prasa\Documents\T33-MuleTrac\backend
collected 18 items

tests/test_detection_and_api.py ..........                               [ 55%]
tests/test_dynamic_ingestion.py ........                                 [100%]

======================== 18 passed in 2.69s (100% Pass Rate) ========================
```

---

## 9. Quickstart & Installation

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** and **npm**

### Step 1: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Run the Platform (Single Command)
```bash
python run_muletrace.py
```
- **Web UI:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

*(Note: On first startup, MuleTrace automatically verifies the SQLite database and columnar Parquet cache).*

---

## 10. Technology Stack Summary

| Layer | Component | Description |
|---|---|---|
| **Data Ingestion** | `Polars 1.0+` | Rust-based vectorized engine scanning 7.42M rows with multi-threaded LazyFrames |
| **Storage & Indexing** | `SQLite 3` + `Parquet` | Materialized views with compound B-Tree indexes for $<15\text{ms}$ transaction queries |
| **Backend API** | `FastAPI` + `Pydantic v2` | Asynchronous REST endpoints with automatic OpenAPI documentation |
| **Dynamic Ingestion** | `Multipart + OpenPyXL` | Multi-format upload parser with entity resolution and atomic rollback |
| **Frontend Framework** | `React 18` + `TypeScript` | Enterprise component architecture with strict type safety |
| **Styling & Theme** | `Tailwind CSS` | Executive white-blue visual design, ambient glow elevations, and universal typography |
| **Visualization** | `Recharts` + `HTML5 Canvas` | High-density volume telemetry charts and radial bipartite graph visualizer |
| **Document Generation** | `jsPDF` + `autoTable` | Client-side vector PDF generation for executive reports and formal SAR dossiers |
| **AI Copilot** | `MuleTrace Forensic LLM` | Natural language forensic assistant with live database telemetry integration |

---

## 11. Authors & Acknowledgments

- **Platform:** MuleTrace — AML & Mule Account Detection Platform
- **Challenge:** Reserve Bank of India (RBI) Innovation Hub AML Hackathon
- **Focus:** Explainable Financial Crime Detection, Dynamic Data Ingestion, Bipartite Graph Analysis, and Real-Time Regulatory Triage
