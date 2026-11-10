import React, { useEffect, useState } from 'react';
import { AdminNavHeader } from './AdminNavHeader';
import { api } from '../../api/client';
import { 
  Building2, 
  Receipt, 
  UploadCloud, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  FileEdit,
  Database,
  History,
  BookOpen
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigate: (tab: string) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrative overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div>
        <AdminNavHeader currentTab="admin-overview" onNavigate={onNavigate} />
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#00FE89] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading administrative overview telemetry...</p>
        </div>
      </div>
    );
  }

  const tel = data?.telemetry || {};
  const recentAudits = data?.recent_audit_actions || [];

  return (
    <div>
      <AdminNavHeader currentTab="admin-overview" onNavigate={onNavigate} />

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchOverview} className="underline font-bold">Retry</button>
        </div>
      )}

      {/* Hero Welcome & Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Merchants */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monitored Merchants</span>
            <div className="p-2 rounded-xl bg-[#00FE89]/10 text-[#008271]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{tel.total_merchants ?? 0}</div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span className="text-[#008271] font-semibold">{tel.published_merchants ?? 0} Published</span>
            <span>&bull;</span>
            <span className="text-amber-600 font-semibold">{tel.draft_merchants ?? 0} Staged Drafts</span>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transactions Stream</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{tel.total_transactions?.toLocaleString() ?? 0}</div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span className="text-sky-600 font-semibold">{tel.published_transactions?.toLocaleString() ?? 0} Published</span>
            <span>&bull;</span>
            <span className="text-amber-600 font-semibold">{tel.draft_transactions ?? 0} Staged</span>
          </div>
        </div>

        {/* Ingest Batches */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingestion Batches</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <UploadCloud className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{tel.total_batches ?? 0}</div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span className="text-emerald-600 font-semibold">{tel.published_batches ?? 0} Published</span>
            <span>&bull;</span>
            <span className="text-amber-600 font-semibold">{tel.staged_batches ?? 0} Staged</span>
            <span>&bull;</span>
            <span className="text-rose-600 font-semibold">{tel.rejected_batches ?? 0} Rejected</span>
          </div>
        </div>

        {/* Awaiting Publication */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awaiting Publication</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">{tel.records_awaiting_publication ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-2">
            Staged records invisible to public platform until published
          </div>
        </div>
      </div>

      {/* Last Successful Import & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Last Successful Import Card */}
        <div className="bg-gradient-to-br from-[#002225] to-[#00383D] text-white p-6 rounded-2xl border border-[#00383D] shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#00FE89] font-bold uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Last Successful Publication</span>
            </div>
            {tel.last_import ? (
              <div className="space-y-2 mt-3">
                <div className="text-xl font-bold text-white">{tel.last_import.filename}</div>
                <div className="text-xs text-slate-300">
                  Dataset: <span className="font-semibold text-[#00FE89] capitalize">{tel.last_import.dataset_type}</span> ({tel.last_import.published_rows} rows)
                </div>
                <div className="text-[11px] text-slate-400">
                  Published by <span className="text-slate-200">{tel.last_import.published_by}</span> on {new Date(tel.last_import.published_at).toLocaleString()}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2">
                No external batch publication recorded yet. System currently operating on initial calibrated demo seed.
              </p>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={() => onNavigate('admin-datasets')}
              className="text-xs font-semibold text-[#00FE89] hover:underline flex items-center gap-1.5"
            >
              <span>Manage Datasets & Staging</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Workflow Cards (2 columns) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            onClick={() => onNavigate('admin-data-entry')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#00FE89] hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#00FE89]/10 text-[#008271] flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <FileEdit className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Manual Data Entry</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Add single merchants, transactions, settlements, or calendar events with real-time field validation, JSON copiers, and draft staging.
              </p>
            </div>
            <div className="pt-4 mt-2 flex items-center text-xs font-bold text-[#008271] group-hover:translate-x-1 transition">
              <span>Open Data Entry Form &rarr;</span>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('admin-import')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#00FE89] hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <UploadCloud className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">CSV / XLSX Import Wizard</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Execute 10-step ingestion lifecycle: upload files, download official templates, preview columns, validate rows, stage, and publish.
              </p>
            </div>
            <div className="pt-4 mt-2 flex items-center text-xs font-bold text-sky-600 group-hover:translate-x-1 transition">
              <span>Launch Ingestion Wizard &rarr;</span>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('admin-datasets')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#00FE89] hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Published Datasets & Staging</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Review staged batches awaiting approval, confirm dataset publication, inspect row errors, and safely rollback previous batches.
              </p>
            </div>
            <div className="pt-4 mt-2 flex items-center text-xs font-bold text-purple-600 group-hover:translate-x-1 transition">
              <span>Inspect Datasets &rarr;</span>
            </div>
          </div>

          <div 
            onClick={() => onNavigate('admin-guide')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-[#00FE89] hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Data Entry Guide & Schemas</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Comprehensive dictionary of expected formats, required/optional fields, valid/invalid samples, and downloadable starter templates.
              </p>
            </div>
            <div className="pt-4 mt-2 flex items-center text-xs font-bold text-amber-600 group-hover:translate-x-1 transition">
              <span>View Data Entry Guide &rarr;</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Admin Audit Trail */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#008271]" />
            <h2 className="text-base font-bold text-slate-900">Recent Admin & Ingestion Actions</h2>
          </div>
          <button 
            onClick={() => onNavigate('admin-audit')}
            className="text-xs font-semibold text-[#008271] hover:underline"
          >
            View Full Audit Log
          </button>
        </div>

        {recentAudits.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No recent administrative mutations logged.</p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Entity ID</th>
                  <th className="py-2.5 px-3">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentAudits.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {a.actor_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                        {a.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{a.entity_type}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{a.entity_id}</td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">{a.rationale || '—'}</td>
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
