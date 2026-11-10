import React, { useEffect, useState } from 'react';
import { AdminNavHeader } from './AdminNavHeader';
import { api } from '../../api/client';
import { 
  BookOpen, 
  Download, 
  Copy, 
  Check, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Receipt, 
  Landmark, 
  CalendarDays,
  FileSpreadsheet
} from 'lucide-react';

interface AdminGuideProps {
  onNavigate: (tab: string) => void;
}

export const AdminGuide: React.FC<AdminGuideProps> = ({ onNavigate }) => {
  const [guide, setGuide] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('merchants');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    api.getAdminGuide().then(setGuide).catch(console.error);
  }, []);

  const handleCopy = (key: string, data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const tabs = [
    { id: 'merchants', label: 'Merchants Entity', icon: Building2 },
    { id: 'transactions', label: 'Transactions Entity', icon: Receipt },
    { id: 'settlements', label: 'Settlements & Payouts', icon: Landmark },
    { id: 'calendar_events', label: 'Calendar Context', icon: CalendarDays },
  ];

  const currentEntity = guide?.[activeTab];

  return (
    <div>
      <AdminNavHeader currentTab="admin-guide" onNavigate={onNavigate} />

      {/* Guide Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Data Entry Guide & Schema Dictionary</h1>
              <p className="text-xs text-slate-500">
                Authoritative specifications for manual forms, batch CSV/XLSX imports, validation rules, and sample payloads.
              </p>
            </div>
          </div>

          {currentEntity && (
            <div className="flex items-center gap-2">
              <a
                href={api.downloadTemplateUrl(activeTab)}
                download
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#008271]" />
                <span>Blank CSV Template</span>
              </a>
              <a
                href={api.downloadSampleUrl(activeTab)}
                download
                className="px-3 py-1.5 rounded-xl bg-[#002225] hover:bg-[#00383D] text-xs font-semibold text-[#00FE89] transition flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Sample CSV Dataset</span>
              </a>
            </div>
          )}
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto scrollbar-none">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive ? 'bg-[#002225] text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00FE89]' : 'text-slate-500'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {currentEntity && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Field Rules Table (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900">{currentEntity.title} Fields & Validation Rules</h2>
              <p className="text-xs text-slate-500 mt-0.5">{currentEntity.description}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100">
                    <th className="py-2.5 px-3">Field Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Format / Expected Pattern</th>
                    <th className="py-2.5 px-3">Allowed / Rules</th>
                    <th className="py-2.5 px-3">Valid Example</th>
                    <th className="py-2.5 px-3">Invalid Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentEntity.fields.map((f: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {f.name}
                        {f.required ? <span className="text-rose-500 ml-0.5">*</span> : <span className="text-slate-400 font-normal text-[10px] ml-1">(opt)</span>}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-600 capitalize">{f.type}</td>
                      <td className="py-2.5 px-3 text-slate-700">{f.format}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs">{f.rules}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-700 font-medium">{f.valid_example}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-700 font-medium">{f.invalid_example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sample JSON & Common Pitfalls (1 col) */}
          <div className="space-y-6">
            {/* Copyable JSON */}
            <div className="bg-[#002225] text-white rounded-2xl border border-[#00383D] p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-[#00FE89] uppercase tracking-wider">
                  Working Sample Record
                </div>
                <button
                  onClick={() => handleCopy(activeTab, currentEntity.sample_record)}
                  className="px-2.5 py-1 rounded-lg bg-[#00383D] hover:bg-[#00484e] text-[11px] font-semibold text-slate-200 transition flex items-center gap-1"
                >
                  {copiedKey === activeTab ? (
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

              <pre className="p-3 bg-[#001719] border border-[#00383D] rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-80 scrollbar-none">
                {JSON.stringify(currentEntity.sample_record, null, 2)}
              </pre>
            </div>

            {/* Common Ingestion Mistakes */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Common Ingestion Mistakes</h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold">&times;</span>
                  <span><strong>Real PII in payer tokens:</strong> Submitting real phone numbers, emails, or card numbers is blocked by the ingest privacy filter.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold">&times;</span>
                  <span><strong>Non-existent Merchant IDs:</strong> Transactions must point to an existing merchant already saved in the system.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold">&times;</span>
                  <span><strong>Ambiguous timestamps:</strong> Timestamps must use strict ISO 8601 (<code>YYYY-MM-DDTHH:MM:SS</code>).</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold">&times;</span>
                  <span><strong>Non-numeric amounts:</strong> Commas, currency symbols (₹, $), and negative values will be rejected.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
