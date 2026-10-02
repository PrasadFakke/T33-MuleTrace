"""
Mule Account Detection — LightGBM Training Pipeline
RBI Innovation Hub

Trains a LightGBM classifier on the 31-feature matrix produced by Day 2.
Handles class imbalance via scale_pos_weight. Saves model, predictions,
and a SHAP summary for downstream explainability.

Usage (from repo root):
    python src/models/train.py
"""

import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score, average_precision_score
from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

# Config

FEAT_DIR  = Path("data/features")
MODEL_DIR = Path("models")
PRED_DIR  = Path("data/predictions")

# Features excluded due to data leakage:
#   branch_mule_rate  — computed including own label (target encoding leakage)
#   frozen_account_flag — set POST detection, not pre-detection signal
LEAKED_FEATURES = ["branch_mule_rate", "frozen_account_flag"]

LGBM_PARAMS = {
    "objective"       : "binary",
    "metric"          : "auc",
    "n_estimators"    : 1000,
    "learning_rate"   : 0.05,
    "num_leaves"      : 31,
    "max_depth"       : 6,
    "min_child_samples": 20,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq"    : 5,
    "reg_alpha"       : 0.1,
    "reg_lambda"      : 0.1,
    "random_state"    : 42,
    "verbose"         : -1,
    "n_jobs"          : -1,
}

N_FOLDS    = 5
EARLY_STOP = 50
SEED       = 42


# Data Loading

def load_data():
    train = pd.read_csv(FEAT_DIR / "feature_matrix_train.csv")
    test  = pd.read_csv(FEAT_DIR / "feature_matrix_test.csv")
    meds  = pd.read_csv(FEAT_DIR / "feature_medians.csv", index_col=0).squeeze()

    feat_cols = [c for c in train.columns
                 if c not in ["account_id", "is_mule"] + LEAKED_FEATURES]

    X_train = train[feat_cols].fillna(meds.reindex(feat_cols))
    y_train = train["is_mule"].astype(int)
    X_test  = test[feat_cols].fillna(meds.reindex(feat_cols))
    ids     = test["account_id"]

    return X_train, y_train, X_test, ids, feat_cols


# Training

def train_cv(X, y, params, n_folds=N_FOLDS, early_stop=EARLY_STOP):
    """
    Stratified K-fold CV with early stopping per fold.
    Returns OOF predictions, per-fold models, and AUC scores.
    """
    cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=SEED)
    oof_preds  = np.zeros(len(y))
    fold_aucs  = []
    fold_models = []

    neg, pos = (y == 0).sum(), (y == 1).sum()
    scale_pos = neg / pos

    for fold, (tr_idx, val_idx) in enumerate(cv.split(X, y)):
        X_tr, X_val = X.iloc[tr_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[tr_idx], y.iloc[val_idx]

        model = lgb.LGBMClassifier(**params, scale_pos_weight=scale_pos)
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_val, y_val)],
            callbacks=[
                lgb.early_stopping(early_stop, verbose=False),
                lgb.log_evaluation(period=-1),
            ],
        )

        val_pred = model.predict_proba(X_val)[:, 1]
        oof_preds[val_idx] = val_pred
        auc = roc_auc_score(y_val, val_pred)
        fold_aucs.append(auc)
        fold_models.append(model)
        print(f"  Fold {fold+1}/{n_folds} — AUC {auc:.4f}  "
              f"(best iter: {model.best_iteration_})")

    print(f"\n  OOF AUC : {roc_auc_score(y, oof_preds):.4f}")
    print(f"  Mean ± SD: {np.mean(fold_aucs):.4f} ± {np.std(fold_aucs):.4f}")
    return oof_preds, fold_models, fold_aucs


def train_final(X, y, params, n_iter):
    """Train a single model on the full training set."""
    neg, pos = (y == 0).sum(), (y == 1).sum()
    model = lgb.LGBMClassifier(**params, scale_pos_weight=neg/pos, n_estimators=n_iter)
    model.fit(X, y, callbacks=[lgb.log_evaluation(period=-1)])
    return model


# Threshold Optimisation

def find_best_threshold(y_true, y_prob, metric="f1"):
    """Sweep probability thresholds and return the one maximising F1."""
    from sklearn.metrics import f1_score, precision_score, recall_score
    best_thresh, best_score = 0.5, 0.0
    for t in np.arange(0.05, 0.95, 0.01):
        preds = (y_prob >= t).astype(int)
        score = f1_score(y_true, preds, zero_division=0)
        if score > best_score:
            best_score, best_thresh = score, t
    return best_thresh, best_score


# Main

def main():
    MODEL_DIR.mkdir(exist_ok=True)
    PRED_DIR.mkdir(exist_ok=True)

    print("Loading feature matrices...")
    X_train, y_train, X_test, test_ids, feat_cols = load_data()
    print(f"  Train: {X_train.shape}  |  Mules: {y_train.sum()} ({100*y_train.mean():.2f}%)")
    print(f"  Test : {X_test.shape}")

    print(f"\nTraining LightGBM — {N_FOLDS}-fold stratified CV...")
    oof_preds, fold_models, fold_aucs = train_cv(X_train, y_train, LGBM_PARAMS)

    best_fold_iter = int(np.mean([m.best_iteration_ for m in fold_models]))
    print(f"\nAverage best iteration across folds: {best_fold_iter}")

    print("\nTraining final model on full training set...")
    final_model = train_final(X_train, y_train, LGBM_PARAMS, best_fold_iter)

    print("\nGenerating test predictions (ensemble of fold models)...")
    test_preds = np.mean(
        [m.predict_proba(X_test)[:, 1] for m in fold_models], axis=0
    )

    # Threshold optimisation on OOF predictions
    best_thresh, best_f1 = find_best_threshold(y_train, oof_preds)
    print(f"\nOptimal threshold (max F1): {best_thresh:.2f} — OOF F1: {best_f1:.4f}")

    # PR-AUC on OOF
    pr_auc = average_precision_score(y_train, oof_preds)
    print(f"OOF PR-AUC (avg precision): {pr_auc:.4f}")

    # Save model
    final_model.booster_.save_model(str(MODEL_DIR / "lgbm_mule_detector.txt"))
    print(f"\nModel saved → {MODEL_DIR}/lgbm_mule_detector.txt")

    # Save OOF predictions (used in notebook for plots)
    pd.DataFrame({
        "account_id"  : X_train.index,
        "oof_prob"    : oof_preds,
        "is_mule"     : y_train.values,
    }).to_csv(PRED_DIR / "oof_predictions.csv", index=False)

    # Save test predictions
    pd.DataFrame({
        "account_id"  : test_ids.values,
        "mule_probability": test_preds,
    }).to_csv(PRED_DIR / "test_predictions_raw.csv", index=False)
    print(f"Predictions saved → {PRED_DIR}/")

    return final_model, oof_preds, test_preds, feat_cols, fold_models


if __name__ == "__main__":
    main()
