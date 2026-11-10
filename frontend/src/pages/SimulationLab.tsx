import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, Play, RotateCcw, AlertTriangle, CheckCircle2, 
  BarChart2, Calculator, ShieldCheck, ArrowRight, Zap, RefreshCw, Sparkles
} from 'lucide-react';
import { api } from '../api/client';
import { TierBadge, StatusBadge, SeverityBadge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

export const SimulationLab: React.FC<{ onNavigate: (tab: string, meta?: any) => void }> = ({ onNavigate }) => {
  const { isAdmin, isReadOnly } = useAuth();
  const [activeTab, setActiveTab] = useState<'scenarios' | 'adversarial' | 'evaluation' | 'prevalence'>('scenarios');

  // Scenarios State
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>('SCENARIO_3_HYBRID_BETTING_FRONT');
  const [observationHours, setObservationHours] = useState<number>(48);
  const [txCountOverride, setTxCountOverride] = useState<number>(100);
  const [runningSim, setRunningSim] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Adversarial State
  const [adversarialTests, setAdversarialTests] = useState<any[]>([]);

  // Evaluation Workbench State
  const [evalData, setEvalData] = useState<any>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [ablationDim, setAblationDim] = useState<string>('');

  // Prevalence Calculator State
  const [population, setPopulation] = useState<number>(100000);
  const [prevalenceRate, setPrevalenceRate] = useState<number>(0.002); // 0.2%
  const [sensitivity, setSensitivity] = useState<number>(0.85); // 85%
  const [fpr, setFpr] = useState<number>(0.02); // 2%
  const [prevalenceResult, setPrevalenceResult] = useState<any>(null);

  // Reset Data Modal
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const initLab = async () => {
      try {
        const scList = await api.getSimulationScenarios();
        setScenarios(scList);
        const advList = await api.getAdversarialTests();
        setAdversarialTests(advList);
      } catch (err) {
        console.error(err);
      }
    };
    initLab();
  }, []);

  // Run Evaluation Workbench
  const fetchEvaluation = async (ablation?: string) => {
    try {
      setEvalLoading(true);
      const res = await api.getSyntheticEvaluation(ablation);
      setEvalData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setEvalLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'evaluation') {
      fetchEvaluation(ablationDim);
    }
  }, [activeTab, ablationDim]);

  // Run Prevalence Calculator
  const runPrevalenceCalc = async () => {
    try {
      const res = await api.calculatePrevalence({
        total_merchants: population,
        prevalence_rate: prevalenceRate,
        sensitivity,
        false_positive_rate: fpr,
      });
      setPrevalenceResult(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'prevalence') {
      runPrevalenceCalc();
    }
  }, [activeTab, population, prevalenceRate, sensitivity, fpr]);

  const handleRunSimulation = async () => {
    if (isReadOnly) return;
    try {
      setRunningSim(true);
      const res = await api.runSimulation({
        scenario_key: selectedScenarioKey,
        observation_hours: observationHours,
        transaction_count: txCountOverride,
      });
      setSimResult(res);
    } catch (err: any) {
      alert(err.message || 'Simulation run failed');
    } finally {
      setRunningSim(false);
    }
  };

  const handleResetData = async () => {
    if (!isAdmin) {
      alert('Admin role required to reset demo data.');
      return;
    }
    if (!confirm('Reset demo database to pristine seeded state? All simulated runs will be cleared.')) return;
    try {
      setResetting(true);
      await api.resetDemoData();
      alert('Demo data successfully restored to pristine state!');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#002225] via-[#00383D] to-[#001D20] text-white rounded-3xl p-6 shadow-lg border border-[#004D54] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#00FE89] text-xs font-bold uppercase tracking-wider">
            <FlaskConical size={16} /> Synthetic Evaluation & Anomaly Injection Lab
          </div>
          <h2 className="text-xl font-extrabold tracking-tight mt-1">
            Simulation Lab & Model Evaluation Workbench
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
            Test how the risk engine detects laundering typologies, handles festive seasonality surges, protects legitimate merchants, and performs under Bayesian sparse-crime conditions.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleResetData}
            disabled={resetting}
            className="px-4 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 flex-shrink-0"
            title="Reset demo data to clean seeded state"
          >
            <RotateCcw size={14} /> {resetting ? 'Resetting...' : 'Reset Demo Data'}
          </button>
        )}
      </div>

      {/* Lab Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1 gap-1 text-xs font-bold shadow-xs">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'scenarios' ? 'bg-[#00383D] text-[#00FE89] border border-[#005C63] shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Play size={14} /> 1. Five Synthetic Scenarios
        </button>
        <button
          onClick={() => setActiveTab('adversarial')}
          className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'adversarial' ? 'bg-[#00383D] text-[#00FE89] border border-[#005C63] shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap size={14} /> 2. Adversarial & False-Positive Tests
        </button>
        <button
          onClick={() => setActiveTab('evaluation')}
          className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'evaluation' ? 'bg-[#00383D] text-[#00FE89] border border-[#005C63] shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart2 size={14} /> 3. Evaluation Metrics & Ablation
        </button>
        <button
          onClick={() => setActiveTab('prevalence')}
          className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'prevalence' ? 'bg-[#00383D] text-[#00FE89] border border-[#005C63] shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calculator size={14} /> 4. Rare-Event Prevalence Calculator
        </button>
      </div>

      {/* TAB 1: 5 SCENARIOS RUNNER */}
      {activeTab === 'scenarios' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900">Select Synthetic Scenario</h3>

            <div className="space-y-2">
              {scenarios.map((sc) => {
                const isSelected = selectedScenarioKey === sc.key;
                return (
                  <div
                    key={sc.key}
                    onClick={() => setSelectedScenarioKey(sc.key)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-[#00C48C] bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{sc.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {sc.expected_tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">{sc.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Runner Parameters */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Observation Window:</label>
                  <select
                    value={observationHours}
                    onChange={(e) => setObservationHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value={24}>Last 24 Hours</option>
                    <option value={48}>Last 48 Hours</option>
                    <option value={72}>Last 72 Hours</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Generated Tx Count:</label>
                  <input
                    type="number"
                    value={txCountOverride}
                    onChange={(e) => setTxCountOverride(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              <button
                onClick={handleRunSimulation}
                disabled={runningSim || isReadOnly}
                className="w-full py-3 bg-[#00383D] hover:bg-[#004D54] text-[#00FE89] font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-40 border border-[#005C63]"
              >
                {runningSim ? (
                  <>Running Simulation...</>
                ) : (
                  <>
                    <Play size={15} /> Inject Anomaly & Recalculate Risk
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Outcome / Score Diff (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            {simResult ? (
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                    <CheckCircle2 size={13} /> Simulation Run {simResult.run_id} Completed
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-2">
                    Scenario Outcome: {simResult.scenario.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target Merchant: <strong>{simResult.merchant_name}</strong> ({simResult.merchant_id}) &bull; {simResult.generated_transactions} synthetic transactions injected.
                  </p>
                </div>

                {/* Before / After Comparison Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Before Simulation</span>
                    <div className="text-3xl font-black text-slate-700 font-mono mt-1">
                      {simResult.before.score}
                    </div>
                    <div className="mt-2">
                      <TierBadge tier={simResult.before.tier} label={simResult.before.tier_label} size="sm" />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-[#008271] uppercase tracking-wider">After Recalculation</span>
                    <div className="text-3xl font-black text-[#00383D] font-mono mt-1">
                      {simResult.after.score}
                    </div>
                    <div className="mt-2">
                      <TierBadge tier={simResult.after.tier} label={simResult.after.tier_label} size="sm" />
                    </div>
                  </div>
                </div>

                {/* Policy Recommendation Action */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Triggered Policy Response
                  </span>
                  <p className="text-xs font-bold text-slate-900">
                    {simResult.after.tier_action}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-snug">
                    {simResult.after.reason_summary}
                  </p>
                </div>

                {/* Triggered Signals in Simulation */}
                <div>
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2">
                    Triggered Behavioural Signals ({simResult.after.signals.filter((s: any) => s.triggered).length})
                  </h4>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {simResult.after.signals.filter((s: any) => s.triggered).map((sig: any) => (
                      <div key={sig.id} className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">{sig.name}</span>
                        <span className="font-mono font-bold text-rose-700">+{sig.contribution} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onNavigate('merchants', { selectedMerchantId: simResult.merchant_id })}
                    className="text-xs font-bold text-[#008271] hover:text-[#005C51] underline"
                  >
                    View Merchant Profile Details &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-32 text-center text-slate-400 text-xs">
                Select a scenario and click <strong>"Inject Anomaly & Recalculate Risk"</strong> to simulate.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ADVERSARIAL & FALSE-POSITIVE TESTS */}
      {activeTab === 'adversarial' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900">
              Adversarial Attacks & False-Positive Stress Tests
            </h3>
            <p className="text-xs text-slate-500">
              Demonstrates engine robustness against evasion techniques (small ticket smurfing) and legitimate business spikes (viral promos, wedding cakes, midnight kiosks).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adversarialTests.map((t) => (
              <div key={t.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#008271]">{t.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.synthetic_ground_truth === 'Legitimate' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}>
                    Ground Truth: {t.synthetic_ground_truth}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{t.name}</h4>
                <p className="text-xs text-slate-600 leading-snug">{t.description}</p>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-emerald-950 font-medium">
                  <strong>Expected Engine Response:</strong> {t.expected_outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: EVALUATION METRICS & ABLATION */}
      {activeTab === 'evaluation' && (
        <div className="space-y-6">
          {/* Disclaimer Banner */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 text-xs font-semibold">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            <span>
              <strong>Synthetic simulation results — not validated real-world performance.</strong> Metrics calculated dynamically across labelled test dataset.
            </span>
          </div>

          {evalLoading || !evalData ? (
            <div className="py-24 text-center text-slate-400">Computing benchmark evaluation...</div>
          ) : (
            <>
              {/* Performance Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-xs">
                  <span className="text-xs font-bold text-slate-400 uppercase">Precision (PPV)</span>
                  <div className="text-3xl font-black text-[#00383D] font-mono mt-1">
                    {(evalData.performance_rates.precision * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-xs">
                  <span className="text-xs font-bold text-slate-400 uppercase">Recall (Sensitivity)</span>
                  <div className="text-3xl font-black text-emerald-600 font-mono mt-1">
                    {(evalData.performance_rates.recall * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-xs">
                  <span className="text-xs font-bold text-slate-400 uppercase">F1-Score</span>
                  <div className="text-3xl font-black text-[#008271] font-mono mt-1">
                    {evalData.performance_rates.f1_score.toFixed(3)}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-xs">
                  <span className="text-xs font-bold text-slate-400 uppercase">Festive Escalation Rate</span>
                  <div className="text-3xl font-black text-slate-900 font-mono mt-1">
                    {(evalData.performance_rates.festive_merchant_escalation_rate * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Low false alarm on holidays</div>
                </div>
              </div>

              {/* Confusion Matrix Table */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-extrabold text-sm text-slate-900 mb-4">
                  Synthetic Confusion Matrix (Total Evaluated: {evalData.sample_size})
                </h3>
                <div className="max-w-md mx-auto grid grid-cols-2 gap-3 text-center">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase">True Positives (TP)</span>
                    <div className="text-2xl font-black text-emerald-950 font-mono mt-1">
                      {evalData.confusion_matrix.true_positives}
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-1">Illicit fronts correctly escalated</div>
                  </div>

                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200">
                    <span className="text-[11px] font-bold text-rose-800 uppercase">False Positives (FP)</span>
                    <div className="text-2xl font-black text-rose-950 font-mono mt-1">
                      {evalData.confusion_matrix.false_positives}
                    </div>
                    <div className="text-[10px] text-rose-700 mt-1">Good merchants misclassified</div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                    <span className="text-[11px] font-bold text-amber-800 uppercase">False Negatives (FN)</span>
                    <div className="text-2xl font-black text-amber-950 font-mono mt-1">
                      {evalData.confusion_matrix.false_negatives}
                    </div>
                    <div className="text-[10px] text-amber-700 mt-1">Illicit fronts missed</div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 uppercase">True Negatives (TN)</span>
                    <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                      {evalData.confusion_matrix.true_negatives}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Good merchants kept normal</div>
                  </div>
                </div>
              </div>

              {/* Signal Ablation Comparison */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-extrabold text-sm text-slate-900 mb-2">
                  Signal Ablation Comparison
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Evaluating model performance impact when individual orthogonal behavioural dimensions are deactivated.
                </p>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  {evalData.ablation_comparison.map((ab: any, idx: number) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <span className="font-bold text-slate-800">{ab.dimension}</span>
                      <div className="flex gap-4 font-mono font-semibold">
                        <span>Precision: {ab.precision}</span>
                        <span>Recall: {ab.recall}</span>
                        <span className="font-bold text-[#008271]">F1: {ab.f1_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: RARE-EVENT PREVALENCE CALCULATOR */}
      {activeTab === 'prevalence' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Interactive Rare-Event Prevalence Calculator (Bayesian Base-Rate Fallacy)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Demonstrates why a 90% accurate model in a sparse-crime environment still generates high numbers of false alerts—proving the absolute necessity of graduated targeted queries and human governance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Total Merchant Population:</label>
              <input
                type="number"
                value={population}
                onChange={(e) => setPopulation(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Laundering Prevalence ({Math.round(prevalenceRate * 1000) / 10}%):
              </label>
              <input
                type="range"
                min={0.0005}
                max={0.05}
                step={0.0005}
                value={prevalenceRate}
                onChange={(e) => setPrevalenceRate(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#00C48C]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Sensitivity / Detection ({Math.round(sensitivity * 100)}%):
              </label>
              <input
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#00C48C]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                False Positive Rate ({Math.round(fpr * 1000) / 10}%):
              </label>
              <input
                type="range"
                min={0.005}
                max={0.1}
                step={0.005}
                value={fpr}
                onChange={(e) => setFpr(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#00C48C]"
              />
            </div>
          </div>

          {prevalenceResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                  <span className="text-[11px] font-bold text-emerald-950 uppercase">Total Flagged for Review</span>
                  <div className="text-3xl font-black text-[#00383D] font-mono mt-1">
                    {prevalenceResult.outcomes.total_flagged_for_review.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#008271] mt-1">
                    {prevalenceResult.outcomes.true_positives.toLocaleString()} True + {prevalenceResult.outcomes.false_positives.toLocaleString()} False
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-center">
                  <span className="text-[11px] font-bold text-amber-900 uppercase">False Discovery Rate</span>
                  <div className="text-3xl font-black text-amber-950 font-mono mt-1">
                    {prevalenceResult.outcomes.false_discovery_rate_percent}%
                  </div>
                  <div className="text-[10px] text-amber-700 mt-1">Of all alerts are good merchants</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[11px] font-bold text-slate-700 uppercase">Positive Predictive Value (PPV)</span>
                  <div className="text-3xl font-black text-slate-900 font-mono mt-1">
                    {prevalenceResult.outcomes.precision_ppv_percent}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Actual precision in live portfolio</div>
                </div>
              </div>

              {/* Takeaway Box */}
              <div className="p-4 bg-[#002225] border border-[#004D54] text-white rounded-2xl shadow-sm text-xs leading-relaxed flex items-start gap-3">
                <ShieldCheck size={20} className="text-[#00FE89] flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5 text-[#00FE89]">Analyst & Platform Takeaway</span>
                  {prevalenceResult.analyst_takeaway}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
