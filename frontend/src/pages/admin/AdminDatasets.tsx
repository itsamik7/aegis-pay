import React, { useEffect, useState } from 'react';
import { AdminNavHeader } from './AdminNavHeader';
import { api } from '../../api/client';
import { 
  Database, 
  Download, 
  RotateCcw, 
  Send, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileSpreadsheet,
  X,
  History
} from 'lucide-react';

interface AdminDatasetsProps {
  onNavigate: (tab: string) => void;
}

export const AdminDatasets: React.FC<AdminDatasetsProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Selected batch for detail modal
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchDetail, setBatchDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Rollback state modal
  const [rollbackBatchId, setRollbackBatchId] = useState<string | null>(null);
  const [rollbackRationale, setRollbackRationale] = useState('');
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdminDatasets();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset batches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleOpenDetail = async (batchId: string) => {
    setSelectedBatch(batchId);
    setDetailLoading(true);
    try {
      const res = await api.getAdminBatchDetail(batchId);
      setBatchDetail(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch batch records.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePublishBatch = async (batchId: string) => {
    setError(null);
    try {
      const res = await api.publishImportBatch({ batch_id: batchId });
      setActionSuccess(`Batch ${batchId} published successfully! (${res.published_rows} records)`);
      fetchDatasets();
    } catch (err: any) {
      setError(err.message || 'Publishing failed.');
    }
  };

  const handleExecuteRollback = async () => {
    if (!rollbackBatchId || !rollbackRationale.trim()) return;
    setRollbackLoading(true);
    setError(null);
    try {
      const res = await api.rollbackBatch(rollbackBatchId, { rationale: rollbackRationale });
      setActionSuccess(`Batch ${rollbackBatchId} rolled back. ${res.reverted_rows} records unpublished.`);
      setRollbackBatchId(null);
      setRollbackRationale('');
      fetchDatasets();
    } catch (err: any) {
      setError(err.message || 'Rollback failed.');
    } finally {
      setRollbackLoading(false);
    }
  };

  const batches = data?.batches || [];
  const versions = data?.versions || [];

  return (
    <div>
      <AdminNavHeader currentTab="admin-datasets" onNavigate={onNavigate} />

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Datasets, Staging & Publication Lifecycle</h1>
          <p className="text-xs text-slate-500">
            Audit history of ingested batches, draft records awaiting publication, and safe rollback controls.
          </p>
        </div>
        <button
          onClick={() => onNavigate('admin-import')}
          className="px-4 py-2 bg-[#00FE89] hover:bg-[#00FE89]/90 text-[#002225] text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
        >
          <span>+ Import New Batch</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-900 font-bold">&times;</button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-900 font-bold">&times;</button>
        </div>
      )}

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#008271]" />
            <h2 className="text-sm font-bold text-slate-900">Uploaded Batches ({batches.length})</h2>
          </div>
          <button onClick={fetchDatasets} className="text-xs text-[#008271] font-semibold hover:underline">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No external dataset batches uploaded yet. Click <strong>Import New Batch</strong> to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-semibold border-b border-slate-100">
                  <th className="py-3 px-3">Batch ID</th>
                  <th className="py-3 px-3">Dataset Type</th>
                  <th className="py-3 px-3">Source File</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Rows (Tot / Val / Staged / Pub)</th>
                  <th className="py-3 px-3">Uploader & Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {batches.map((b: any) => {
                  const isStaged = b.status === 'staged';
                  const isPublished = b.status === 'published';
                  const isRolledBack = b.status === 'rolled_back';
                  const isRejected = b.status === 'rejected';

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">
                      {b.status}
                    </span>
                  );
                  if (isStaged) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                        <Clock className="w-3 h-3" />
                        <span>Staged (Awaiting Publish)</span>
                      </span>
                    );
                  } else if (isPublished) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Published</span>
                      </span>
                    );
                  } else if (isRolledBack) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1 w-max">
                        <RotateCcw className="w-3 h-3" />
                        <span>Rolled Back</span>
                      </span>
                    );
                  } else if (isRejected) {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 w-max">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Rejected</span>
                      </span>
                    );
                  }

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{b.id}</td>
                      <td className="py-3 px-3 capitalize font-semibold text-slate-700">{b.dataset_type}</td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{b.source_filename}</td>
                      <td className="py-3 px-3">{statusBadge}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {b.total_rows} / <span className="text-emerald-700">{b.valid_rows}</span> / <span className="text-amber-700">{b.staged_rows}</span> / <span className="text-purple-700">{b.published_rows}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        <div>{b.created_by}</div>
                        <div className="text-[10px] text-slate-400">{new Date(b.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(b.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                            title="Preview Rows & Report"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {b.invalid_rows > 0 && (
                            <a
                              href={api.downloadBatchErrorsUrl(b.id)}
                              download
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition"
                              title="Download Error CSV"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {isStaged && (
                            <button
                              onClick={() => handlePublishBatch(b.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#00FE89] text-[#002225] font-bold text-[11px] hover:bg-[#00FE89]/90 transition shadow-sm"
                            >
                              Publish
                            </button>
                          )}

                          {isPublished && (
                            <button
                              onClick={() => { setRollbackBatchId(b.id); setRollbackRationale(''); }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px] hover:bg-rose-100 transition"
                            >
                              Rollback
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dataset Snapshot Versions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-[#008271]" />
          <h2 className="text-sm font-bold text-slate-900">Dataset Snapshot Versions ({versions.length})</h2>
        </div>

        {versions.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">No version snapshots recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v: any) => (
              <div key={v.id} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono font-bold text-slate-800">{v.version_tag}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Dataset: <span className="capitalize font-semibold text-slate-700">{v.dataset_type}</span> &bull; {v.records_count} records &bull; Published by {v.published_by}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  {new Date(v.published_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Granular Batch Detail Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Batch Inspection: {selectedBatch}</h3>
                <p className="text-xs text-slate-500">Row-by-row records and validation results.</p>
              </div>
              <button
                onClick={() => { setSelectedBatch(null); setBatchDetail(null); }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {detailLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading row records...</div>
              ) : batchDetail ? (
                batchDetail.rows.map((r: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-xl bg-slate-50 text-xs font-mono">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800">Row #{r.row_number} &bull; ID: {r.entity_id || 'N/A'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === 'valid' || r.status === 'staged' || r.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    {r.errors && r.errors.length > 0 && (
                      <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[11px]">
                        {r.errors.map((e: any, eIdx: number) => (
                          <div key={eIdx}>&bull; {e.field}: {e.message}</div>
                        ))}
                      </div>
                    )}
                    <pre className="text-[10px] text-slate-600 overflow-x-auto p-1.5 bg-white rounded border border-slate-200">
                      {JSON.stringify(r.data, null, 2)}
                    </pre>
                  </div>
                ))
              ) : null}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => { setSelectedBatch(null); setBatchDetail(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {rollbackBatchId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm Dataset Rollback</h3>
                <p className="text-xs text-slate-500">Batch: {rollbackBatchId}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Rolling back this batch will mark all its published records as <strong>unpublished</strong> and remove them from public platform view. This action will be audited.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audited Rollback Rationale <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rollbackRationale}
                onChange={(e) => setRollbackRationale(e.target.value)}
                placeholder="Reason for unpublishing this dataset batch..."
                rows={3}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRollbackBatchId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRollback}
                disabled={!rollbackRationale.trim() || rollbackLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
              >
                {rollbackLoading ? 'Rolling back...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
