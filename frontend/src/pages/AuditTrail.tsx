import React, { useState, useEffect } from 'react';
import { History, Search, ShieldCheck, Filter, User } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const AuditTrail: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const params: any = { page, page_size: 25 };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;

      const res = await api.getAuditTrail(params);
      setEvents(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAudit();
    }
  }, [page, actionFilter, entityFilter, user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#008271] text-xs font-bold uppercase tracking-wider">
            <History size={16} /> Regulatory Compliance & Accountability
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
            Immutable Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically sealed, append-only records of every analyst triage, recommendation, policy revision, and inquiry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="">All Entities</option>
            <option value="Alert">Alerts</option>
            <option value="Case">Cases</option>
            <option value="RiskConfiguration">Policy Configs</option>
            <option value="MerchantInformationRequest">Inquiries</option>
            <option value="MerchantResponse">Merchant Responses</option>
          </select>
        </div>
      </div>

      {/* Audit Events Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor & Role</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Entity & Target</th>
                <th className="py-3.5 px-4">Rationale / Justification</th>
                <th className="py-3.5 px-4 text-right">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Loading audit trail...</td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">No audit events match.</td>
                </tr>
              ) : (
                events.map((a) => (
                  <tr key={a.id} className="hover:bg-emerald-50/30 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {a.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{a.actor_name}</div>
                      <div className="text-[10px] text-[#008271] font-semibold">{a.actor_role}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-xs text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {a.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{a.entity_type}</span>: <span className="font-mono text-[#008271]">{a.entity_id}</span>
                    </td>
                    <td className="py-3 px-4 max-w-sm text-slate-600 italic">
                      "{a.rationale || 'System logged action'}"
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-right">
                      {a.ip_address}
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
            Showing <span className="font-bold text-slate-800">{events.length}</span> of{' '}
            <span className="font-bold text-slate-800">{total}</span> audit entries
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
              disabled={page * 25 >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
