import React, { useState, useEffect } from 'react';
import { Store, Send, FileText, CheckCircle2, AlertCircle, Clock, Upload } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const MerchantPortal: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Response Form
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [attachmentName, setAttachmentName] = useState('sales_invoice_bulk_event.pdf');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      // Query requests for Sunrise Artisanal Bakes (or all for demo)
      const res = await api.getMerchantRequests('MER-003-SUNRISE');
      setRequests(res);
      if (res.length > 0 && !selectedRequestId) {
        setSelectedRequestId(res[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmitResponse = async (reqId: string) => {
    if (!responseText.trim()) return;
    try {
      setSubmitting(true);
      await api.submitMerchantResponse(reqId, {
        response_text: responseText,
        attachment_filenames: [attachmentName],
      });
      alert('Clarification response submitted to PayU risk analysts!');
      setResponseText('');
      fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Merchant Header */}
      <div className="bg-gradient-to-r from-amber-900 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-amber-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-800/60 border border-amber-500/30 text-[11px] font-bold tracking-wide uppercase text-amber-200">
            Merchant Clarification Demo Portal
          </div>
          <h2 className="text-xl font-extrabold tracking-tight mt-1">
            Sunrise Artisanal Bakes & Cafe — Merchant Operations
          </h2>
          <p className="text-xs text-amber-200/90 max-w-xl mt-1 leading-relaxed">
            Logged in as <strong>Vikram Malhotra</strong> (Merchant Admin). Review inquiries dispatched by payment provider risk analysts and submit business explanations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Request List (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
            Inquiries from PayU Risk Operations ({requests.length})
          </h3>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading inquiries...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No active clarification requests.</div>
          ) : (
            requests.map((r) => {
              const isSelected = selectedRequestId === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRequestId(r.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition space-y-2 ${
                    isSelected
                      ? 'border-[#00C48C] bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#008271]">{r.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'Responded' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 leading-snug">{r.subject}</h4>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock size={12} /> Due: {r.due_date.slice(0, 10)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Request Detail & Response Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          {selectedRequestId ? (
            (() => {
              const req = requests.find((r) => r.id === selectedRequestId);
              if (!req) return <div className="text-slate-400">Request not found.</div>;
              return (
                <>
                  <div className="pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#008271]">{req.id}</span>
                      <span className="text-xs text-slate-400 font-medium">Dispatched by: {req.created_by_name}</span>
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-900 mt-1">{req.subject}</h3>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-1">
                    <span className="font-bold text-slate-400 block text-[10px] uppercase tracking-wider">
                      Message from Risk Team
                    </span>
                    <p>{req.message}</p>
                  </div>

                  {/* Previous responses if any */}
                  {req.responses?.length > 0 && (
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={15} className="text-emerald-600" /> Submitted Response:
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">{req.responses[0].submitted_at}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed italic">
                        "{req.responses[0].response_text}"
                      </p>
                      {req.responses[0].attachments?.length > 0 && (
                        <div className="flex gap-2 text-[11px] text-[#008271] font-semibold pt-1">
                          {req.responses[0].attachments.map((att: string, idx: number) => (
                            <span key={idx} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-emerald-200">
                              <FileText size={12} /> {att}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit / Re-submit response form */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <span className="text-xs font-bold text-slate-900 block">
                      {req.responses?.length > 0 ? 'Submit Additional Clarification:' : 'Write Clarification Response:'}
                    </span>
                    <textarea
                      rows={4}
                      placeholder="Explain the business context of these transactions (e.g., bulk catering orders, event festival pop-up)..."
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:bg-white focus:border-[#00C48C]"
                    />

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={attachmentName}
                        onChange={(e) => setAttachmentName(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono flex-1"
                        placeholder="mock_attachment.pdf"
                      />
                      <button
                        onClick={() => handleSubmitResponse(req.id)}
                        disabled={submitting || !responseText.trim()}
                        className="px-5 py-2 bg-[#00383D] hover:bg-[#004D54] text-[#00FE89] font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-40 border border-[#005C63]"
                      >
                        <Send size={13} /> {submitting ? 'Submitting...' : 'Send Clarification'}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="py-24 text-center text-slate-400 text-xs">
              Select an inquiry on the left to review and respond.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
