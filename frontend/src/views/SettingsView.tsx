import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings, resetSettings } from '../api';
import { Sliders, Save, CheckCircle, RefreshCw, AlertCircle, RotateCcw, ShieldCheck, Activity } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<any>({
    fan_in_min_cps: 6,
    fan_out_min_cps: 5,
    pass_through_min_ratio: 0.85,
    new_account_max_days: 90,
    risk_critical_threshold: 80,
    risk_high_threshold: 60,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [recalcStats, setRecalcStats] = useState<any | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(res => setSettings(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await updateSettings(settings);
      if (res.stats) {
        setRecalcStats(res.stats);
      }
      setSavedMessage(res.message || 'Thresholds updated successfully in production runtime.');
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all detection engine thresholds to standard baseline defaults?')) {
      return;
    }
    try {
      setResetting(true);
      const res = await resetSettings();
      if (res.settings) {
        setSettings(res.settings);
      }
      if (res.stats) {
        setRecalcStats(res.stats);
      }
      setSavedMessage(res.message || 'Settings reset to defaults.');
    } catch (err: any) {
      alert('Failed to reset settings: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-blue-600">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <span>Detection Engine Thresholds & Parameters</span>
          <span className="px-2 py-0.5 text-[13px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
            Configuration
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Dynamically tune heuristic rules and risk score cutoffs with immediate, persistent impact across all Dashboard analytics, Alerts, and Forensic profiles.
        </p>
      </div>

      {savedMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedMessage}</span>
          </div>
          {recalcStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/80 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-slate-500 block text-[13px] font-semibold uppercase tracking-wider">Suspicious Accts</span>
                <span className="font-bold text-slate-900 text-sm">{recalcStats.suspicious_accounts?.toLocaleString()}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-slate-500 block text-[13px] font-semibold uppercase tracking-wider">Critical Severity</span>
                <span className="font-bold text-rose-600 text-sm">{recalcStats.critical_risk_accounts?.toLocaleString()}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-slate-500 block text-[13px] font-semibold uppercase tracking-wider">Open Alerts</span>
                <span className="font-bold text-amber-600 text-sm">{recalcStats.open_alerts?.toLocaleString()}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-slate-500 block text-[13px] font-semibold uppercase tracking-wider">Telemetry Latency</span>
                <span className="font-bold text-blue-600 text-sm">{recalcStats.elapsed_seconds}s</span>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Pattern 1 & 3: Fan-In/Out & Pass-Through */}
        <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-5 space-y-4 transition-all">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Velocity & Flow Parameters</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Min Incoming Counterparties (Fan-In):
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.fan_in_min_cps}
                onChange={(e) => setSettings({ ...settings, fan_in_min_cps: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition"
              />
              <span className="text-[13px] text-slate-500 mt-1 block">
                Minimum distinct sender counterparties to trigger Fan-In alert.
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Min Outgoing Counterparties (Fan-Out):
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.fan_out_min_cps}
                onChange={(e) => setSettings({ ...settings, fan_out_min_cps: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition"
              />
              <span className="text-[13px] text-slate-500 mt-1 block">
                Minimum distinct recipient counterparties to trigger Fan-Out dispersal.
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Pass-Through Ratio Threshold:
              </label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="2.0"
                value={settings.pass_through_min_ratio}
                onChange={(e) => setSettings({ ...settings, pass_through_min_ratio: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition"
              />
              <span className="text-[13px] text-slate-500 mt-1 block">
                Debit/Credit volume ratio (default 0.85 = 85% of money rapidly dispersed onward).
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                New Account Horizon (Days):
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={settings.new_account_max_days}
                onChange={(e) => setSettings({ ...settings, new_account_max_days: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition"
              />
              <span className="text-[13px] text-slate-500 mt-1 block">
                Accounts opened within this time window are flagged as new.
              </span>
            </div>
          </div>
        </div>

        {/* Risk Thresholds */}
        <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-5 space-y-4 transition-all">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>Alert Severity Score Cutoffs</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Critical Severity Cutoff (0–100):
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.risk_critical_threshold}
                onChange={(e) => setSettings({ ...settings, risk_critical_threshold: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-500/10 focus:outline-none transition"
              />
              <span className="text-[13px] text-slate-500 mt-1 block">
                Accounts with risk score above this value are marked CRITICAL severity.
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                High Severity Cutoff (0–100):
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.risk_high_threshold}
                onChange={(e) => setSettings({ ...settings, risk_high_threshold: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/10 focus:outline-none transition"
              />
              <span className="text-[13px] text-slate-500 mt-1 block">
                Accounts with risk score above this cutoff generate automated alerts.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <button
            type="button"
            disabled={resetting || saving}
            onClick={handleReset}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition hover:shadow-2xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>{resetting ? 'Resetting...' : 'Reset to Baseline Defaults'}</span>
          </button>

          <button
            type="submit"
            disabled={saving || resetting}
            className="w-full sm:w-auto min-h-11 justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[13px] font-semibold flex items-center gap-2 text-center leading-5 shadow-sm hover:shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'Applying & Re-evaluating 40,038 Accounts...' : 'Apply Threshold Updates'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
