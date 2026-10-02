"""
Mule Account Detection — Feature Engineering Pipeline
RBI Innovation Hub

Computes 31 features across 5 categories for every account:
  VEL (6)  — Transaction velocity and rolling windows
  NET (5)  — Network / counterparty graph features
  BEH (6)  — Behavioral patterns (amounts, channels, timing)
  TMP (4)  — Temporal lifecycle features
  KYC (7)  — KYC / demographic risk features
  RSK (5)  — Composite risk / interaction features
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATASET_END = pd.Timestamp("2025-06-30")


# Helpers

def _shannon_entropy(series: pd.Series) -> float:
    p = series.value_counts(normalize=True).values
    return float(-np.sum(p * np.log2(p + 1e-10)))


# 1. Velocity Features (VEL_01–VEL_06)

def build_velocity_features(tx: pd.DataFrame) -> pd.DataFrame:
    ref = DATASET_END

    # Rolling windows
    w7  = tx[tx["transaction_timestamp"] >= ref - pd.Timedelta(days=7)]
    w30 = tx[tx["transaction_timestamp"] >= ref - pd.Timedelta(days=30)]

    vel01 = w7.groupby("account_id").size().rename("tx_count_7d")
    vel02 = w30.groupby("account_id").size().rename("tx_count_30d")
    vel03 = w30.groupby("account_id")["amount"].sum().rename("tx_amount_30d")

    # Debit/credit ratio in last 7 days
    cr7 = w7[w7["txn_type"] == "C"].groupby("account_id")["amount"].sum().rename("_cr7")
    dr7 = w7[w7["txn_type"] == "D"].groupby("account_id")["amount"].sum().rename("_dr7")
    dc_base = pd.concat([cr7, dr7], axis=1).fillna(0)
    vel04 = (dc_base["_dr7"] / (dc_base["_cr7"] + 1)).rename("debit_credit_ratio_7d")

    # Peak daily transaction count
    tx = tx.copy()
    tx["_date"] = tx["transaction_timestamp"].dt.date
    daily = tx.groupby(["account_id", "_date"]).size().reset_index(name="_dcnt")
    vel05 = daily.groupby("account_id")["_dcnt"].max().rename("peak_daily_tx")

    # Velocity burst z-score — max monthly z-score vs own history
    tx["_month"] = tx["transaction_timestamp"].dt.to_period("M")
    monthly = tx.groupby(["account_id", "_month"]).size().reset_index(name="_mcnt")
    stats = monthly.groupby("account_id")["_mcnt"].agg(["mean", "std"]).rename(
        columns={"mean": "_mu", "std": "_sd"}
    )
    monthly = monthly.merge(stats, on="account_id")
    monthly["_z"] = (monthly["_mcnt"] - monthly["_mu"]) / (monthly["_sd"] + 1e-8)
    vel06 = monthly.groupby("account_id")["_z"].max().rename("tx_velocity_zscore")

    return pd.concat([vel01, vel02, vel03, vel04, vel05, vel06], axis=1).reset_index()


# 2. Network Features (NET_01–NET_05)

def build_network_features(tx: pd.DataFrame) -> pd.DataFrame:
    tx_cp = tx[tx["counterparty_id"].notna()]

    net01 = (
        tx_cp[tx_cp["txn_type"] == "C"]
        .groupby("account_id")["counterparty_id"]
        .nunique()
        .rename("fan_in_unique")
    )
    net02 = (
        tx_cp[tx_cp["txn_type"] == "D"]
        .groupby("account_id")["counterparty_id"]
        .nunique()
        .rename("fan_out_unique")
    )

    # Counterparty diversity entropy
    net03 = (
        tx_cp.groupby("account_id")["counterparty_id"]
        .apply(_shannon_entropy)
        .rename("counterparty_entropy")
    )

    # Fraction of transactions that use a repeated counterparty
    cp_freq = (
        tx_cp.groupby(["account_id", "counterparty_id"])
        .size()
        .reset_index(name="_freq")
    )
    repeat = cp_freq[cp_freq["_freq"] > 1].groupby("account_id")["_freq"].sum().rename("_repeat")
    total  = tx_cp.groupby("account_id").size().rename("_total")
    net04  = (repeat / (total + 1)).fillna(0).rename("repeat_cp_ratio")

    # Hub score — normalized combined degree (fan_in + fan_out counterparties)
    all_deg = pd.concat([
        tx_cp[tx_cp["txn_type"] == "C"].groupby("account_id")["counterparty_id"].nunique(),
        tx_cp[tx_cp["txn_type"] == "D"].groupby("account_id")["counterparty_id"].nunique(),
    ], axis=1).fillna(0).sum(axis=1)
    max_deg = all_deg.max() if all_deg.max() > 0 else 1
    net05 = (all_deg / max_deg).rename("hub_score")

    return pd.concat([net01, net02, net03, net04, net05], axis=1).reset_index()


# 3. Behavioral Features (BEH_01–BEH_06)

def build_behavioral_features(tx: pd.DataFrame) -> pd.DataFrame:
    tx = tx.copy()

    # Round-amount preference
    beh01 = (
        tx.assign(is_round=(tx["amount"] % 1000 == 0).astype(int))
        .groupby("account_id")["is_round"]
        .mean()
        .rename("round_amount_pct")
    )

    # Channel entropy
    beh02 = (
        tx.groupby("account_id")["channel"]
        .apply(_shannon_entropy)
        .rename("channel_entropy")
    )

    # Night transaction ratio (10pm–6am)
    hour = tx["transaction_timestamp"].dt.hour
    beh03 = (
        tx.assign(is_night=((hour >= 22) | (hour < 6)).astype(int))
        .groupby("account_id")["is_night"]
        .mean()
        .rename("night_tx_ratio")
    )

    # Structuring rate — vectorized threshold check
    def _structuring_mask(amounts):
        mask = pd.Series(False, index=amounts.index)
        for t in [50_000, 200_000]:
            mask |= (amounts >= t * 0.90) & (amounts < t)
        return mask.astype(int)

    beh04 = (
        tx.assign(is_struct=_structuring_mask(tx["amount"]))
        .groupby("account_id")["is_struct"]
        .mean()
        .rename("structuring_rate")
    )

    # Salary-cycle exploitation — credits on days 1–5 of month
    credits = tx[tx["txn_type"] == "C"].copy()
    credits["_dom"] = credits["transaction_timestamp"].dt.day
    beh05 = (
        credits.assign(in_window=(credits["_dom"] <= 5).astype(int))
        .groupby("account_id")["in_window"]
        .mean()
        .rename("salary_cycle_pct")
    )

    # Weekend transaction ratio
    beh06 = (
        tx.assign(is_weekend=(tx["transaction_timestamp"].dt.dayofweek >= 5).astype(int))
        .groupby("account_id")["is_weekend"]
        .mean()
        .rename("weekend_tx_ratio")
    )

    return pd.concat([beh01, beh02, beh03, beh04, beh05, beh06], axis=1).reset_index()


# 4. Temporal Features (TMP_01–TMP_04)

def build_temporal_features(tx: pd.DataFrame, accounts: pd.DataFrame) -> pd.DataFrame:
    accts = accounts[["account_id", "account_opening_date"]].copy()
    accts["account_opening_date"] = pd.to_datetime(accts["account_opening_date"])

    bounds = tx.groupby("account_id")["transaction_timestamp"].agg(
        first_tx="min", last_tx="max"
    ).reset_index()

    temp = accts.merge(bounds, on="account_id", how="left")

    # TMP_01: days from account open to first transaction
    temp["dormancy_days"] = (
        (temp["first_tx"] - temp["account_opening_date"]).dt.days.clip(lower=0)
    )

    # TMP_02: span between first and last transaction
    temp["active_lifespan_days"] = (
        (temp["last_tx"] - temp["first_tx"]).dt.days.clip(lower=0)
    )

    # TMP_03: average transaction amount in first 30 days
    tx_open = tx.merge(accts, on="account_id")
    tx_open["_days_since"] = (
        tx_open["transaction_timestamp"] - tx_open["account_opening_date"]
    ).dt.days
    early = tx_open[tx_open["_days_since"].between(0, 30)]
    tmp03 = early.groupby("account_id")["amount"].mean().rename("avg_amt_first30d")

    # TMP_04: activity burst z-score (same monthly z-score as VEL_06)
    tx = tx.copy()
    tx["_month"] = tx["transaction_timestamp"].dt.to_period("M")
    monthly = tx.groupby(["account_id", "_month"]).size().reset_index(name="_cnt")
    stats = monthly.groupby("account_id")["_cnt"].agg(["mean", "std"]).rename(
        columns={"mean": "_mu", "std": "_sd"}
    )
    monthly = monthly.merge(stats, on="account_id")
    monthly["_z"] = (monthly["_cnt"] - monthly["_mu"]) / (monthly["_sd"] + 1e-8)
    tmp04 = monthly.groupby("account_id")["_z"].max().rename("activity_burst_zscore")

    return (
        temp[["account_id", "dormancy_days", "active_lifespan_days"]]
        .merge(tmp03.reset_index(), on="account_id", how="left")
        .merge(tmp04.reset_index(), on="account_id", how="left")
    )


# 5. KYC / Demographic Features (KYC_01–KYC_07)

def build_kyc_features(
    accounts: pd.DataFrame, customers: pd.DataFrame, linkage: pd.DataFrame
) -> pd.DataFrame:
    accts = accounts[
        ["account_id", "kyc_compliant", "account_opening_date",
         "last_mobile_update_date", "freeze_date"]
    ].copy()
    accts["account_opening_date"] = pd.to_datetime(accts["account_opening_date"])

    accts["kyc_compliant_flag"]  = (accts["kyc_compliant"] == "Y").astype(int)
    accts["account_age_days"]    = (DATASET_END - accts["account_opening_date"]).dt.days
    accts["mobile_update_flag"]  = accts["last_mobile_update_date"].notna().astype(int)
    accts["frozen_account_flag"] = accts["freeze_date"].notna().astype(int)

    cust = customers[
        ["customer_id", "date_of_birth",
         "pan_available", "aadhaar_available", "passport_available"]
    ].copy()
    cust["date_of_birth"] = pd.to_datetime(cust["date_of_birth"])
    for col in ["pan_available", "aadhaar_available", "passport_available"]:
        cust[col] = (cust[col] == "Y").astype(int)
    cust["kyc_doc_score"] = cust[["pan_available","aadhaar_available","passport_available"]].sum(axis=1)
    cust["customer_age"]  = (DATASET_END - cust["date_of_birth"]).dt.days / 365.25

    accts_per_cust = linkage.groupby("customer_id")["account_id"].count().rename("_acct_count")
    cust = cust.merge(accts_per_cust, on="customer_id", how="left")
    cust["multi_account_flag"] = (cust["_acct_count"] > 1).astype(int)

    merged = (
        accts.merge(linkage[["account_id", "customer_id"]], on="account_id", how="left")
             .merge(cust[["customer_id","kyc_doc_score","customer_age","multi_account_flag"]],
                    on="customer_id", how="left")
    )

    return merged[[
        "account_id", "kyc_compliant_flag", "kyc_doc_score", "customer_age",
        "account_age_days", "multi_account_flag", "mobile_update_flag", "frozen_account_flag"
    ]]


# 6. Composite / Risk Features (RSK_01–RSK_05)

def build_composite_features(
    tx: pd.DataFrame,
    accounts: pd.DataFrame,
    features_so_far: pd.DataFrame,
    labels: pd.DataFrame = None,
    products: pd.DataFrame = None,
    linkage: pd.DataFrame = None,
) -> pd.DataFrame:

    # RSK_01: total credits / average balance (income mismatch proxy)
    credits_total = tx[tx["txn_type"] == "C"].groupby("account_id")["amount"].sum().rename("_total_cr")
    bal = accounts[["account_id", "avg_balance"]].copy()
    bal["avg_balance"] = pd.to_numeric(bal["avg_balance"], errors="coerce").abs().fillna(0) + 1
    rsk01 = (
        credits_total.reset_index()
        .merge(bal, on="account_id")
    )
    rsk01["credit_to_balance_ratio"] = rsk01["_total_cr"] / rsk01["avg_balance"]
    rsk01 = rsk01[["account_id", "credit_to_balance_ratio"]]

    # RSK_02: debit spike flag — peak weekly debit > 3× monthly avg
    debits = tx[tx["txn_type"] == "D"].copy()
    debits["_week"]  = debits["transaction_timestamp"].dt.to_period("W")
    debits["_month"] = debits["transaction_timestamp"].dt.to_period("M")
    peak_w = debits.groupby(["account_id", "_week"])["amount"].sum().groupby("account_id").max().rename("_pw")
    avg_m  = debits.groupby(["account_id", "_month"])["amount"].sum().groupby("account_id").mean().rename("_am")
    spike  = pd.concat([peak_w, avg_m], axis=1).reset_index()
    spike["debit_spike_flag"] = (spike["_pw"] > 3 * spike["_am"]).astype(int)
    rsk02 = spike[["account_id", "debit_spike_flag"]]

    # RSK_03: composite mule pattern score (count of individual pattern flags triggered)
    f = features_so_far.set_index("account_id")
    pattern_flags = pd.DataFrame(index=f.index)
    flag_defs = {
        "structuring_rate":       0.80,
        "round_amount_pct":       0.80,
        "peak_daily_tx":          0.90,
        "fan_out_unique":         0.90,
        "debit_credit_ratio_7d":  0.80,
        "night_tx_ratio":         0.80,
        "counterparty_entropy":   0.80,
        "tx_velocity_zscore":     0.90,
    }
    for col, q in flag_defs.items():
        if col in f.columns:
            thresh = f[col].quantile(q)
            pattern_flags[f"_flag_{col}"] = (f[col] > thresh).astype(int)
    rsk03 = pattern_flags.sum(axis=1).rename("mule_pattern_score").reset_index()

    # RSK_04: branch mule rate (train-time only — leave NaN for inference)
    if labels is not None:
        branch_mule = accounts[["account_id", "branch_code"]].merge(
            labels[["account_id", "is_mule"]], on="account_id", how="left"
        )
        branch_rates = branch_mule.groupby("branch_code")["is_mule"].mean().rename("branch_mule_rate")
        rsk04 = (
            accounts[["account_id", "branch_code"]]
            .merge(branch_rates.reset_index(), on="branch_code", how="left")
        )[["account_id", "branch_mule_rate"]]
    else:
        rsk04 = accounts[["account_id"]].copy()
        rsk04["branch_mule_rate"] = np.nan

    # RSK_05: product count (number of distinct product types held)
    if products is not None and linkage is not None:
        prod = products.copy()
        prod["product_count"] = (
            (prod["loan_count"].fillna(0) > 0).astype(int) +
            (prod["cc_count"].fillna(0)   > 0).astype(int) +
            (prod["od_count"].fillna(0)   > 0).astype(int) +
            (prod["ka_count"].fillna(0)   > 0).astype(int) +
            (prod["sa_count"].fillna(0)   > 0).astype(int)
        )
        rsk05 = linkage.merge(prod[["customer_id", "product_count"]], on="customer_id", how="left")[
            ["account_id", "product_count"]
        ]
    else:
        rsk05 = features_so_far[["account_id"]].copy()
        rsk05["product_count"] = np.nan

    return (
        rsk01
        .merge(rsk02, on="account_id", how="left")
        .merge(rsk03, on="account_id", how="left")
        .merge(rsk04, on="account_id", how="left")
        .merge(rsk05, on="account_id", how="left")
    )


# Master Function

def build_all_features(
    data_dir: str,
    account_ids=None,
    labels: pd.DataFrame = None,
    verbose: bool = True,
) -> pd.DataFrame:
    """
    Load raw data and compute the full 31-feature matrix.

    Parameters
    ----------
    data_dir    : path to EDA-Phase-1/ directory containing all CSVs
    account_ids : optional list to restrict output (e.g. only train accounts)
    labels      : optional train_labels DataFrame (enables branch_mule_rate)
    verbose     : print progress

    Returns
    -------
    DataFrame with account_id + 31 feature columns, one row per account
    """
    data_dir = Path(data_dir)
    log = print if verbose else lambda *a: None

    log("Loading static tables...")
    accounts  = pd.read_csv(data_dir / "accounts.csv")
    customers = pd.read_csv(data_dir / "customers.csv")
    linkage   = pd.read_csv(data_dir / "customer_account_linkage.csv")
    products  = pd.read_csv(data_dir / "product_details.csv")

    log("Loading transactions (7.4M rows)...")
    tx_parts = [
        pd.read_csv(data_dir / f"transactions_part_{i}.csv",
                    parse_dates=["transaction_timestamp"])
        for i in range(6)
    ]
    tx = pd.concat(tx_parts, ignore_index=True)
    del tx_parts

    if account_ids is not None:
        account_ids = set(account_ids)
        tx = tx[tx["account_id"].isin(account_ids)]

    log("VEL — velocity features...")
    vel = build_velocity_features(tx.copy())

    log("NET — network features...")
    net = build_network_features(tx)

    log("BEH — behavioral features...")
    beh = build_behavioral_features(tx.copy())

    log("TMP — temporal features...")
    tmp = build_temporal_features(tx.copy(), accounts)

    log("KYC — KYC / demographic features...")
    kyc = build_kyc_features(accounts, customers, linkage)

    log("RSK — composite / risk features...")
    base = (
        vel
        .merge(net, on="account_id", how="outer")
        .merge(beh, on="account_id", how="outer")
        .merge(tmp, on="account_id", how="outer")
        .merge(kyc, on="account_id", how="outer")
    )
    rsk = build_composite_features(tx, accounts, base, labels, products, linkage)

    features = base.merge(rsk, on="account_id", how="left")

    if account_ids is not None:
        features = features[features["account_id"].isin(account_ids)]

    log(f"Done. Feature matrix: {features.shape[0]:,} accounts × {features.shape[1]-1} features")
    return features.reset_index(drop=True)
