import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, ArrowUpDown, ChevronRight, X, 
  Store, Clock, Calendar, ShieldCheck, AlertTriangle, 
  TrendingUp, Users, ExternalLink, RefreshCw, Send, FileText
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line 
} from 'recharts';
import { api } from '../api/client';
import { TierBadge, StatusBadge, SeverityBadge, ProvenanceBadge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

interface MerchantsProps {
  initialMerchantId?: string;
  onNavigate: (tab: string, meta?: any) => void;
}

export const Merchants: React.FC<MerchantsProps> = ({ initialMerchantId, onNavigate }) => {
  const { isReadOnly } = useAuth();
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('score_desc');

  // Detail Modal / Drawer
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(initialMerchantId || null);
  const [merchantDetail, setMerchantDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [profileTab, setProfileTab] = useState<'overview' | 'signals' | 'behaviour' | 'settlement' | 'cases' | 'audit'>('overview');

  // Fetch list
  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: 10,
        sort_by: sortBy,
      };
      if (search) params.search = search;
      if (tierFilter !== 'all') params.tier = Number(tierFilter);
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const res = await api.getMerchants(params);
      setMerchants(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load merchants', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, [page, tierFilter, categoryFilter, sortBy]);

  // Load merchant detail
  useEffect(() => {
    if (!selectedMerchantId) {
      setMerchantDetail(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const detail = await api.getMerchantDetail(selectedMerchantId);
        setMerchantDetail(detail);
      } catch (err) {
        console.error('Failed to fetch merchant profile', err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedMerchantId]);

  const handleExportCsv = () => {
    window.location.href = `/api/merchants/export?${tierFilter !== 'all' ? `tier=${tierFilter}&` : ''}${categoryFilter !== 'all' ? `category=${categoryFilter}&` : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search by name, ID or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchMerchants(); } }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-sm text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600 focus:bg-white transition"
            />
          </div>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="all">All Tiers (0–5)</option>
            <option value="0">Tier 0: Standard (0-250)</option>
            <option value="1">Tier 1: Passive (251-500)</option>
            <option value="2">Tier 2: Targeted Query (501-700)</option>
            <option value="3">Tier 3: Enhanced Review (701-850)</option>
            <option value="4">Tier 4: Senior Review (851-950)</option>
            <option value="5">Tier 5: Compliance Decision (951-1000)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer hidden sm:block"
          >
            <option value="all">All Categories</option>
            <option value="Bakeries">Bakeries</option>
            <option value="Restaurants">Restaurants & Cafes</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Sorting */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="score_desc">Risk Score: Highest First</option>
            <option value="score_asc">Risk Score: Lowest First</option>
            <option value="name_asc">Merchant Name (A-Z)</option>
            <option value="date_desc">Newest Onboarded</option>
          </select>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            title="Export filtered merchants to CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Merchant Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Merchant ID & Name</th>
                <th className="py-3.5 px-4">Category & Location</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Risk Score</th>
                <th className="py-3.5 px-4">Current Risk Tier</th>
                <th className="py-3.5 px-4">Total Inflow</th>
                <th className="py-3.5 px-4">Open Alerts</th>
                <th className="py-3.5 px-4">Assigned Analyst</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading monitored merchants...
                  </td>
                </tr>
              ) : merchants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No merchants matching the selected criteria.
                  </td>
                </tr>
              ) : (
                merchants.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedMerchantId(m.id)}
                    className="hover:bg-purple-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-purple-700">{m.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{m.id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{m.business_category}</div>
                      <div className="text-[11px] text-slate-500">{m.city}, {m.region}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        m.account_status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        m.account_status === 'Under Review' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {m.account_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-sm">
                      <span className={m.current_risk_score > 700 ? 'text-rose-600 font-extrabold' : 'text-slate-900'}>
                        {m.current_risk_score}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal"> / 1000</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <TierBadge tier={m.current_risk_tier} label={m.tier_label} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">₹{(m.transaction_volume || 0).toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-400">{m.transaction_count || 0} txs</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {(m.open_alerts_count || 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                          {m.open_alerts_count} open
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {m.assigned_analyst_name || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-purple-600 hover:text-purple-800 font-bold p-1 rounded-lg hover:bg-purple-100 transition">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800">{merchants.length}</span> of{' '}
            <span className="font-bold text-slate-800">{total}</span> monitored merchants
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-semibold text-slate-700">Page {page}</span>
            <button
              disabled={page * 10 >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Full Merchant Profile Drawer / Modal (14 Sections) */}
      {selectedMerchantId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Store size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-slate-900">
                      {merchantDetail?.merchant.name || selectedMerchantId}
                    </h2>
                    {merchantDetail && (
                      <TierBadge tier={merchantDetail.merchant.current_risk_tier} size="sm" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    ID: {selectedMerchantId} &bull; Legal: {merchantDetail?.merchant.legal_name || '...'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMerchantId(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Profile Tab Navigation */}
            <div className="flex border-b border-slate-200 px-6 bg-white gap-2 overflow-x-auto text-xs font-semibold">
              <button
                onClick={() => setProfileTab('overview')}
                className={`py-3 px-3 border-b-2 transition ${
                  profileTab === 'overview' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Declared Profile & Overview
              </button>
              <button
                onClick={() => setProfileTab('signals')}
                className={`py-3 px-3 border-b-2 transition ${
                  profileTab === 'signals' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Explainable Risk Signals ({merchantDetail?.live_risk_evaluation.triggered_count || 0})
              </button>
              <button
                onClick={() => setProfileTab('behaviour')}
                className={`py-3 px-3 border-b-2 transition ${
                  profileTab === 'behaviour' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. Timing, Tickets & Payers
              </button>
              <button
                onClick={() => setProfileTab('settlement')}
                className={`py-3 px-3 border-b-2 transition ${
                  profileTab === 'settlement' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                4. Provider-Visible Settlements
              </button>
              <button
                onClick={() => setProfileTab('cases')}
                className={`py-3 px-3 border-b-2 transition ${
                  profileTab === 'cases' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                5. Alerts & Inquiries ({merchantDetail?.requests.length || 0})
              </button>
              <button
                onClick={() => setProfileTab('audit')}
                className={`py-3 px-3 border-b-2 transition ${
                  profileTab === 'audit' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                6. Audit History
              </button>
            </div>

            {/* Profile Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail || !merchantDetail ? (
                <div className="py-20 text-center text-slate-400 animate-pulse">
                  Loading comprehensive merchant profile...
                </div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW & DECLARED PROFILE */}
                  {profileTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Risk Score Summary Banner */}
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase font-bold text-slate-400">Current Quantitative Score</div>
                          <div className="text-3xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
                            <span>{merchantDetail.merchant.current_risk_score}</span>
                            <span className="text-sm font-normal text-slate-400">/ 1000</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 max-w-lg leading-relaxed">
                            {merchantDetail.live_risk_evaluation.reason_summary}
                          </p>
                        </div>
                        <div className="text-right">
                          <TierBadge tier={merchantDetail.merchant.current_risk_tier} size="lg" />
                          <div className="text-xs font-semibold text-slate-500 mt-2">
                            Policy action: {merchantDetail.merchant.tier_action}
                          </div>
                        </div>
                      </div>

                      {/* Declared Business Profile (Labeled Merchant-Declared) */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                          <h3 className="font-bold text-slate-900 text-sm">Declared Onboarding Profile</h3>
                          <ProvenanceBadge provenance="Merchant-declared" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block font-medium">Category / Subcategory</span>
                            <span className="font-bold text-slate-800">{merchantDetail.merchant.business_category} &bull; {merchantDetail.merchant.subcategory}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Declared Operating Hours</span>
                            <span className="font-bold text-slate-800">{merchantDetail.merchant.declared_operating_hours}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Declared Monthly Volume</span>
                            <span className="font-bold text-slate-800">₹{(merchantDetail.merchant.declared_monthly_volume || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Registered GST & PAN</span>
                            <span className="font-bold text-slate-800 font-mono">{merchantDetail.profile.gst_number_masked} / {merchantDetail.profile.pan_masked}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Registered Address</span>
                            <span className="font-bold text-slate-800">{merchantDetail.profile.registered_address}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Settlement Bank</span>
                            <span className="font-bold text-slate-800">{merchantDetail.profile.settlement_bank_name} ({merchantDetail.profile.settlement_account_masked})</span>
                          </div>
                        </div>
                      </div>

                      {/* Peer Cohort Baseline Benchmark */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">Peer Cohort Benchmark Comparison</h3>
                            <div className="text-xs text-slate-500">{merchantDetail.cohort.cohort_name}</div>
                          </div>
                          <ProvenanceBadge provenance="Derived (Aggregated Peer Norms)" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block font-medium">Cohort Avg Ticket</span>
                            <span className="text-sm font-bold text-slate-900">₹{merchantDetail.cohort.avg_ticket} &plusmn; ₹{merchantDetail.cohort.std_ticket}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block font-medium">Cohort Expected Night Ratio</span>
                            <span className="text-sm font-bold text-slate-900">{roundPercent(merchantDetail.cohort.avg_night_ratio)}%</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block font-medium">Cohort P95 Daily Volume</span>
                            <span className="text-sm font-bold text-slate-900">₹{merchantDetail.cohort.p95_daily_volume.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block font-medium">Seasonal Calendar Context</span>
                            <span className="text-xs font-bold text-purple-700">{merchantDetail.calendar_context.context_note}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: EXPLAINABLE SIGNALS */}
                  {profileTab === 'signals' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">Deterministic Signal Explanations</h3>
                          <div className="text-xs text-slate-500">
                            Every component score, threshold, observed value, and known false-positive condition
                          </div>
                        </div>
                        <ProvenanceBadge provenance="Model Inference (Weighted Rules)" />
                      </div>

                      <div className="space-y-3">
                        {merchantDetail.live_risk_evaluation.signals.map((sig: any) => (
                          <div
                            key={sig.id}
                            className={`p-4 rounded-2xl border transition ${
                              sig.triggered
                                ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                                : 'bg-slate-50/60 border-slate-200 opacity-80'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${sig.triggered ? 'bg-rose-600 animate-pulse' : 'bg-slate-300'}`} />
                                <span className="font-bold text-sm text-slate-900">{sig.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {sig.dimension}
                                </span>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <ProvenanceBadge provenance={sig.confidence_label} />
                                <span className="font-bold text-sm text-slate-900 font-mono">
                                  +{sig.contribution} pts
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                              {sig.analyst_explanation}
                            </p>

                            <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-slate-400 block text-[11px]">Observed in 48h Window</span>
                                <span className="font-bold text-slate-800">{sig.observed_display}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[11px]">Baseline Benchmark</span>
                                <span className="font-semibold text-slate-600">{sig.baseline_display}</span>
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                <span className="text-slate-400 block text-[11px]">False-Positive Context</span>
                                <span className="text-slate-500 italic text-[11px] leading-tight block">{sig.false_positive_notes}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: BEHAVIOURAL CHARTS */}
                  {profileTab === 'behaviour' && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                          <h3 className="font-bold text-slate-900 text-sm">Hour-of-Day Transaction Concentration</h3>
                          <ProvenanceBadge provenance="Directly Observed" />
                        </div>
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={merchantDetail.behaviour_charts.hour_of_day}>
                              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip contentStyle={{ borderRadius: '12px' }} />
                              <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                            <h3 className="font-bold text-slate-900 text-sm">Day-of-Week Distribution</h3>
                            <ProvenanceBadge provenance="Directly Observed" />
                          </div>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={merchantDetail.behaviour_charts.day_of_week}>
                                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                                <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                            <h3 className="font-bold text-slate-900 text-sm">Ticket Amount Buckets (₹)</h3>
                            <ProvenanceBadge provenance="Directly Observed" />
                          </div>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={merchantDetail.behaviour_charts.amount_buckets}>
                                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                                <Bar dataKey="count" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: SETTLEMENTS */}
                  {profileTab === 'settlement' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">Provider-Visible Settlement / Payout Events</h3>
                          <p className="text-xs text-slate-500">
                            Outflow requests initiated through payment provider dashboard rails. Does not reflect external bank balance.
                          </p>
                        </div>
                        <ProvenanceBadge provenance="Derived (Provider-Visible Only)" />
                      </div>

                      {merchantDetail.settlement_events.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Standard scheduled next-day batch settlements. No rapid payout requests recorded.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {merchantDetail.settlement_events.map((s: any) => (
                            <div key={s.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                              <div>
                                <div className="font-bold text-sm text-slate-900">
                                  ₹{s.amount.toLocaleString('en-IN')} Payout Request ({s.id})
                                </div>
                                <div className="text-xs text-slate-500">
                                  {s.timestamp} &bull; Processed in {s.payout_delay_hours}h &bull; Ratio: {Math.round(s.payout_ratio * 100)}% of collection
                                </div>
                                {s.notes && (
                                  <div className="text-xs text-amber-700 mt-1 font-medium">{s.notes}</div>
                                )}
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                                {s.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: ALERTS & INQUIRIES */}
                  {profileTab === 'cases' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h3 className="font-bold text-slate-900 text-sm">Merchant Information Requests & Responses</h3>
                        <span className="text-xs text-slate-500 font-medium">Graduated Human Inquiries</span>
                      </div>

                      {merchantDetail.requests.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          No clarification inquiries dispatched to this merchant yet.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {merchantDetail.requests.map((r: any) => (
                            <div key={r.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-900">{r.subject}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  r.status === 'Responded' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800'
                                }`}>
                                  {r.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                "{r.message}"
                              </p>

                              {r.responses.length > 0 && (
                                <div className="mt-3 p-3 bg-purple-50/50 border border-purple-100 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                                    <span>Merchant Written Explanation:</span>
                                    <ProvenanceBadge provenance="Merchant-declared" />
                                  </div>
                                  <p className="text-xs text-slate-700">
                                    "{r.responses[0].response_text}"
                                  </p>
                                  {r.responses[0].attachments?.length > 0 && (
                                    <div className="flex gap-2 text-[11px] text-purple-700 font-semibold pt-1">
                                      {r.responses[0].attachments.map((att: string, idx: number) => (
                                        <span key={idx} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-purple-200">
                                          <FileText size={12} /> {att}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 6: AUDIT TRAIL */}
                  {profileTab === 'audit' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h3 className="font-bold text-slate-900 text-sm">Merchant Investigation Audit Events</h3>
                        <span className="text-xs text-slate-500 font-medium">Append-Only</span>
                      </div>

                      <div className="space-y-2">
                        {merchantDetail.audit_trail.map((a: any) => (
                          <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-800">{a.action}</span>
                              <span className="text-slate-400 ml-2">by {a.actor_name} ({a.actor_role})</span>
                              {a.rationale && (
                                <div className="text-slate-600 mt-1 italic">"{a.rationale}"</div>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">{a.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function roundPercent(val: number): number {
  return Math.round((val || 0) * 100);
}
