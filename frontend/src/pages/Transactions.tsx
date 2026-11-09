import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, Search, Download, Filter, 
  ExternalLink, ChevronRight, X, AlertTriangle, ShieldCheck 
} from 'lucide-react';
import { api } from '../api/client';
import { ProvenanceBadge } from '../components/Badge';

interface TransactionsProps {
  initialSearch?: string;
  onNavigate: (tab: string, meta?: any) => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ initialSearch, onNavigate }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState(initialSearch || '');
  const [flaggedFilter, setFlaggedFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('time_desc');

  // Selected Detail Drawer
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: 20,
        sort_by: sortBy,
      };
      if (search) params.search = search;
      if (flaggedFilter === 'flagged') params.is_flagged = true;
      if (flaggedFilter === 'normal') params.is_flagged = false;
      if (methodFilter !== 'all') params.payment_method = methodFilter;

      const res = await api.getTransactions(params);
      setTransactions(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, flaggedFilter, methodFilter, sortBy]);

  useEffect(() => {
    if (!selectedTxId) {
      setTxDetail(null);
      return;
    }
    const loadDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await api.getTransactionDetail(selectedTxId);
        setTxDetail(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetail(false);
      }
    };
    loadDetail();
  }, [selectedTxId]);

  const handleExportCsv = () => {
    window.location.href = `/api/transactions/export?${flaggedFilter === 'flagged' ? 'is_flagged=true' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search by Tx ID, payer token or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchTransactions(); } }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-sm text-slate-900 rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600 focus:bg-white transition"
            />
          </div>

          <select
            value={flaggedFilter}
            onChange={(e) => { setFlaggedFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="all">All Transactions</option>
            <option value="flagged">Flagged Anomaly Clusters Only</option>
            <option value="normal">Normal Daytime Tickets</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer hidden sm:block"
          >
            <option value="all">All Payment Methods</option>
            <option value="UPI">UPI</option>
            <option value="Card">Cards</option>
            <option value="POS">POS Terminal</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="time_desc">Newest First</option>
            <option value="time_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Transaction ID</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Merchant Name</th>
                <th className="py-3.5 px-4">Amount (INR)</th>
                <th className="py-3.5 px-4">Method & Channel</th>
                <th className="py-3.5 px-4">Pseudonymous Payer Token</th>
                <th className="py-3.5 px-4">Anomaly Flag</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading transactions...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">No transactions match filters.</td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTxId(t.id)}
                    className="hover:bg-purple-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 group-hover:text-purple-700">
                      {t.id}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {t.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {t.merchant_name}
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-slate-900">
                      ₹{t.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold mr-1">
                        {t.payment_method}
                      </span>
                      <span className="text-slate-400 text-[11px]">{t.channel}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-purple-700 font-medium text-[11px]">
                      {t.payer_token}
                    </td>
                    <td className="py-3 px-4">
                      {t.is_flagged ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px] inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" /> Flagged
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Normal</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-purple-600 hover:text-purple-800 p-1 rounded-lg">
                        <ChevronRight size={17} />
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
            Showing <span className="font-bold text-slate-800">{transactions.length}</span> of{' '}
            <span className="font-bold text-slate-800">{total}</span> payments
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
              disabled={page * 20 >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Detail Drawer */}
      {selectedTxId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-purple-700">{selectedTxId}</span>
                <h3 className="font-extrabold text-sm text-slate-900">Transaction Signal Attribution</h3>
              </div>
              <button onClick={() => setSelectedTxId(null)} className="p-2 text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {loadingDetail || !txDetail ? (
                <div className="py-20 text-center text-slate-400">Loading details...</div>
              ) : (
                <>
                  {/* Amount Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-slate-400 font-medium">Payment Value</div>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                        ₹{txDetail.transaction.amount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {txDetail.transaction.payment_method} &bull; Channel: {txDetail.transaction.channel}
                      </div>
                    </div>
                    <div>
                      <ProvenanceBadge provenance={txDetail.signal_attribution.provenance} />
                    </div>
                  </div>

                  {/* Why Flagged Explanation */}
                  <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                    <span className="font-bold text-xs text-purple-950 uppercase tracking-wider block">
                      Behavioural Signal Attribution
                    </span>
                    <p className="text-xs text-purple-900 leading-relaxed font-medium">
                      {txDetail.signal_attribution.explanation}
                    </p>
                  </div>

                  {/* Transaction Metadata */}
                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Provider-Visible Parameters</h4>
                    <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Merchant Account:</span>
                        <span className="font-bold text-slate-900">{txDetail.transaction.merchant_name} ({txDetail.transaction.merchant_id})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Processed At:</span>
                        <span className="font-mono text-slate-800">{txDetail.transaction.timestamp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Payer Token (Synthetic):</span>
                        <span className="font-mono text-purple-700 font-bold">{txDetail.transaction.payer_token}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Settlement Ref:</span>
                        <span className="font-mono text-slate-600">{txDetail.transaction.settlement_ref || 'Batch Batch Next-Day (Simulated)'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Linked Actions */}
                  <div className="pt-4 border-t border-slate-200 flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedTxId(null);
                        onNavigate('merchants', { selectedMerchantId: txDetail.transaction.merchant_id });
                      }}
                      className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs transition"
                    >
                      Open Merchant Profile &rarr;
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
