import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, CheckCircle2, UserPlus, ArrowUpRight, 
  Search, Filter, ChevronRight, X, AlertTriangle, ShieldCheck, MessageSquare
} from 'lucide-react';
import { api } from '../api/client';
import { TierBadge, StatusBadge, SeverityBadge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

interface AlertsProps {
  initialAlertId?: string;
  onNavigate: (tab: string, meta?: any) => void;
}

export const Alerts: React.FC<AlertsProps> = ({ initialAlertId, onNavigate }) => {
  const { user, isReadOnly, demoUsers } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Selected Alert for Detail Drawer
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(initialAlertId || null);
  const [alertDetail, setAlertDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal actions
  const [actionType, setActionType] = useState<'assign' | 'status' | 'clear' | null>(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [targetAnalystId, setTargetAnalystId] = useState<number>(user?.id || 1);
  const [actionRationale, setActionRationale] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params: any = { page, page_size: 15 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (tierFilter !== 'all') params.tier = Number(tierFilter);

      const res = await api.getAlerts(params);
      setAlerts(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Failed to fetch alerts:', err);
      setFetchError(err.message || 'Failed to fetch alerts. Please ensure backend is running and you are signed in.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [page, statusFilter, severityFilter, tierFilter, user]);

  useEffect(() => {
    if (!selectedAlertId) {
      setAlertDetail(null);
      return;
    }
    const loadDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await api.getAlertDetail(selectedAlertId);
        setAlertDetail(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetail(false);
      }
    };
    loadDetail();
  }, [selectedAlertId]);

  const handleExecuteAction = async () => {
    if (!selectedAlertId) return;
    try {
      setActionSubmitting(true);
      const payload: any = { rationale: actionRationale };

      if (actionType === 'assign') {
        payload.assigned_analyst_id = targetAnalystId;
      } else if (actionType === 'clear') {
        payload.status = 'Cleared';
        payload.cleared_reason = actionRationale;
      } else if (actionType === 'status') {
        payload.status = targetStatus;
      }

      await api.updateAlert(selectedAlertId, payload);
      setActionType(null);
      setActionRationale('');
      // Refresh
      fetchAlerts();
      const res = await api.getAlertDetail(selectedAlertId);
      setAlertDetail(res);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCreateCaseFromAlert = async (alertObj: any) => {
    if (isReadOnly) return;
    try {
      const res = await api.createCase({
        title: `Investigation: ${alertObj.merchant_name} Alert (${alertObj.id})`,
        merchant_id: alertObj.merchant_id,
        alert_ids: [alertObj.id],
        priority: alertObj.severity,
        initial_note: `Case automatically opened from alert ${alertObj.id} (Score: ${alertObj.score}, Tier ${alertObj.tier}). Recommended step: ${alertObj.recommended_next_step || 'Review'}`
      });
      onNavigate('cases', { selectedCaseId: res.case_id });
    } catch (err: any) {
      alert(err.message || 'Failed to create case');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="all">All Alert Statuses</option>
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="Under Review">Under Review</option>
            <option value="Merchant Information Requested">Merchant Info Requested</option>
            <option value="Escalated">Escalated</option>
            <option value="Cleared">Cleared</option>
            <option value="Confirmed Policy Breach">Confirmed Policy Breach</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="all">All Risk Tiers</option>
            <option value="2">Tier 2: Targeted Query</option>
            <option value="3">Tier 3: Enhanced Review</option>
            <option value="4">Tier 4: Senior Review</option>
            <option value="5">Tier 5: Compliance Decision</option>
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="font-bold text-slate-900">{alerts.length}</span> alerts
        </div>
      </div>

      {/* Alert Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Alert ID & Merchant</th>
                <th className="py-3.5 px-4">Score & Tier</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Signals Triggered</th>
                <th className="py-3.5 px-4">Recommended Action</th>
                <th className="py-3.5 px-4">Assigned Analyst</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading alerts...</td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-rose-600">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                      <p className="font-semibold">{fetchError}</p>
                      <button onClick={fetchAlerts} className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs">
                        Retry Fetch
                      </button>
                    </div>
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <p>No alerts match the criteria.</p>
                      {(statusFilter !== 'all' || severityFilter !== 'all' || tierFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setStatusFilter('all');
                            setSeverityFilter('all');
                            setTierFilter('all');
                          }}
                          className="text-xs text-purple-600 font-semibold hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedAlertId(a.id)}
                    className="hover:bg-purple-50/40 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-purple-700">{a.merchant_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{a.id} &bull; {a.merchant_id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900">{a.score}</span>
                        <TierBadge tier={a.tier} size="sm" />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <SeverityBadge severity={a.severity} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[11px]">
                        {a.triggered_signals?.length || 0} signals
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {a.recommended_next_step}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {a.assigned_analyst_name || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateCaseFromAlert(a);
                        }}
                        disabled={isReadOnly}
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold transition disabled:opacity-40"
                        title="Create formal investigation case"
                      >
                        Open Case
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer / Modal for Alert Details */}
      {selectedAlertId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-purple-700 font-bold">{selectedAlertId}</div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {alertDetail?.alert.merchant_name || 'Alert Details'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedAlertId(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail || !alertDetail ? (
                <div className="py-20 text-center text-slate-400">Loading alert details...</div>
              ) : (
                <>
                  {/* Status Banner */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 font-medium">Status & Severity</div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={alertDetail.alert.status} />
                        <SeverityBadge severity={alertDetail.alert.severity} />
                        <TierBadge tier={alertDetail.alert.tier} size="sm" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Risk Score</div>
                      <div className="text-2xl font-black text-slate-900 font-mono">
                        {alertDetail.alert.score} <span className="text-xs font-normal text-slate-400">/ 1000</span>
                      </div>
                    </div>
                  </div>

                  {/* Recommended Next Step */}
                  <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4">
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block">Recommended Next Step</span>
                    <p className="text-sm font-semibold text-purple-950 mt-1">{alertDetail.alert.recommended_next_step}</p>
                    {alertDetail.alert.cleared_reason && (
                      <div className="mt-2 pt-2 border-t border-purple-200/60 text-xs text-slate-700">
                        <span className="font-bold">Cleared Rationale:</span> {alertDetail.alert.cleared_reason}
                      </div>
                    )}
                  </div>

                  {/* Triggered Signals Breakdown */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                      Triggered Risk Signals ({alertDetail.signals?.length || 0})
                    </h3>
                    <div className="space-y-3">
                      {alertDetail.signals?.map((sig: any) => (
                        <div key={sig.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">{sig.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">{sig.dimension}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-snug">{sig.analyst_explanation}</p>
                          <div className="text-[11px] text-slate-500 italic mt-1">
                            False alarm note: {sig.false_positive_notes}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Triage Actions Toolbar */}
                  <div className="pt-4 border-t border-slate-200">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Triage Workflow Actions</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setActionType('assign'); setActionRationale(''); }}
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <UserPlus size={14} /> Assign Analyst
                      </button>

                      <button
                        onClick={() => { setActionType('status'); setTargetStatus('Under Review'); setActionRationale('Marking under active investigation'); }}
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition disabled:opacity-40"
                      >
                        Mark Under Review
                      </button>

                      <button
                        onClick={() => { setActionType('status'); setTargetStatus('Escalated'); setActionRationale('Escalating for senior compliance review'); }}
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition disabled:opacity-40"
                      >
                        Escalate
                      </button>

                      <button
                        onClick={() => { setActionType('clear'); setActionRationale(''); }}
                        disabled={isReadOnly}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition disabled:opacity-40"
                      >
                        Clear Alert (with Rationale)
                      </button>
                    </div>

                    {/* Action Form */}
                    {actionType && (
                      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in">
                        <div className="text-xs font-bold text-slate-900">
                          {actionType === 'clear' && 'Clear Alert with Mandatory Rationale'}
                          {actionType === 'assign' && 'Assign Alert to Risk Analyst'}
                          {actionType === 'status' && `Change Status to ${targetStatus}`}
                        </div>

                        {actionType === 'assign' && (
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Select Assignee:</label>
                            <select
                              value={targetAnalystId}
                              onChange={(e) => setTargetAnalystId(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                            >
                              {demoUsers.map((du) => (
                                <option key={du.id} value={du.id}>{du.full_name} ({du.role})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Rationale / Justification (Mandatory & Audited):
                          </label>
                          <textarea
                            rows={3}
                            placeholder={actionType === 'clear' ? 'State why this pattern is benign (e.g. verified festive holiday invoice)...' : 'Reason for this triage action...'}
                            value={actionRationale}
                            onChange={(e) => setActionRationale(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-purple-600"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setActionType(null)}
                            className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleExecuteAction}
                            disabled={actionSubmitting || (actionType === 'clear' && actionRationale.trim().length < 5)}
                            className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-40 transition"
                          >
                            {actionSubmitting ? 'Submitting...' : 'Confirm Action'}
                          </button>
                        </div>
                      </div>
                    )}
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
