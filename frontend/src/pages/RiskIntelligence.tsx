import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Clock, Coins, Users, Zap, Scale, 
  Info, ShieldCheck, AlertCircle, FileCode, CheckCircle2 
} from 'lucide-react';
import { api } from '../api/client';
import { ProvenanceBadge } from '../components/Badge';

export const RiskIntelligence: React.FC = () => {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDimension, setActiveDimension] = useState<string>('all');

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true);
        const res = await api.getRiskSignals();
        setSignals(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSignals();
  }, []);

  const dimensions = [
    { id: 'all', label: 'All Dimensions', icon: Sparkles },
    { id: 'WHEN', label: 'A. WHEN (Timing)', icon: Clock, desc: 'Operating hours, midnight concentrations & sports event alignment' },
    { id: 'HOW MUCH', label: 'B. HOW MUCH (Amounts)', icon: Coins, desc: 'Round denomination staking ratios & ticket size shifts' },
    { id: 'WHO', label: 'C. WHO (Payers)', icon: Users, desc: 'Payer fan-in velocity, repeat customer collapse & cluster bursts' },
    { id: 'HOW FAST', label: 'D. HOW FAST (Settlement)', icon: Zap, desc: 'Provider-visible on-demand payout acceleration post-collection' },
    { id: 'CAPACITY / PLAUSIBILITY', label: 'E. CAPACITY (Plausibility)', icon: Scale, desc: 'Volume excess over peer cohort p95 & baseline surges' },
  ];

  const filteredSignals = activeDimension === 'all' 
    ? signals 
    : signals.filter(s => s.dimension === activeDimension);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-950 to-indigo-950 text-white rounded-3xl p-6 shadow-lg border border-purple-800/40">
        <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles size={16} /> Explainable AI & Quantitative Architecture
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mt-1">
          The 5 Behavioural Dimensions of Merchant Risk
        </h2>
        <p className="text-xs text-purple-200/90 max-w-3xl mt-2 leading-relaxed">
          AEGIS-PAY operates on a transparent, deterministic scoring engine. Every alert is traceable to exact formulas, baseline benchmarks, and orthogonal behavioural dimensions—eliminating black-box accusations and protecting legitimate seasonal merchants.
        </p>
      </div>

      {/* Dimension Switcher Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dimensions.map((dim) => {
          const Icon = dim.icon;
          const isActive = activeDimension === dim.id;
          return (
            <button
              key={dim.id}
              onClick={() => setActiveDimension(dim.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 flex-shrink-0 ${
                isActive
                  ? 'bg-purple-700 text-white shadow-md shadow-purple-700/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <Icon size={15} />
              <span>{dim.label}</span>
            </button>
          );
        })}
      </div>

      {/* Signal Catalog Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-400">Loading risk signals catalog...</div>
        ) : (
          filteredSignals.map((sig) => (
            <div
              key={sig.id}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                    {sig.id}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900">{sig.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <ProvenanceBadge provenance={sig.confidence_label} />
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                    Default Weight: {sig.weight} pts
                  </span>
                </div>
              </div>

              {/* Formula & Calculation Box */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 font-mono text-xs text-slate-800 flex items-start gap-2">
                <FileCode size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">Formula / Algorithm</span>
                  {sig.formula_description}
                </div>
              </div>

              {/* Explanations & False Alarms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-purple-50/50 rounded-2xl border border-purple-100">
                  <span className="font-bold text-purple-950 uppercase tracking-wider text-[10px] block mb-1">
                    Analyst-Facing Rationale
                  </span>
                  <p className="text-slate-700 leading-relaxed">{sig.analyst_explanation}</p>
                </div>

                <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px] block mb-1">
                    Known False-Positive Scenarios
                  </span>
                  <p className="text-slate-700 leading-relaxed italic">{sig.false_positive_notes}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Data Provenance Matrix Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Data Provenance & Assurance Matrix</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-800 block">1. Directly Observed</span>
            <p className="text-slate-500 text-[11px] leading-snug">
              Raw transactions, timestamps, UPI payment methods, and pseudonymous payer tokens captured directly by payment gateway switches.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-800 block">2. Derived Indicators</span>
            <p className="text-slate-500 text-[11px] leading-snug">
              Rolling 30-day baseline deviations, z-scores, night ratios, repeat customer drop ratios, and peer cohort percentiles.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-800 block">3. Merchant-Declared</span>
            <p className="text-slate-500 text-[11px] leading-snug">
              Operating hours, declared monthly capacity, storefront address, and written clarification explanations provided during onboarding or inquiry workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
