import React, { useState, useEffect } from 'react';
import { BarChart3, Download, PieChart as PieIcon, ShieldAlert, ArrowDownToLine } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [riskDist, setRiskDist] = useState<any[]>([]);
  const [signalsDist, setSignalsDist] = useState<any[]>([]);
  const [caseOutcomes, setCaseOutcomes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const [rd, sd, co] = await Promise.all([
          api.getRiskDistributionReport(),
          api.getAlertsBySignalReport(),
          api.getCaseOutcomesReport(),
        ]);
        setRiskDist(rd);
        setSignalsDist(sd);
        setCaseOutcomes(co);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchReports();
    }
  }, [user]);

  const handleExport = (type: string) => {
    window.location.href = `/api/reports/export/${type}`;
  };

  const colors = ['#10B981', '#0284C7', '#F59E0B', '#EA580C', '#DC2626', '#991B1B'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#008271] text-xs font-bold uppercase tracking-wider">
            <BarChart3 size={16} /> Operational Reporting
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
            Portfolio Behaviour & Review Turnaround
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Export audit-ready CSV reports for risk committee and compliance reviews.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport('risk_summary')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <Download size={14} /> Export Merchants
          </button>
          <button
            onClick={() => handleExport('alerts_summary')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <Download size={14} /> Export Alerts
          </button>
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-sm text-slate-900">Merchants by Risk Tier (0–5)</h3>
            <span className="text-xs text-slate-400">Current Snapshot</span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDist}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#00A375" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts by Signal */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-sm text-slate-900">Alert Triggers by Behavioural Signal</h3>
            <span className="text-xs text-slate-400">Trigger Frequency</span>
          </div>
          <div className="h-60 w-full overflow-y-auto space-y-2 text-xs">
            {signalsDist.map((s) => (
              <div key={s.signal_id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{s.name}</span>
                  <div className="text-[10px] text-slate-400">{s.dimension} &bull; {s.severity}</div>
                </div>
                <span className="font-mono font-bold text-sm text-[#008271] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  {s.trigger_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
