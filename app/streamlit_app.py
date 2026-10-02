"""
Mule Account Detection Dashboard
RBI Innovation Hub
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import lightgbm as lgb
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

# Paths
ROOT       = Path(__file__).parent.parent
FEAT_DIR   = ROOT / "data" / "features"
PRED_DIR   = ROOT / "data" / "predictions"
MODEL_DIR  = ROOT / "models"
REPORT_DIR = ROOT / "reports"

LEAKED = ["branch_mule_rate", "frozen_account_flag"]

# Page config
st.set_page_config(
    page_title="Mule Account Detector — RBI Innovation Hub",
    page_icon="🏦",
    layout="wide",
    initial_sidebar_state="expanded",
)

# CSS
st.markdown("""
<style>
  .risk-high   { background:#fff0f0; border-left:4px solid #e74c3c; border-radius:8px; padding:12px 16px; color:#1a1a1a !important; }
  .risk-medium { background:#fffbf0; border-left:4px solid #f39c12; border-radius:8px; padding:12px 16px; color:#1a1a1a !important; }
  .risk-low    { background:#f0fff4; border-left:4px solid #27ae60; border-radius:8px; padding:12px 16px; color:#1a1a1a !important; }
  .risk-high h2, .risk-high h1, .risk-high p,
  .risk-medium h2, .risk-medium h1, .risk-medium p,
  .risk-low h2, .risk-low h1, .risk-low p { color: inherit !important; }
  .section-header { font-size:1.3rem; font-weight:700; color:#4a90d9; margin-top:1.2rem; }
  .pct-badge {
    display:inline-block; background:#2c3e50; color:white;
    border-radius:20px; padding:2px 12px; font-size:0.85rem; font-weight:600;
  }
  .arch-card { border-radius:8px; padding:12px 16px; margin:4px 0; color:#1a1a1a !important; }
  .arch-card b { color:#1a1a1a !important; }
</style>
""", unsafe_allow_html=True)


# Data loaders

@st.cache_data
def load_train_features():
    df  = pd.read_csv(FEAT_DIR / "feature_matrix_train.csv")
    oof = pd.read_csv(PRED_DIR / "oof_predictions.csv")
    return df.merge(oof[["account_id", "oof_prob"]], on="account_id", how="left")

@st.cache_data
def load_test_features():
    df  = pd.read_csv(FEAT_DIR / "feature_matrix_test.csv")
    sub = pd.read_csv(PRED_DIR / "final_submission.csv")
    return df.merge(sub[["account_id", "mule_probability"]], on="account_id", how="left")

@st.cache_data
def load_medians():
    return pd.read_csv(FEAT_DIR / "feature_medians.csv", index_col=0).squeeze()

@st.cache_resource
def load_model():
    return lgb.Booster(model_file=str(MODEL_DIR / "lgbm_mule_detector.txt"))

@st.cache_resource
def get_explainer():
    return shap.TreeExplainer(load_model())

@st.cache_data
def get_feature_cols(_train_df):
    return [c for c in _train_df.columns
            if c not in ["account_id", "is_mule", "oof_prob"] + LEAKED]

def risk_label(prob):
    if prob >= 0.5:  return "HIGH",   "#e74c3c", "risk-high"
    if prob >= 0.15: return "MEDIUM", "#f39c12", "risk-medium"
    return "LOW", "#27ae60", "risk-low"


# Sidebar
with st.sidebar:
    st.markdown("## 🏦 Mule Detector")
    st.markdown("**RBI Innovation Hub**")
    st.divider()
    page = st.radio("Navigate", [
        "🏠 Project Overview",
        "🔍 Account Risk Scorer",
        "📊 EDA Explorer",
        "🤖 Model Intelligence",
    ])
    st.divider()
    st.markdown("LightGBM · 31 Features · 7.4M Transactions")
    st.markdown("OOF AUC-ROC: **0.8572**")


# ══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — PROJECT OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════
if page == "🏠 Project Overview":

    st.title("🏦 Mule Account Detection System")
    st.markdown("**RBI Innovation Hub** · Financial Crime Detection")
    st.divider()

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Transactions Analysed", "7.4 M",  "5-year window")
    col2.metric("Accounts Scored",       "40,038", "train + test")
    col3.metric("Mule Rate",             "1.09%",  "263 / 24,023")
    col4.metric("AUC-ROC",               "0.8572", "5-fold OOF")

    st.divider()
    c1, c2 = st.columns([1, 1])

    with c1:
        st.markdown('<p class="section-header">What is a Mule Account?</p>', unsafe_allow_html=True)
        st.markdown("""
A **mule account** is a bank account used to receive and forward illegally obtained funds —
a key enabler of money laundering. Detecting them requires identifying subtle behavioral
anomalies across millions of transactions.

This system operationalises all **12 RBI-defined suspicious activity patterns** into
machine-learning features, trains a LightGBM model on labeled banking data, and provides
**SHAP-based per-account explanations** for every prediction.
        """)

        st.markdown('<p class="section-header">System Architecture</p>', unsafe_allow_html=True)
        st.markdown("""
<div class="arch-card" style="background:#dce8ff;border-left:3px solid #4C72B0">
📥 <b>Raw Data</b> — 7.4M transactions across 6 CSV files, 5-year window (2020–2025)
</div>
<div style="text-align:center;font-size:1.4rem;color:#888;line-height:1.8">↓</div>
<div class="arch-card" style="background:#fde8cc;border-left:3px solid #DD8452">
⚙️ <b>Feature Engineering</b> — 31 features across 6 categories (VEL · NET · BEH · TMP · KYC · RSK)
</div>
<div style="text-align:center;font-size:1.4rem;color:#888;line-height:1.8">↓</div>
<div class="arch-card" style="background:#c8f0d8;border-left:3px solid #27ae60">
🤖 <b>LightGBM</b> — 261 trees · scale_pos_weight=90 · 5-fold stratified CV
</div>
<div style="text-align:center;font-size:1.4rem;color:#888;line-height:1.8">↓</div>
<div class="arch-card" style="background:#ead8f5;border-left:3px solid #8e44ad">
🔍 <b>SHAP Explainability</b> — per-account risk scores + feature attribution for every prediction
</div>
""", unsafe_allow_html=True)

    with c2:
        st.markdown('<p class="section-header">The 12 RBI Mule Patterns</p>', unsafe_allow_html=True)
        patterns = pd.DataFrame({
            "Pattern": [
                "Dormant Activation", "Structuring", "Rapid Pass-Through",
                "Fan-In / Fan-Out", "Geographic Inconsistency", "New Account High-Value",
                "Income Mismatch", "Mobile Change Spikes", "Round-Amount Preference",
                "Layered Signals", "Salary-Cycle Exploitation", "Branch Coordination"
            ],
            "Feature": [
                "dormancy_days", "structuring_rate", "debit_credit_ratio_7d",
                "fan_in_unique / fan_out_unique", "—", "avg_amt_first30d",
                "credit_to_balance_ratio", "mobile_update_flag", "round_amount_pct",
                "mule_pattern_score", "salary_cycle_pct", "branch_mule_rate*"
            ],
            "Status": ["✅"] * 11 + ["⚠️ Leaky"]
        })
        st.dataframe(patterns, use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — ACCOUNT RISK SCORER
# ══════════════════════════════════════════════════════════════════════════════
elif page == "🔍 Account Risk Scorer":

    st.title("🔍 Account Risk Scorer")
    st.markdown("Search any account to see its predicted mule probability and SHAP explanation.")
    st.divider()

    train_df  = load_train_features()
    test_df   = load_test_features()
    meds      = load_medians()
    feat_cols = get_feature_cols(train_df)

    # Combine train + test
    train_copy = train_df.copy()
    train_copy["prob"]  = train_copy["oof_prob"]
    train_copy["split"] = "train"

    test_copy = test_df.copy()
    test_copy["prob"]    = test_copy["mule_probability"]
    test_copy["is_mule"] = np.nan
    test_copy["split"]   = "test"

    all_accounts = pd.concat([train_copy, test_copy], ignore_index=True)

    # Controls row
    col_search, col_split = st.columns([2, 1])
    with col_search:
        search = st.text_input("🔍 Search by Account ID",
                               placeholder="Type an account ID to search…")
    with col_split:
        split_choice = st.radio("Account set", ["All", "Train (labeled)", "Test (unlabeled)"],
                                horizontal=True)

    if split_choice == "Train (labeled)":
        pool = all_accounts[all_accounts["split"] == "train"].copy()
    elif split_choice == "Test (unlabeled)":
        pool = all_accounts[all_accounts["split"] == "test"].copy()
    else:
        pool = all_accounts.copy()

    pool_sorted = pool.sort_values("prob", ascending=False)

    # Top-risk table — always visible on page load
    st.markdown("#### Top 20 Highest Risk Accounts")
    top20 = pool_sorted.head(20)[["account_id", "prob", "split", "is_mule"]].copy()
    top20.columns = ["Account ID", "Risk Score", "Split", "True Label"]
    top20["Risk Score"]  = top20["Risk Score"].map(lambda x: f"{x:.1%}" if pd.notna(x) else "—")
    top20["True Label"]  = top20["True Label"].map(
        lambda x: "🚨 Mule" if x == 1 else ("✅ Legit" if x == 0 else "—"))
    st.dataframe(top20, use_container_width=True, hide_index=True, height=280)

    st.divider()

    # Resolve selected account
    if search.strip():
        matches = pool[pool["account_id"].astype(str).str.contains(search.strip(), na=False)]
        if len(matches) == 0:
            st.warning(f"No accounts found matching '{search}'.")
            st.stop()
        selected = st.selectbox(
            "Matching accounts",
            matches.sort_values("prob", ascending=False)["account_id"].tolist()
        )
    else:
        selected = pool_sorted["account_id"].iloc[0]
        st.caption("Showing highest-risk account by default. Search above to drill into any account.")

    row  = pool[pool["account_id"] == selected].iloc[0]
    prob = float(row["prob"]) if not pd.isna(row["prob"]) else 0.0
    label, color, css_class = risk_label(prob)

    # Percentile rank
    all_probs = pool["prob"].dropna()
    pct_rank  = float((all_probs < prob).mean() * 100)
    top_pct   = 100 - pct_rank

    st.divider()

    # Risk Score Card
    score_col, gauge_col = st.columns([1, 1])

    with score_col:
        st.markdown(
            f'<div class="{css_class}">'
            f'<h2 style="margin:0;color:{color}">⚠️ Risk: {label}</h2>'
            f'<h1 style="margin:4px 0;color:{color};font-size:3rem">{prob:.1%}</h1>'
            f'<p style="margin:0;color:#333">Mule Probability — '
            f'<span class="pct-badge">Top {top_pct:.1f}%</span> by risk score</p>'
            f'</div>', unsafe_allow_html=True)

        st.markdown("")
        info_cols = st.columns(2)
        info_cols[0].metric("Account ID",    str(selected))
        info_cols[0].metric("Dataset Split", row["split"].title())
        info_cols[1].metric("Percentile",    f"Top {top_pct:.1f}%",
                            f"Riskier than {pct_rank:.1f}% of accounts")
        if not pd.isna(row.get("is_mule")):
            true_label = "🚨 MULE" if row["is_mule"] == 1 else "✅ Legitimate"
            info_cols[1].metric("True Label", true_label)

    with gauge_col:
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number",
            value=prob * 100,
            number={"suffix": "%", "font": {"size": 36}},
            gauge={
                "axis": {"range": [0, 100]},
                "bar":  {"color": color, "thickness": 0.3},
                "steps": [
                    {"range": [0,  15], "color": "#d5f5e3"},
                    {"range": [15, 50], "color": "#fef9e7"},
                    {"range": [50, 100],"color": "#fadbd8"},
                ],
                "threshold": {
                    "line": {"color": "black", "width": 2},
                    "thickness": 0.75,
                    "value": 50
                }
            },
            title={"text": "Mule Probability", "font": {"size": 18}}
        ))
        fig_gauge.update_layout(height=280, margin=dict(t=40, b=0, l=20, r=20))
        st.plotly_chart(fig_gauge, use_container_width=True)

    st.divider()

    # Tabs
    feat_tab, shap_tab, pattern_tab = st.tabs(
        ["📋 Feature Breakdown", "🧠 SHAP Explanation", "🚨 Pattern Triggers"])

    feat_vals = row[feat_cols].fillna(meds.reindex(feat_cols))

    with feat_tab:
        st.markdown("**How this account compares to the dataset median across all features.**")

        feat_df = pd.DataFrame({
            "Feature":        feat_cols,
            "Account Value":  [round(float(feat_vals[c]), 4) for c in feat_cols],
            "Dataset Median": [round(float(meds.get(c, 0)), 4) for c in feat_cols],
        })
        feat_df["Δ from Median"] = feat_df["Account Value"] - feat_df["Dataset Median"]
        feat_df["Category"] = feat_df["Feature"].apply(lambda f:
            "Velocity"   if f.startswith(("tx_","peak_","debit_")) else
            "Network"    if f.startswith(("fan_","counter","repeat","hub")) else
            "Behavioral" if f.startswith(("round","channel","night","struct","salary","weekend")) else
            "Temporal"   if f.startswith(("dormancy","active","avg_amt","activity")) else
            "KYC/Demo"   if f.startswith(("kyc","customer","account_age","multi","mobile","frozen")) else
            "Composite"
        )

        cat_filter = st.selectbox("Filter by category",
                                  ["All"] + sorted(feat_df["Category"].unique()))
        display_df = feat_df if cat_filter == "All" else feat_df[feat_df["Category"] == cat_filter]

        fig_bar = px.bar(
            display_df.sort_values("Δ from Median", key=abs, ascending=False).head(20),
            x="Δ from Median", y="Feature", orientation="h",
            color="Δ from Median",
            color_continuous_scale=["#4C72B0", "white", "#DD8452"],
            color_continuous_midpoint=0,
            title="Top 20 Features — Deviation from Dataset Median",
            hover_data=["Account Value", "Dataset Median", "Category"],
        )
        fig_bar.update_layout(height=480, yaxis={"categoryorder": "total ascending"},
                              coloraxis_showscale=False)
        st.plotly_chart(fig_bar, use_container_width=True)

    with shap_tab:
        st.markdown("**Which features pushed this account's risk score up or down?**")

        X_row = pd.DataFrame([feat_vals[feat_cols].values], columns=feat_cols)

        explainer = get_explainer()
        sv = explainer.shap_values(X_row)
        if isinstance(sv, list):
            sv = sv[1]
        sv = sv[0]

        sorted_idx  = np.argsort(np.abs(sv))[::-1][:15]
        feat_labels = np.array(feat_cols)[sorted_idx]
        feat_vals_s = X_row.values[0][sorted_idx]
        shap_vals_s = sv[sorted_idx]

        colors = ["#DD8452" if v > 0 else "#4C72B0" for v in shap_vals_s]
        fig_wf = go.Figure(go.Bar(
            x=shap_vals_s[::-1],
            y=[f"{f}={v:.3g}" for f, v in zip(feat_labels[::-1], feat_vals_s[::-1])],
            orientation="h",
            marker_color=colors[::-1],
            marker_line_color="black",
            marker_line_width=0.4,
        ))
        fig_wf.add_vline(x=0, line_color="black", line_width=1)
        fig_wf.update_layout(
            title=f"SHAP Waterfall — {selected} (prob={prob:.3f})",
            xaxis_title="SHAP value (impact on log-odds of being mule)",
            height=500,
            plot_bgcolor="white",
        )
        st.plotly_chart(fig_wf, use_container_width=True)
        st.caption("🟠 Orange = pushes toward MULE | 🔵 Blue = pushes toward LEGITIMATE")

    with pattern_tab:
        st.markdown("**Which of the 12 RBI mule patterns does this account trigger?**")

        pattern_checks = {
            "Dormant Activation":      ("dormancy_days",           lambda v, m: v > m * 2),
            "Structuring":             ("structuring_rate",        lambda v, m: v > m * 3),
            "Rapid Pass-Through":      ("debit_credit_ratio_7d",   lambda v, m: v > m * 2),
            "Fan-In":                  ("fan_in_unique",           lambda v, m: v > m * 2.5),
            "Fan-Out":                 ("fan_out_unique",          lambda v, m: v > m * 2.5),
            "New Account High-Value":  ("avg_amt_first30d",        lambda v, m: v > m * 3),
            "Income Mismatch":         ("credit_to_balance_ratio", lambda v, m: v > m * 2),
            "Mobile Change Spike":     ("mobile_update_flag",      lambda v, m: v == 1),
            "Round-Amount Preference": ("round_amount_pct",        lambda v, m: v > m * 2),
            "Salary-Cycle Exploit":    ("salary_cycle_pct",        lambda v, m: v > m * 2),
            "Velocity Burst":          ("peak_daily_tx",           lambda v, m: v > m * 3),
            "Channel Diversity":       ("channel_entropy",         lambda v, m: v > m * 1.5),
        }

        triggered, clean = [], []
        for name, (feat, check_fn) in pattern_checks.items():
            if feat not in feat_cols:
                continue
            val    = float(feat_vals.get(feat, 0) or 0)
            median = float(meds.get(feat, 1) or 1)
            if check_fn(val, median):
                triggered.append({"Pattern": f"🚨 {name}", "Feature": feat,
                                   "Value": round(val, 4), "Median": round(median, 4)})
            else:
                clean.append({"Pattern": f"✅ {name}", "Feature": feat,
                              "Value": round(val, 4), "Median": round(median, 4)})

        n_triggered = len(triggered)
        severity_color = "#e74c3c" if n_triggered >= 4 else "#f39c12" if n_triggered >= 2 else "#27ae60"
        st.markdown(f'<h3 style="color:{severity_color}">'
                    f'{n_triggered} / 12 patterns triggered</h3>', unsafe_allow_html=True)

        pat_df = pd.DataFrame(triggered + clean)
        if not pat_df.empty:
            st.dataframe(pat_df, use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE 3 — EDA EXPLORER
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📊 EDA Explorer":

    st.title("📊 EDA Explorer")
    st.markdown("Statistical analysis of all 12 RBI mule patterns across the dataset.")
    st.divider()

    train_df  = load_train_features()
    meds      = load_medians()
    feat_cols = get_feature_cols(train_df)

    # Interactive distribution — above the fold
    st.markdown("### Interactive Feature Distribution")
    st.markdown("Select any feature to see how it separates mule vs. legitimate accounts.")

    feat_choice = st.selectbox("Select feature", feat_cols)
    mule_vals   = train_df[train_df["is_mule"] == 1][feat_choice].dropna()
    legit_vals  = train_df[train_df["is_mule"] == 0][feat_choice].dropna()

    use_log = (legit_vals.max() / (legit_vals.median() + 1e-8)) > 100
    if use_log:
        mule_plot  = np.log1p(mule_vals)
        legit_plot = np.log1p(legit_vals)
        xlabel = f"log1p({feat_choice})"
    else:
        mule_plot, legit_plot, xlabel = mule_vals, legit_vals, feat_choice

    from scipy.stats import mannwhitneyu
    _, p = mannwhitneyu(mule_vals, legit_vals, alternative="two-sided")
    sig  = "***" if p < 0.001 else ("**" if p < 0.01 else ("*" if p < 0.05 else "ns"))

    fig_dist = go.Figure()
    fig_dist.add_trace(go.Histogram(x=legit_plot, name="Legitimate", opacity=0.6,
                                    marker_color="#4C72B0", histnorm="probability density",
                                    nbinsx=50))
    fig_dist.add_trace(go.Histogram(x=mule_plot,  name="Mule",       opacity=0.7,
                                    marker_color="#DD8452", histnorm="probability density",
                                    nbinsx=50))
    fig_dist.add_vline(x=float(legit_plot.median()), line_dash="dash", line_color="#4C72B0",
                       annotation_text=f"Legit median={legit_vals.median():.3g}")
    fig_dist.add_vline(x=float(mule_plot.median()),  line_dash="dash", line_color="#DD8452",
                       annotation_text=f"Mule median={mule_vals.median():.3g}")
    fig_dist.update_layout(
        title=f"{feat_choice} — Mule vs. Legitimate  [Mann-Whitney p={p:.2e} {sig}]",
        xaxis_title=xlabel, yaxis_title="Density",
        barmode="overlay", height=420, plot_bgcolor="white",
    )
    st.plotly_chart(fig_dist, use_container_width=True)

    stat_c1, stat_c2, stat_c3, stat_c4 = st.columns(4)
    stat_c1.metric("Mule Median",  f"{mule_vals.median():.4g}")
    stat_c2.metric("Legit Median", f"{legit_vals.median():.4g}")
    stat_c3.metric("p-value",      f"{p:.2e}")
    stat_c4.metric("Significance", sig)

    st.divider()

    # Static figures — collapsible gallery
    figures = {
        "Class Imbalance":                 "fig_class_imbalance.png",
        "Monthly Transaction Volume":      "fig_monthly_volume.png",
        "Fan-In / Fan-Out Network":        "fig_fan_in_out.png",
        "Top 12 Features (Distributions)": "fig_top_features.png",
        "KYC Non-Compliance":              "fig_kyc.png",
        "Branch-Level Coordination":       "fig_branch_coordination.png",
        "Missing Value Analysis":          "fig_nulls.png",
        "Data Leakage Diagnosis":          "fig_leakage_diagnosis.png",
        "Feature Correlation Matrix":      "fig_correlation.png",
    }

    with st.expander("📁 EDA Figure Gallery", expanded=False):
        available = {k: v for k, v in figures.items()
                     if (REPORT_DIR / v).exists()}
        if not available:
            st.warning("No figures found. Run the EDA notebook (01_EDA.ipynb) first.")
        else:
            cols = st.columns(2)
            for i, (name, fname) in enumerate(available.items()):
                with cols[i % 2]:
                    st.markdown(f"**{name}**")
                    st.image(str(REPORT_DIR / fname), use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE 4 — MODEL INTELLIGENCE
# ══════════════════════════════════════════════════════════════════════════════
elif page == "🤖 Model Intelligence":

    st.title("🤖 Model Intelligence")
    st.markdown("LightGBM performance metrics, SHAP global importance, and leakage analysis.")
    st.divider()

    train_df  = load_train_features()
    meds      = load_medians()
    feat_cols = get_feature_cols(train_df)
    oof_df    = train_df[["account_id", "is_mule", "oof_prob"]].dropna()

    from sklearn.metrics import (roc_auc_score, average_precision_score,
                                 roc_curve, precision_recall_curve, f1_score)
    y_true = oof_df["is_mule"].astype(int)
    y_prob = oof_df["oof_prob"]

    auc    = roc_auc_score(y_true, y_prob)
    pr_auc = average_precision_score(y_true, y_prob)
    thresholds = np.arange(0.05, 0.95, 0.01)
    f1s    = [f1_score(y_true, (y_prob >= t).astype(int), zero_division=0) for t in thresholds]
    best_t = thresholds[int(np.argmax(f1s))]
    best_f1= float(np.max(f1s))

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("AUC-ROC",  f"{auc:.4f}",    "5-fold OOF")
    m2.metric("PR-AUC",   f"{pr_auc:.4f}", "vs. 0.011 baseline")
    m3.metric("Best F1",  f"{best_f1:.4f}", f"@ threshold={best_t:.2f}")
    m4.metric("Features", "31",            "2 excluded (leakage)")

    st.divider()

    roc_tab, shap_tab, leak_tab = st.tabs(
        ["📈 ROC / PR Curves", "🧠 SHAP Global Importance", "⚠️ Leakage Analysis"])

    with roc_tab:
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        prec, rec, _= precision_recall_curve(y_true, y_prob)

        c1, c2 = st.columns(2)
        with c1:
            fig_roc = go.Figure()
            fig_roc.add_trace(go.Scatter(x=fpr, y=tpr, mode="lines",
                                         name=f"LightGBM (AUC={auc:.4f})",
                                         line=dict(color="#DD8452", width=2.5),
                                         fill="tozeroy", fillcolor="rgba(221,132,82,0.08)"))
            fig_roc.add_trace(go.Scatter(x=[0,1], y=[0,1], mode="lines", name="Random",
                                         line=dict(color="gray", dash="dash")))
            fig_roc.update_layout(title="ROC Curve", xaxis_title="False Positive Rate",
                                  yaxis_title="True Positive Rate", height=380,
                                  plot_bgcolor="white", legend=dict(x=0.55, y=0.1))
            st.plotly_chart(fig_roc, use_container_width=True)

        with c2:
            fig_pr = go.Figure()
            fig_pr.add_trace(go.Scatter(x=rec, y=prec, mode="lines",
                                        name=f"LightGBM (PR-AUC={pr_auc:.4f})",
                                        line=dict(color="#4C72B0", width=2.5),
                                        fill="tozeroy", fillcolor="rgba(76,114,176,0.08)"))
            baseline = float(y_true.mean())
            fig_pr.add_hline(y=baseline, line_dash="dash", line_color="gray",
                             annotation_text=f"Random={baseline:.4f}")
            fig_pr.update_layout(title="Precision-Recall Curve",
                                 xaxis_title="Recall", yaxis_title="Precision",
                                 height=380, plot_bgcolor="white",
                                 legend=dict(x=0.35, y=0.9))
            st.plotly_chart(fig_pr, use_container_width=True)

        st.markdown("**Threshold vs. F1 Score**")
        fig_thr = go.Figure()
        fig_thr.add_trace(go.Scatter(x=thresholds, y=f1s, mode="lines",
                                     name="F1", line=dict(color="#4C72B0", width=2)))
        fig_thr.add_vline(x=best_t, line_dash="dash", line_color="#DD8452",
                          annotation_text=f"Best t={best_t:.2f}  F1={best_f1:.4f}")
        fig_thr.update_layout(xaxis_title="Threshold", yaxis_title="F1 Score",
                              height=300, plot_bgcolor="white")
        st.plotly_chart(fig_thr, use_container_width=True)

        sub_path = PRED_DIR / "final_submission.csv"
        if sub_path.exists():
            st.download_button(
                "⬇️ Download Test Predictions (CSV)",
                data=open(sub_path).read(),
                file_name="mule_predictions.csv",
                mime="text/csv",
            )

    with shap_tab:
        st.markdown("Global feature importance computed using SHAP TreeExplainer on the full training set.")
        c1, c2 = st.columns([1, 1])

        with c1:
            st.markdown("**Mean |SHAP| — Feature Ranking**")
            fig_shap_bar = REPORT_DIR / "fig_shap_bar.png"
            if fig_shap_bar.exists():
                st.image(str(fig_shap_bar), use_container_width=True)
        with c2:
            st.markdown("**SHAP Beeswarm — Direction of Impact**")
            fig_shap_sum = REPORT_DIR / "fig_shap_summary.png"
            if fig_shap_sum.exists():
                st.image(str(fig_shap_sum), use_container_width=True)

        st.markdown("---")
        st.markdown("**SHAP Dependence — Top Features**")
        fig_dep = REPORT_DIR / "fig_shap_dependence.png"
        if fig_dep.exists():
            st.image(str(fig_dep), use_container_width=True)

    with leak_tab:
        st.markdown("""
### Data Leakage Identified & Fixed

Two features were identified as leaking label information and **excluded from the model**:

| Feature | AUC Alone | Why It Leaks |
|---|---|---|
| `branch_mule_rate` | **0.9776** | Computed using the account's own label at branch level (target encoding without cross-fitting) |
| `frozen_account_flag` | **0.7798** | Account freeze events occur *after* mule detection — post-detection signal |

**Without these features:** AUC = 0.8572 (true generalisation estimate)
**With these features:** AUC = 0.9927 (inflated by leakage)

**Production fix for `branch_mule_rate`:** Use leave-one-out or cross-validated target encoding
**Production fix for `frozen_account_flag`:** Exclude any field set post-detection from training features
        """)

        fig_leak = REPORT_DIR / "fig_leakage_diagnosis.png"
        if fig_leak.exists():
            st.image(str(fig_leak), use_container_width=True)

        st.info("Identifying and fixing this leakage is a key finding of this project. "
                "A naive model would report 0.99 AUC and be undeployable in production.")
