import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, MessageSquare, Plus, FileText, 
  Send, ShieldAlert, CheckCircle, XCircle, Clock, 
  ArrowUpRight, AlertTriangle, FileCheck, Check
} from 'lucide-react';
import { api } from '../api/client';
import { StatusBadge, SeverityBadge, TierBadge, ProvenanceBadge } from '../components/Badge';
import { useAuth } from '../context/AuthContext';

interface CasesProps {
  initialCaseId?: string;
  onNavigate: (tab: string, meta?: any) => void;
}

export const Cases: React.FC<CasesProps> = ({ initialCaseId, onNavigate }) => {
  const { user, isReviewer, isReadOnly } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Case
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId || null);
  const [caseDetail, setCaseDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Interactive Form States
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('Investigation Note');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Recommendation & Reviewer decision
  const [recommendationText, setRecommendationText] = useState('');
  const [recommendationRationale, setRecommendationRationale] = useState('');
  const [reviewerDecision, setReviewerDecision] = useState<'Approved' | 'Rejected' | 'Modification Requested'>('Approved');
  const [reviewerRationale, setReviewerRationale] = useState('');

  // Clarification request
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryType, setInquiryType] = useState('unusual_timing');
  const [inquirySubject, setInquirySubject] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');

  // Close / Reopen
  const [closeReason, setCloseReason] = useState('');
  const [closeStatus, setCloseStatus] = useState('Closed — Cleared');

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await api.getCases();
      setCases(res.items);
      if (!selectedCaseId && res.items.length > 0) {
        setSelectedCaseId(res.items[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCases();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedCaseId) return;
    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await api.getCaseDetail(selectedCaseId);
        setCaseDetail(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedCaseId]);

  const handleAddNote = async () => {
    if (!selectedCaseId || !noteContent.trim() || isReadOnly) return;
    try {
      setSubmittingNote(true);
      await api.addCaseNote(selectedCaseId, { note_type: noteType, content: noteContent });
      setNoteContent('');
      const res = await api.getCaseDetail(selectedCaseId);
      setCaseDetail(res);
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRecommendAction = async () => {
    if (!selectedCaseId || !recommendationText.trim() || isReadOnly) return;
    try {
      await api.recommendCaseAction(selectedCaseId, {
        recommendation: recommendationText,
        rationale: recommendationRationale || 'Analyst verified behavioural risk indicators.',
      });
      setRecommendationText('');
      setRecommendationRationale('');
      fetchCases();
      const res = await api.getCaseDetail(selectedCaseId);
      setCaseDetail(res);
    } catch (err: any) {
      alert(err.message || 'Failed to submit recommendation');
    }
  };

  const handleReviewerDecision = async () => {
    if (!selectedCaseId || !reviewerRationale.trim()) return;
    try {
      await api.submitReviewDecision(selectedCaseId, {
        decision: reviewerDecision,
        rationale: reviewerRationale,
      });
      setReviewerRationale('');
      fetchCases();
      const res = await api.getCaseDetail(selectedCaseId);
      setCaseDetail(res);
    } catch (err: any) {
      alert(err.message || 'Review decision failed');
    }
  };

  const handleCreateInquiry = async () => {
    if (!selectedCaseId || !caseDetail || !inquiryMessage.trim()) return;
    try {
      await api.createMerchantRequest({
        case_id: selectedCaseId,
        merchant_id: caseDetail.merchant.id,
        request_type: inquiryType,
        subject: inquirySubject || `Clarification Request regarding ${inquiryType}`,
        message: inquiryMessage,
        due_days: 2,
      });
      setShowInquiryModal(false);
      setInquiryMessage('');
      setInquirySubject('');
      alert('Merchant information clarification request dispatched! The merchant can now review and respond in the Merchant Demo Portal.');
      fetchCases();
      const res = await api.getCaseDetail(selectedCaseId);
      setCaseDetail(res);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch inquiry');
    }
  };

  const handleCloseCase = async () => {
    if (!selectedCaseId || !closeReason.trim()) return;
    try {
      await api.closeCase(selectedCaseId, {
        status: closeStatus,
        reason: closeReason,
      });
      setCloseReason('');
      fetchCases();
      const res = await api.getCaseDetail(selectedCaseId);
      setCaseDetail(res);
    } catch (err: any) {
      alert(err.message || 'Closure failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[780px]">
      {/* Left List of Cases (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <FolderKanban size={17} className="text-purple-600" />
            Cases Queue ({cases.length})
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">Human Governed</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading cases...</div>
          ) : (
            cases.map((c) => {
              const isSelected = selectedCaseId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                      {c.id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-purple-800 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {c.priority}
                    </span>
                  </div>

                  <h3 className="font-bold text-xs mt-1 leading-snug line-clamp-2">
                    {c.title}
                  </h3>

                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className={isSelected ? 'text-purple-100 font-medium' : 'text-slate-500'}>
                      {c.merchant_name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      isSelected ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail & Workspace (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {loadingDetail || !caseDetail ? (
          <div className="py-32 text-center text-slate-400">Select a case to inspect evidence workspace.</div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-purple-700">{caseDetail.case.id}</span>
                  <StatusBadge status={caseDetail.case.status} />
                  <SeverityBadge severity={caseDetail.case.priority} />
                </div>
                <h2 className="text-base font-extrabold text-slate-900 mt-1">
                  {caseDetail.case.title}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  Subject: <strong className="text-slate-800">{caseDetail.merchant.name}</strong> ({caseDetail.merchant.category}) &bull; Assigned: {caseDetail.case.assigned_to_name}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowInquiryModal(true)}
                  disabled={isReadOnly}
                  className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Send size={13} /> Request Merchant Clarification
                </button>
              </div>
            </div>

            {/* Workspace Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Evidence Timeline */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileCheck size={16} className="text-emerald-600" />
                    Assembled Evidence Timeline ({caseDetail.evidence?.length || 0})
                  </h3>
                  <span className="text-[11px] text-slate-400">Strict Data Provenance</span>
                </div>

                <div className="space-y-3">
                  {caseDetail.evidence?.map((ev: any) => (
                    <div key={ev.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">{ev.title}</span>
                        <ProvenanceBadge provenance={ev.provenance_type} />
                      </div>
                      <p className="text-slate-700 leading-relaxed text-xs">{ev.description}</p>
                      {ev.raw_data && (
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800">
                          {JSON.stringify(ev.raw_data)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Recommendation & Senior Review Approval Workflow */}
              <div className="p-5 rounded-3xl bg-purple-50/70 border border-purple-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-purple-950 flex items-center gap-2">
                    <ShieldAlert size={17} className="text-purple-700" />
                    Graduated Policy Recommendation & Governance
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                    Human Approval Required
                  </span>
                </div>

                {caseDetail.case.current_recommendation ? (
                  <div className="p-4 bg-white rounded-2xl border border-purple-100 space-y-2">
                    <div className="text-xs font-bold text-slate-900">Analyst Recommendation:</div>
                    <p className="text-xs text-purple-900 font-medium">"{caseDetail.case.current_recommendation}"</p>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Rationale: {caseDetail.case.recommendation_rationale}
                    </div>

                    {caseDetail.case.reviewer_decision ? (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800">Compliance Decision:</span>{' '}
                          <span className="font-extrabold text-emerald-700">{caseDetail.case.reviewer_decision}</span>
                          <div className="text-[11px] text-slate-500 mt-0.5">Note: {caseDetail.case.reviewer_rationale}</div>
                        </div>
                        <CheckCircle className="text-emerald-600" size={20} />
                      </div>
                    ) : isReviewer ? (
                      /* Senior Reviewer Approval Controls */
                      <div className="mt-4 pt-3 border-t border-purple-100 space-y-3">
                        <span className="text-xs font-bold text-slate-900 block">Senior Reviewer Action:</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setReviewerDecision('Approved')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              reviewerDecision === 'Approved' ? 'bg-emerald-600 text-white' : 'bg-white border text-slate-700'
                            }`}
                          >
                            Approve Simulated Recommendation
                          </button>
                          <button
                            onClick={() => setReviewerDecision('Rejected')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              reviewerDecision === 'Rejected' ? 'bg-rose-600 text-white' : 'bg-white border text-slate-700'
                            }`}
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setReviewerDecision('Modification Requested')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                              reviewerDecision === 'Modification Requested' ? 'bg-amber-600 text-white' : 'bg-white border text-slate-700'
                            }`}
                          >
                            Request Changes
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Record senior review rationale (Mandatory)..."
                          value={reviewerRationale}
                          onChange={(e) => setReviewerRationale(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-purple-200 text-xs focus:outline-none"
                        />
                        <button
                          onClick={handleReviewerDecision}
                          disabled={!reviewerRationale.trim()}
                          className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs disabled:opacity-40 transition"
                        >
                          Submit Final Decision
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic mt-2">
                        Pending review by Compliance Reviewer (e.g. switch role to Dr. Kavita Menon in top right).
                      </div>
                    )}
                  </div>
                ) : (
                  /* Form to propose recommendation */
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="e.g. Simulated Recommendation: Place temporary containment on incremental daily settlement..."
                      value={recommendationText}
                      onChange={(e) => setRecommendationText(e.target.value)}
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Record justification / supporting evidence summary..."
                      value={recommendationRationale}
                      onChange={(e) => setRecommendationRationale(e.target.value)}
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs focus:outline-none"
                    />
                    <button
                      onClick={handleRecommendAction}
                      disabled={!recommendationText.trim() || isReadOnly}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs transition disabled:opacity-40"
                    >
                      Propose Recommendation for Senior Review
                    </button>
                  </div>
                )}
              </div>

              {/* Case Notes & Audit Chronology */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-purple-600" />
                  Analyst Investigation Notes ({caseDetail.notes?.length || 0})
                </h3>

                <div className="space-y-3">
                  {caseDetail.notes?.map((n: any) => (
                    <div key={n.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{n.author_name}</span>
                        <span className="text-[11px] text-slate-400">{n.created_at}</span>
                      </div>
                      <p className="text-slate-700 text-xs leading-relaxed">{n.content}</p>
                    </div>
                  ))}
                </div>

                {/* Add Note Form */}
                <div className="mt-4 space-y-2">
                  <textarea
                    rows={2}
                    placeholder="Add an internal investigation note..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:bg-white focus:border-purple-600"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleAddNote}
                      disabled={!noteContent.trim() || submittingNote || isReadOnly}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition disabled:opacity-40"
                    >
                      {submittingNote ? 'Adding...' : 'Post Note'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Closure Controls */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Case Closure Policy: Requires clear rationale recorded in audit history.
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Closure rationale..."
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    disabled={isReadOnly}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex-1 sm:w-56"
                  />
                  <button
                    onClick={handleCloseCase}
                    disabled={!closeReason.trim() || isReadOnly}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition disabled:opacity-40"
                  >
                    Close Case
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Issue Merchant Clarification Request</h3>
              <button onClick={() => setShowInquiryModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Formally prompts the merchant for an explanation and supporting invoices via the Merchant Portal.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Request Type:</label>
                <select
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="unusual_timing">Explanation for unusual transaction timing</option>
                  <option value="volume_spike">Explanation for sudden volume increase</option>
                  <option value="invoice_records">Supporting invoices / order records</option>
                  <option value="business_clarification">Clarification of business activity</option>
                  <option value="payer_patterns">Explanation of unusual payer patterns</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Subject:</label>
                <input
                  type="text"
                  placeholder="Subject line..."
                  value={inquirySubject}
                  onChange={(e) => setInquirySubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Message to Merchant:</label>
                <textarea
                  rows={4}
                  placeholder="Dear Merchant, our monitoring noted unusual activity..."
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowInquiryModal(false)}
                className="px-4 py-2 text-slate-600 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInquiry}
                disabled={!inquiryMessage.trim()}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
              >
                Dispatch to Merchant Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
