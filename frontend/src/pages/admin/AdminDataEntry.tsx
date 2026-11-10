import React, { useState } from 'react';
import { AdminNavHeader } from './AdminNavHeader';
import { api } from '../../api/client';
import { 
  Building2, 
  Receipt, 
  Landmark, 
  CalendarDays, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  HelpCircle,
  FileCode2,
  Send
} from 'lucide-react';

interface AdminDataEntryProps {
  onNavigate: (tab: string) => void;
}

export const AdminDataEntry: React.FC<AdminDataEntryProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'merchants' | 'transactions' | 'settlements' | 'calendar_events'>('merchants');
  const [publicationMode, setPublicationMode] = useState<'draft' | 'published'>('published');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Merchant Form State
  const [merchantForm, setMerchantForm] = useState({
    merchant_id: 'MER-000124',
    merchant_name: 'Sharma Artisanal Bakery',
    legal_name: 'Sharma Food & Confectionery LLP',
    business_category: 'Bakeries',
    city: 'Delhi NCR',
    region: 'South Extension Part 1',
    onboarding_date: '2026-08-15',
    declared_operating_hours: '08:00 - 22:00',
    account_status: 'Active',
    declared_monthly_volume: '180000',
    declared_avg_ticket: '195',
  });

  // Transaction Form State
  const [txForm, setTxForm] = useState({
    transaction_id: 'TXN-00004567',
    merchant_id: 'MER-001-GOLDEN',
    transaction_timestamp: '2026-11-09T14:32:00',
    amount: '450.00',
    currency: 'INR',
    payment_status: 'Success',
    payer_token: 'payer_000123',
    payment_method: 'UPI',
    channel: 'QR',
  });

  // Settlement Form State
  const [settleForm, setSettleForm] = useState({
    settlement_id: 'SET-2026-00412',
    merchant_id: 'MER-001-GOLDEN',
    amount: '24500.00',
    timestamp: '2026-11-09T18:00:00',
    status: 'Completed',
  });

  // Calendar Event Form State
  const [calForm, setCalForm] = useState({
    event_id: 'EVT-HOLI-2026',
    name: 'Holi Festival Sweets Rush',
    event_type: 'Festival',
    start_date: '2026-03-24T00:00:00',
    end_date: '2026-03-26T23:59:59',
    expected_volume_multiplier: '2.8',
  });

  const sampleJSONs: Record<string, any> = {
    merchants: {
      merchant_id: 'MER-000124',
      merchant_name: 'Sharma Artisanal Bakery',
      legal_name: 'Sharma Food & Confectionery LLP',
      business_category: 'Bakeries',
      city: 'Delhi NCR',
      region: 'South Extension Part 1',
      onboarding_date: '2026-08-15',
      declared_operating_hours: '08:00 - 22:00',
      account_status: 'Active',
      declared_monthly_volume: 180000.0,
      declared_avg_ticket: 195.0,
    },
    transactions: {
      transaction_id: 'TXN-00004567',
      merchant_id: 'MER-001-GOLDEN',
      transaction_timestamp: '2026-11-09T14:32:00',
      amount: 450.0,
      currency: 'INR',
      payment_status: 'Success',
      payer_token: 'payer_000123',
      payment_method: 'UPI',
      channel: 'QR',
    },
    settlements: {
      settlement_id: 'SET-2026-00412',
      merchant_id: 'MER-001-GOLDEN',
      amount: 24500.0,
      timestamp: '2026-11-09T18:00:00',
      status: 'Completed',
    },
    calendar_events: {
      event_id: 'EVT-HOLI-2026',
      name: 'Holi Festival Sweets Rush',
      event_type: 'Festival',
      start_date: '2026-03-24T00:00:00',
      end_date: '2026-03-26T23:59:59',
      expected_volume_multiplier: 2.8,
    },
  };

  const handleCopyJSON = () => {
    const jsonStr = JSON.stringify(sampleJSONs[activeTab], null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setGeneralError(null);
    setSuccessMessage(null);

    let payload: any = {};
    if (activeTab === 'merchants') payload = merchantForm;
    else if (activeTab === 'transactions') payload = txForm;
    else if (activeTab === 'settlements') payload = settleForm;
    else if (activeTab === 'calendar_events') payload = calForm;

    try {
      const res = await api.createManualEntry({
        dataset_type: activeTab,
        publication_mode: publicationMode,
        payload,
      });
      setSuccessMessage(res.message || 'Record created successfully!');
    } catch (err: any) {
      if (err.data && err.data.errors) {
        const errMap: Record<string, string> = {};
        err.data.errors.forEach((e: any) => {
          errMap[e.field] = e.message;
        });
        setFieldErrors(errMap);
      } else {
        setGeneralError(err.message || 'Validation or submission error.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <AdminNavHeader currentTab="admin-data-entry" onNavigate={onNavigate} />

      {/* Top Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl">
          <button
            onClick={() => { setActiveTab('merchants'); setFieldErrors({}); setGeneralError(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'merchants' ? 'bg-[#002225] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#00FE89]" />
            <span>Merchants</span>
          </button>
          <button
            onClick={() => { setActiveTab('transactions'); setFieldErrors({}); setGeneralError(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'transactions' ? 'bg-[#002225] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-[#00FE89]" />
            <span>Transactions</span>
          </button>
          <button
            onClick={() => { setActiveTab('settlements'); setFieldErrors({}); setGeneralError(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'settlements' ? 'bg-[#002225] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Landmark className="w-4 h-4 text-[#00FE89]" />
            <span>Settlements</span>
          </button>
          <button
            onClick={() => { setActiveTab('calendar_events'); setFieldErrors({}); setGeneralError(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'calendar_events' ? 'bg-[#002225] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-[#00FE89]" />
            <span>Calendar Context</span>
          </button>
        </div>

        {/* Publication Target Toggle */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm text-xs">
          <span className="font-semibold text-slate-500 pl-2">Save Mode:</span>
          <button
            type="button"
            onClick={() => setPublicationMode('draft')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${
              publicationMode === 'draft' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Draft (Staged Only)
          </button>
          <button
            type="button"
            onClick={() => setPublicationMode('published')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${
              publicationMode === 'published' ? 'bg-[#002225] text-[#00FE89] border border-[#00FE89]/30' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Publish to Live App
          </button>
        </div>
      </div>

      {/* Main Grid: Form + Format Guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel (2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 capitalize">Manual {activeTab.replace('_', ' ')} Entry</h2>
              <p className="text-xs text-slate-500">
                Inputs are strictly validated server-side. Staged records can be reviewed prior to publication.
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              publicationMode === 'published' ? 'bg-[#002225] text-[#00FE89]' : 'bg-amber-100 text-amber-800'
            }`}>
              Target: {publicationMode.toUpperCase()}
            </span>
          </div>

          {generalError && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1">
                <p className="font-bold">{successMessage}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => onNavigate('overview')}
                    className="text-xs text-[#008271] font-bold underline"
                  >
                    View in Public Dashboard &rarr;
                  </button>
                  <button
                    onClick={() => onNavigate('admin-datasets')}
                    className="text-xs text-slate-600 font-bold underline"
                  >
                    View in Staged Datasets
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* MERCHANTS FORM */}
            {activeTab === 'merchants' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Merchant ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={merchantForm.merchant_id}
                      onChange={(e) => setMerchantForm({ ...merchantForm, merchant_id: e.target.value })}
                      placeholder="e.g. MER-000124"
                      required
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-mono focus:outline-none focus:bg-white transition ${
                        fieldErrors.merchant_id ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#008271]'
                      }`}
                    />
                    {fieldErrors.merchant_id && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.merchant_id}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Business Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={merchantForm.business_category}
                      onChange={(e) => setMerchantForm({ ...merchantForm, business_category: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    >
                      {['Bakeries', 'Confectionery', 'Restaurants', 'Retail', 'Groceries', 'Electronics', 'Fashion', 'Pharmacy', 'Hospitality', 'Services'].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Storefront Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={merchantForm.merchant_name}
                      onChange={(e) => setMerchantForm({ ...merchantForm, merchant_name: e.target.value })}
                      placeholder="e.g. Sharma Artisanal Bakery"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                    {fieldErrors.merchant_name && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.merchant_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Legal Registered Entity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={merchantForm.legal_name}
                      onChange={(e) => setMerchantForm({ ...merchantForm, legal_name: e.target.value })}
                      placeholder="e.g. Sharma Food Ventures LLP"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={merchantForm.city}
                      onChange={(e) => setMerchantForm({ ...merchantForm, city: e.target.value })}
                      placeholder="e.g. Delhi NCR"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Region / Area <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={merchantForm.region}
                      onChange={(e) => setMerchantForm({ ...merchantForm, region: e.target.value })}
                      placeholder="e.g. South Extension Part 1"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Onboarding Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={merchantForm.onboarding_date}
                      onChange={(e) => setMerchantForm({ ...merchantForm, onboarding_date: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Operating Hours <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={merchantForm.declared_operating_hours}
                      onChange={(e) => setMerchantForm({ ...merchantForm, declared_operating_hours: e.target.value })}
                      placeholder="08:00 - 22:00"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Status <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={merchantForm.account_status}
                      onChange={(e) => setMerchantForm({ ...merchantForm, account_status: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    >
                      {['Active', 'Under Review', 'Escalated', 'Suspended', 'Closed'].map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Declared Monthly Turnover (INR)
                    </label>
                    <input
                      type="number"
                      value={merchantForm.declared_monthly_volume}
                      onChange={(e) => setMerchantForm({ ...merchantForm, declared_monthly_volume: e.target.value })}
                      placeholder="180000.00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Declared Avg Ticket Size (INR)
                    </label>
                    <input
                      type="number"
                      value={merchantForm.declared_avg_ticket}
                      onChange={(e) => setMerchantForm({ ...merchantForm, declared_avg_ticket: e.target.value })}
                      placeholder="195.00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>
                </div>
              </>
            )}

            {/* TRANSACTIONS FORM */}
            {activeTab === 'transactions' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Transaction ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={txForm.transaction_id}
                      onChange={(e) => setTxForm({ ...txForm, transaction_id: e.target.value })}
                      placeholder="TXN-00004567"
                      required
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-mono focus:outline-none focus:bg-white transition ${
                        fieldErrors.transaction_id ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#008271]'
                      }`}
                    />
                    {fieldErrors.transaction_id && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.transaction_id}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Merchant ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={txForm.merchant_id}
                      onChange={(e) => setTxForm({ ...txForm, merchant_id: e.target.value })}
                      placeholder="e.g. MER-001-GOLDEN"
                      required
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-mono focus:outline-none focus:bg-white transition ${
                        fieldErrors.merchant_id ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#008271]'
                      }`}
                    />
                    {fieldErrors.merchant_id && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.merchant_id}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount (INR) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                      placeholder="450.00"
                      required
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:bg-white transition ${
                        fieldErrors.amount ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#008271]'
                      }`}
                    />
                    {fieldErrors.amount && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.amount}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Timestamp <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={txForm.transaction_timestamp}
                      onChange={(e) => setTxForm({ ...txForm, transaction_timestamp: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Status <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={txForm.payment_status}
                      onChange={(e) => setTxForm({ ...txForm, payment_status: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    >
                      {['Success', 'Failed', 'Refunded', 'Pending'].map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Synthetic Payer Token <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={txForm.payer_token}
                      onChange={(e) => setTxForm({ ...txForm, payer_token: e.target.value })}
                      placeholder="payer_000123"
                      required
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-mono focus:outline-none focus:bg-white transition ${
                        fieldErrors.payer_token ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#008271]'
                      }`}
                    />
                    {fieldErrors.payer_token && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.payer_token}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Method <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={txForm.payment_method}
                      onChange={(e) => setTxForm({ ...txForm, payment_method: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    >
                      {['UPI', 'Card', 'NetBanking', 'Wallet'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Touchpoint Channel <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={txForm.channel}
                      onChange={(e) => setTxForm({ ...txForm, channel: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#008271] rounded-xl text-sm focus:outline-none focus:bg-white transition"
                    >
                      {['QR', 'Web Checkout', 'POS', 'Payment Link'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* SETTLEMENTS FORM */}
            {activeTab === 'settlements' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Settlement Ref ID</label>
                    <input
                      type="text"
                      value={settleForm.settlement_id}
                      onChange={(e) => setSettleForm({ ...settleForm, settlement_id: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Merchant ID</label>
                    <input
                      type="text"
                      value={settleForm.merchant_id}
                      onChange={(e) => setSettleForm({ ...settleForm, merchant_id: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Disbursed Amount (INR)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={settleForm.amount}
                      onChange={(e) => setSettleForm({ ...settleForm, amount: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Timestamp</label>
                    <input
                      type="datetime-local"
                      value={settleForm.timestamp}
                      onChange={(e) => setSettleForm({ ...settleForm, timestamp: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* CALENDAR FORM */}
            {activeTab === 'calendar_events' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Event Key</label>
                    <input
                      type="text"
                      value={calForm.event_id}
                      onChange={(e) => setCalForm({ ...calForm, event_id: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Event Name</label>
                    <input
                      type="text"
                      value={calForm.name}
                      onChange={(e) => setCalForm({ ...calForm, name: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={calForm.start_date}
                      onChange={(e) => setCalForm({ ...calForm, start_date: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      value={calForm.end_date}
                      onChange={(e) => setCalForm({ ...calForm, end_date: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Volume Multiplier</label>
                    <input
                      type="number"
                      step="0.1"
                      value={calForm.expected_volume_multiplier}
                      onChange={(e) => setCalForm({ ...calForm, expected_volume_multiplier: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Fields marked with <span className="text-rose-500">*</span> are mandatory
              </span>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#00FE89] hover:bg-[#00FE89]/90 text-[#002225] font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#002225] border-t-transparent rounded-full animate-spin" />
                    <span>Validating & Storing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit {publicationMode === 'published' ? 'and Publish' : 'as Staged Draft'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar: Guidelines & Sample JSON Panel */}
        <div className="space-y-6">
          {/* Format Rules Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-[#008271]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Format Rules & Constraints</h3>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-[#00FE89] font-bold">&bull;</span>
                <span><strong>ID Patterns:</strong> Must strictly follow documented format (<code>MER-</code> or <code>TXN-</code>).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#00FE89] font-bold">&bull;</span>
                <span><strong>Amounts:</strong> Positive finite decimals. Reject text, commas, negative, zero.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#00FE89] font-bold">&bull;</span>
                <span><strong>Privacy:</strong> Payer tokens must be synthetic (<code>payer_xxxxxx</code>). Never enter real card or phone numbers.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#00FE89] font-bold">&bull;</span>
                <span><strong>Foreign Keys:</strong> Referenced Merchant IDs must exist in the database before submitting transactions.</span>
              </li>
            </ul>
          </div>

          {/* Valid Sample Record with Copy JSON */}
          <div className="bg-[#002225] text-white rounded-2xl border border-[#00383D] p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00FE89]">
                <FileCode2 className="w-4 h-4" />
                <span>Valid Sample Record</span>
              </div>
              <button
                type="button"
                onClick={handleCopyJSON}
                className="px-2.5 py-1 rounded-lg bg-[#00383D] hover:bg-[#00484e] text-[11px] font-semibold text-slate-200 transition flex items-center gap-1 border border-white/5"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#00FE89]" />
                    <span className="text-[#00FE89]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3 bg-[#001719] border border-[#00383D] rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 scrollbar-none">
              {JSON.stringify(sampleJSONs[activeTab], null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
