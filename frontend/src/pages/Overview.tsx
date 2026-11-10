import React, { useState, useEffect } from 'react';
import { 
  Users, CreditCard, AlertOctagon, FolderKanban, 
  TrendingUp, ShieldAlert, ArrowUpRight, Clock, CheckCircle2,
  AlertTriangle, DollarSign
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { api } from '../api/client';
import { TierBadge, StatusBadge, SeverityBadge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

interface OverviewProps {
  dateRangeDays: number;
  onNavigate: (tab: string, meta?: any) => void;
}

export const Overview: React.FC<OverviewProps> = ({ dateRangeDays, onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const res = await api.getOverview(dateRangeDays);
        setData(res);
      } catch (err) {
        console.error('Failed to load overview data', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchOverview();
    }
  }, [dateRangeDays, user]);

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 p-4"></div>
          ))}
        </div>
        <div className="h-80 bg-white rounded-2xl border border-slate-200"></div>
      </div>
    );
  }

  const { kpis, charts, recent_activity } = data;

  return (
    <div className="space-y-6">
      {/* Simulation Banner Notice */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-purple-800/40">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-800/60 border border-purple-500/30 text-[11px] font-bold tracking-wide uppercase text-purple-200">
            Case Study Showcase
          </div>
          <h2 className="text-lg font-extrabold tracking-tight">
            Follow the Money: The Bakery That Takes Bets
          </h2>
          <p className="text-xs text-purple-200/90 max-w-2xl leading-relaxed">
            Demonstrating how AEGIS-PAY identifies subtle shifts in payment behaviour (timing, stakes, payer velocity, rapid payouts) when an onboarded retail bakery account is co-opted for illicit wagering collection.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onNavigate('simulation')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            Open Simulation Lab <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monitored Merchants</span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {kpis.total_monitored_merchants}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 font-medium">
            <span className="font-bold text-emerald-600">{kpis.merchants_elevated_risk}</span> elevated risk (Tier &ge; 2)
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transaction Volume</span>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            ₹{kpis.total_transaction_value.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium">
            Across <span className="font-bold text-slate-700">{kpis.total_transactions.toLocaleString()}</span> processed payments
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Risk Alerts</span>
            <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
              <AlertOctagon size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-600">
            {kpis.open_alerts}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 font-medium">
            <span>Cleared rate:</span>
            <span className="font-bold text-emerald-600">{kpis.cleared_alert_rate_percent}%</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Under Investigation</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <FolderKanban size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-600">
            {kpis.open_cases}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium flex items-center gap-1">
            <Clock size={12} className="text-slate-400" />
            Avg review time: <span className="font-bold text-slate-700">{kpis.avg_time_to_first_review_hours}h</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-purple-900 uppercase tracking-wider">
              Simulated Settlement Exposure Under Review
            </div>
            <div className="text-xl font-black text-purple-950 mt-1">
              ₹{kpis.simulated_settlement_exposure_under_review.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-purple-700 mt-0.5">
              Cumulative 48-hour volume on Tier 4/5 accounts pending senior human approval.
            </div>
          </div>
          <div className="p-3 bg-purple-100 rounded-2xl text-purple-800">
            <ShieldAlert size={26} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Graduated Review Escalations
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {kpis.escalated_tier2_plus} Merchants (Tier &ge; 2)
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Subject to targeted merchant inquiries or enhanced portfolio verification.
            </div>
          </div>
          <button
            onClick={() => onNavigate('merchants', { tier: 2 })}
            className="text-xs font-bold text-purple-700 hover:text-purple-900 px-3 py-1.5 rounded-xl border border-purple-300 hover:bg-purple-100 transition"
          >
            View Queue
          </button>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Volume Trend (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Portfolio Transaction Inflow (₹ Daily)</h3>
              <p className="text-xs text-slate-500">Continuous provider-visible payment collections</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              Last {dateRangeDays} Days
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.transaction_trend}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Daily Volume']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="volume" stroke="#7C3AED" strokeWidth={2.5} fillOpacity={1} fill="url(#volGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Tier Distribution (1 col) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Merchant Risk Tier Distribution</h3>
              <span className="text-xs text-slate-500 font-medium">6 Tiers</span>
            </div>
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.tier_distribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {charts.tier_distribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            {charts.tier_distribution.map((t: any) => (
              <div key={t.tier} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="text-slate-600 truncate">{t.label}:</span>
                <span className="font-bold text-slate-900">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Alerts */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <AlertOctagon size={16} className="text-rose-600" />
              Latest Behavioural Alerts
            </h3>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline"
            >
              View All Alerts &rarr;
            </button>
          </div>
          <div className="space-y-3">
            {recent_activity.alerts.map((a: any) => (
              <div
                key={a.id}
                onClick={() => onNavigate('alerts', { selectedAlertId: a.id })}
                className="p-3 rounded-2xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/40 transition cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{a.merchant_name}</span>
                    <TierBadge tier={a.tier} size="sm" />
                    <SeverityBadge severity={a.severity} />
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {a.recommended_next_step}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="font-extrabold text-sm text-slate-800">{a.score} pts</div>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Cases */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FolderKanban size={16} className="text-purple-600" />
              Active Investigation Cases
            </h3>
            <button
              onClick={() => onNavigate('cases')}
              className="text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline"
            >
              View All Cases &rarr;
            </button>
          </div>
          <div className="space-y-3">
            {recent_activity.cases.map((c: any) => (
              <div
                key={c.id}
                onClick={() => onNavigate('cases', { selectedCaseId: c.id })}
                className="p-3 rounded-2xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/40 transition cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-0.5 truncate pr-2">
                  <div className="font-bold text-sm text-slate-900 truncate">{c.title}</div>
                  <div className="text-xs text-slate-500">
                    Merchant: {c.merchant_name} &bull; Assigned to: {c.assigned_to || 'Unassigned'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
