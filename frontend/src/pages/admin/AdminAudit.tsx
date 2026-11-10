import React, { useEffect, useState } from 'react';
import { AdminNavHeader } from './AdminNavHeader';
import { api } from '../../api/client';
import { History, ShieldAlert, Download, RefreshCw, Filter } from 'lucide-react';

interface AdminAuditProps {
  onNavigate: (tab: string) => void;
}

export const AdminAudit: React.FC<AdminAuditProps> = ({ onNavigate }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterAction, setFilterAction] = useState<string>('');

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditTrail({ page_size: 50 });
      setEvents(res.items || []);
    } catch (err) {
      console.error('Failed to load audit events', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const filteredEvents = filterAction 
    ? events.filter(e => e.action.toLowerCase().includes(filterAction.toLowerCase()))
    : events;

  return (
    <div>
      <AdminNavHeader currentTab="admin-audit" onNavigate={onNavigate} />

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Administrative Ingestion Audit Trail</h1>
              <p className="text-xs text-slate-500">Append-only immutable record of all data ingestions, manual entries, and publications.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by action..."
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white"
            />
            <button
              onClick={fetchAudit}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading audit events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">No audit events match criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100">
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Actor & Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEvents.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{e.actor_name}</div>
                      <div className="text-[10px] text-slate-400">{e.actor_role}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-800">
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-slate-700 font-medium">{e.entity_type}</span>{' '}
                      <code className="text-[11px] text-[#008271] font-mono">{e.entity_id}</code>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-sm truncate">
                      {e.rationale || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
