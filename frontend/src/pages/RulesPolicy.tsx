import React, { useState, useEffect } from 'react';
import { 
  Sliders, Save, RotateCcw, AlertTriangle, ShieldCheck, 
  History, Info, CheckCircle2 
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const RulesPolicy: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [signals, setSignals] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [newVersionName, setNewVersionName] = useState('v1.1.0');
  const [changeRationale, setChangeRationale] = useState('');
  const [saving, setSaving] = useState(false);
  const [rollbackRationale, setRollbackRationale] = useState('');

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const cfg = await api.getRiskConfig();
      setConfig(cfg);
      setWeights(cfg.weights);
      setThresholds(cfg.thresholds);

      const sigs = await api.getRiskSignals();
      setSignals(sigs);

      const vList = await api.getRiskConfigVersions();
      setVersions(vList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleWeightChange = (sigId: string, val: number) => {
    setWeights(prev => ({ ...prev, [sigId]: val }));
  };

  const handleThresholdChange = (sigId: string, val: number) => {
    setThresholds(prev => ({ ...prev, [sigId]: val }));
  };

  const handleSavePolicy = async () => {
    if (!changeRationale.trim() || changeRationale.trim().length < 10) {
      alert('A detailed rationale of at least 10 characters is required for auditing policy changes.');
      return;
    }
    try {
      setSaving(true);
      await api.updateRiskConfig({
        version: newVersionName,
        weights,
        thresholds,
        change_rationale: changeRationale,
      });
      alert(`Policy version ${newVersionName} successfully deployed!`);
      setChangeRationale('');
      fetchConfig();
    } catch (err: any) {
      alert(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (targetVersion: string) => {
    const reason = prompt(`Confirm rollback to version ${targetVersion}? Provide a mandatory audit rationale:`);
    if (!reason) return;
    try {
      await api.rollbackRiskConfig({
        target_version: targetVersion,
        rationale: reason,
      });
      alert(`Policy successfully rolled back to ${targetVersion}!`);
      fetchConfig();
    } catch (err: any) {
      alert(err.message || 'Rollback failed');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertTriangle className="mx-auto text-amber-500 mb-3" size={32} />
        <h3 className="font-extrabold text-base text-slate-900">Admin Permissions Required</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Policy rules, weights, and tier thresholds are restricted to platform Administrators. Please switch role to <strong>Ananya Sharma (Admin)</strong> using the top-right profile switcher.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#008271] text-xs font-bold uppercase tracking-wider">
            <Sliders size={16} /> Admin Governance Console
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
            Rules, Weights & Tier Calibration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Active Version: <span className="font-mono font-bold text-[#008271]">{config?.version || 'v1.0.0'}</span> &bull; Last updated by {config?.created_by}
          </p>
        </div>

        <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl px-3 py-2 text-xs font-medium max-w-sm">
          <strong>Illustrative demo defaults:</strong> Weights and thresholds require calibration on real, authorised data.
        </div>
      </div>

      {/* Signals Weight & Threshold Configurator */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900">Active Risk Signal Configuration</h3>
          <span className="text-xs text-slate-400">Total 10 Signals</span>
        </div>

        <div className="divide-y divide-slate-100">
          {signals.map((sig) => {
            const currentWeight = weights[sig.id] ?? sig.weight;
            const currentThreshold = thresholds[sig.id] ?? sig.threshold;
            return (
              <div key={sig.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#008271]">{sig.id}</span>
                    <h4 className="font-bold text-xs text-slate-900">{sig.name}</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{sig.formula_description}</p>
                </div>

                <div className="flex items-center gap-6">
                  {/* Weight Slider */}
                  <div className="w-44">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>Weight:</span>
                      <span className="font-mono font-bold text-[#008271]">{currentWeight} pts</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={250}
                      step={5}
                      value={currentWeight}
                      onChange={(e) => handleWeightChange(sig.id, Number(e.target.value))}
                      className="w-full cursor-pointer accent-[#00C48C]"
                    />
                  </div>

                  {/* Threshold Input */}
                  <div className="w-32">
                    <div className="text-[11px] font-semibold text-slate-700 mb-1">Threshold:</div>
                    <input
                      type="number"
                      step={0.05}
                      value={currentThreshold}
                      onChange={(e) => handleThresholdChange(sig.id, Number(e.target.value))}
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Version Form */}
        <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 pt-4">
          <div className="font-bold text-xs text-emerald-950 uppercase tracking-wider">
            Deploy Policy Revision (Audit Recorded)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">New Version Tag:</label>
              <input
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#00C48C]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Mandatory Change Rationale:</label>
              <input
                type="text"
                placeholder="Explain why weights or thresholds were modified (e.g. tuned night spike threshold)..."
                value={changeRationale}
                onChange={(e) => setChangeRationale(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-[#00C48C]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePolicy}
              disabled={saving || changeRationale.trim().length < 10}
              className="px-5 py-2.5 bg-[#00383D] hover:bg-[#004D54] text-[#00FE89] font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-40 border border-[#005C63]"
            >
              <Save size={15} /> {saving ? 'Deploying...' : 'Deploy New Version'}
            </button>
          </div>
        </div>
      </div>

      {/* Version History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-extrabold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <History size={16} className="text-[#008271]" /> Configuration Version History
        </h3>

        <div className="divide-y divide-slate-100">
          {versions.map((v) => (
            <div key={v.version} className="py-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono font-bold text-[#008271] mr-2">{v.version}</span>
                <span className="text-slate-700">{v.change_rationale}</span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Created by {v.created_by} &bull; {v.created_at}
                </div>
              </div>
              <button
                onClick={() => handleRollback(v.version)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
              >
                Rollback
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
