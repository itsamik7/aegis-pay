import React, { useState, useRef } from 'react';
import { AdminNavHeader } from './AdminNavHeader';
import { api } from '../../api/client';
import { 
  UploadCloud, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  Database, 
  Send,
  Layers,
  FileText
} from 'lucide-react';

interface AdminFileImportProps {
  onNavigate: (tab: string) => void;
}

export const AdminFileImport: React.FC<AdminFileImportProps> = ({ onNavigate }) => {
  // Wizard state (steps 1 through 10)
  const [step, setStep] = useState<number>(1);
  const [datasetType, setDatasetType] = useState<string>('merchants');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Upload & validation results
  const [batchId, setBatchId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [validationReport, setValidationReport] = useState<any>(null);

  // Mode & publication
  const [importMode, setImportMode] = useState<'strict' | 'valid_only'>('strict');
  const [stagingResult, setStagingResult] = useState<any>(null);
  const [publishResult, setPublishResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Handle File Select & Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a .csv or .xlsx file to upload.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.uploadImportFile(datasetType, file);
      setUploadResult(res);
      setBatchId(res.batch_id);
      setStep(4); // Move to Parse & Column Mapping Preview
    } catch (err: any) {
      setError(err.message || 'File upload failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Execute Full Server-Side Row Validation
  const handleValidate = async () => {
    if (!batchId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.validateImportBatch(batchId);
      setValidationReport(res);
      setStep(6); // Move to Validation Report & Mode Selector
    } catch (err: any) {
      setError(err.message || 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 8: Stage Records
  const handleStage = async () => {
    if (!batchId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.stageImportBatch({ batch_id: batchId, import_mode: importMode });
      setStagingResult(res);
      setStep(8); // Move to Staging Complete & Publish Prompt
    } catch (err: any) {
      setError(err.message || 'Staging failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 9: Publish to Live App
  const handlePublish = async () => {
    if (!batchId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.publishImportBatch({ batch_id: batchId });
      setPublishResult(res);
      setStep(10); // Final Success Result
    } catch (err: any) {
      setError(err.message || 'Publishing failed.');
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setBatchId(null);
    setUploadResult(null);
    setValidationReport(null);
    setStagingResult(null);
    setPublishResult(null);
    setError(null);
  };

  return (
    <div>
      <AdminNavHeader currentTab="admin-import" onNavigate={onNavigate} />

      {/* Wizard Progress Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 overflow-x-auto pb-1 scrollbar-none">
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 1 ? 'text-[#008271] font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? 'bg-[#00FE89] text-[#002225]' : 'bg-slate-100'}`}>1</span>
            <span>Dataset & Template</span>
          </div>
          <span className="text-slate-300 px-2">&rarr;</span>
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 3 ? 'text-[#008271] font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 3 ? 'bg-[#00FE89] text-[#002225]' : 'bg-slate-100'}`}>2</span>
            <span>Upload File</span>
          </div>
          <span className="text-slate-300 px-2">&rarr;</span>
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 5 ? 'text-[#008271] font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 5 ? 'bg-[#00FE89] text-[#002225]' : 'bg-slate-100'}`}>3</span>
            <span>Parse & Validate</span>
          </div>
          <span className="text-slate-300 px-2">&rarr;</span>
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 7 ? 'text-[#008271] font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 7 ? 'bg-[#00FE89] text-[#002225]' : 'bg-slate-100'}`}>4</span>
            <span>Stage Records</span>
          </div>
          <span className="text-slate-300 px-2">&rarr;</span>
          <div className={`flex items-center gap-1.5 whitespace-nowrap ${step >= 9 ? 'text-[#008271] font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${step >= 9 ? 'bg-[#00FE89] text-[#002225]' : 'bg-slate-100'}`}>5</span>
            <span>Publish to App</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Execution Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* STEP 1 & 2: Choose Dataset & Download Template */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Step 1 — Choose Target Dataset & Download Official Template</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the data entity you wish to import. Download the prepared CSV template with required column headers and sample data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { id: 'merchants', label: 'Merchants', desc: 'Onboard storefronts & cafes' },
              { id: 'transactions', label: 'Transactions', desc: 'Payment stream collections' },
              { id: 'settlements', label: 'Settlement Events', desc: 'Outflow disbursements' },
              { id: 'calendar_events', label: 'Calendar Context', desc: 'Festivals & holidays' },
            ].map((d) => (
              <div
                key={d.id}
                onClick={() => setDatasetType(d.id)}
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  datasetType === d.id
                    ? 'border-[#00FE89] bg-[#002225] text-white shadow-md'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-900'
                }`}
              >
                <div>
                  <div className="font-bold text-sm mb-1">{d.label}</div>
                  <div className={`text-xs ${datasetType === d.id ? 'text-slate-300' : 'text-slate-500'}`}>{d.desc}</div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold">
                  <span className={datasetType === d.id ? 'text-[#00FE89]' : 'text-[#008271]'}>Selected</span>
                  {datasetType === d.id && <CheckCircle2 className="w-4 h-4 text-[#00FE89]" />}
                </div>
              </div>
            ))}
          </div>

          {/* Download Starter Assets */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-900">Official Prepared Templates for {datasetType.toUpperCase()}</div>
              <div className="text-xs text-slate-500">Download formatted CSV template or pre-filled synthetic demo file.</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={api.downloadTemplateUrl(datasetType)}
                download
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-[#008271]" />
                <span>Blank CSV Template</span>
              </a>
              <a
                href={api.downloadSampleUrl(datasetType)}
                download
                className="px-3.5 py-2 rounded-xl bg-[#002225] text-xs font-bold text-[#00FE89] hover:bg-[#00383D] transition flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#00FE89]" />
                <span>Populated Sample CSV</span>
              </a>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-[#00FE89] hover:bg-[#00FE89]/90 text-[#002225] font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md"
            >
              <span>Proceed to File Upload</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Upload File */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 2 — Upload Source File (.CSV or .XLSX)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Entity: <strong className="text-slate-800 capitalize">{datasetType}</strong>. Files are securely transferred to private storage.
              </p>
            </div>
            <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:underline">Change Dataset</button>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
              file ? 'border-[#00FE89] bg-[#00FE89]/5' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-200 text-[#008271] flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            {file ? (
              <div>
                <div className="text-sm font-bold text-slate-900 mb-1">{file.name}</div>
                <div className="text-xs text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB &bull; Ready for upload</div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-bold text-slate-800 mb-1">Click to select file, or drag and drop here</div>
                <div className="text-xs text-slate-400">Supports standard .csv and .xlsx spreadsheets up to 10MB</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              &larr; Back
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="px-6 py-2.5 bg-[#00FE89] hover:bg-[#00FE89]/90 text-[#002225] font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#002225] border-t-transparent rounded-full animate-spin" />
                  <span>Uploading to Private Storage...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload & Parse Headers</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Parse & Column Mapping Preview */}
      {step === 4 && uploadResult && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 3 — Parse & Header Verification</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Batch ID: <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{batchId}</code> &bull; Detected {uploadResult.total_rows} row(s).
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Storage Key Allocated</span>
            </span>
          </div>

          {/* Detected Headers */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">Detected Columns in File:</div>
            <div className="flex flex-wrap gap-1.5">
              {uploadResult.headers.map((h: string, idx: number) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
                  {h}
                </span>
              ))}
            </div>
          </div>

          {/* Sample Rows Table Preview */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">File Preview (First 5 Rows):</div>
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    {uploadResult.headers.map((h: string, idx: number) => (
                      <th key={idx} className="py-2 px-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uploadResult.preview.map((row: string[], rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-50/60">
                      {row.map((cell: string, cIdx: number) => (
                        <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-slate-700">{cell || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button onClick={() => setStep(3)} className="text-xs font-semibold text-slate-500 hover:underline">
              &larr; Choose Different File
            </button>
            <button
              onClick={handleValidate}
              disabled={loading}
              className="px-6 py-2.5 bg-[#00FE89] hover:bg-[#00FE89]/90 text-[#002225] font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#002225] border-t-transparent rounded-full animate-spin" />
                  <span>Validating All Rows...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Run Row-by-Row Server Validation</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6 & 7: Validation Report & Import Mode Selector */}
      {step === 6 && validationReport && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 4 — Validation Report & Mode Selection</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every row was evaluated against schema formats, duplicate IDs, foreign keys, and synthetic privacy rules.
              </p>
            </div>
            {validationReport.invalid_rows > 0 && (
              <a
                href={api.downloadBatchErrorsUrl(batchId!)}
                download
                className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Error Report (.CSV)</span>
              </a>
            )}
          </div>

          {/* Scorecards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-xs font-semibold text-slate-500 mb-1">Total Evaluated</div>
              <div className="text-xl font-bold text-slate-900">{validationReport.total_rows}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-xs font-semibold text-emerald-700 mb-1">Valid Rows</div>
              <div className="text-xl font-bold text-emerald-800">{validationReport.valid_rows}</div>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <div className="text-xs font-semibold text-rose-700 mb-1">Invalid Rows</div>
              <div className="text-xl font-bold text-rose-800">{validationReport.invalid_rows}</div>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-xs font-semibold text-amber-700 mb-1">Duplicate IDs</div>
              <div className="text-xl font-bold text-amber-800">{validationReport.duplicate_rows}</div>
            </div>
          </div>

          {/* Validation Errors Breakdown */}
          {validationReport.invalid_rows > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Row-by-Row Rejection Details (Sample):</span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-none border border-slate-200 rounded-xl p-3 bg-slate-50">
                {validationReport.reports.filter((r: any) => r.status === 'invalid').map((r: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-white border border-rose-200 rounded-lg text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">Row #{r.row_number} (ID: {r.entity_id || 'N/A'})</span>
                      <span className="text-rose-600 font-semibold uppercase text-[10px]">Rejected</span>
                    </div>
                    {r.errors.map((err: any, eIdx: number) => (
                      <p key={eIdx} className="text-slate-600 text-[11px]">
                        &bull; <strong className="text-rose-700">{err.field}</strong>: {err.message} (Received: <code>{err.received}</code>)
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Mode Selector */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800">Select Staging Mode:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition ${
                importMode === 'strict' ? 'border-[#00FE89] bg-[#002225] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800'
              }`}>
                <input
                  type="radio"
                  name="import_mode"
                  checked={importMode === 'strict'}
                  onChange={() => setImportMode('strict')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-bold">Strict Mode (Default)</div>
                  <div className={`text-[11px] mt-0.5 ${importMode === 'strict' ? 'text-slate-300' : 'text-slate-500'}`}>
                    If even one row is invalid, the entire batch is rejected atomically. Zero partial writes.
                  </div>
                </div>
              </label>

              <label className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition ${
                importMode === 'valid_only' ? 'border-[#00FE89] bg-[#002225] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800'
              }`}>
                <input
                  type="radio"
                  name="import_mode"
                  checked={importMode === 'valid_only'}
                  onChange={() => setImportMode('valid_only')}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-bold">Valid-Rows-Only Mode</div>
                  <div className={`text-[11px] mt-0.5 ${importMode === 'valid_only' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Stages only validated rows. Preserves full audit report for rejected rows.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button onClick={() => setStep(4)} className="text-xs font-semibold text-slate-500 hover:underline">
              &larr; Back to Preview
            </button>
            <button
              onClick={handleStage}
              disabled={loading || (importMode === 'strict' && validationReport.invalid_rows > 0)}
              className="px-6 py-2.5 bg-[#00FE89] hover:bg-[#00FE89]/90 text-[#002225] font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#002225] border-t-transparent rounded-full animate-spin" />
                  <span>Staging Accepted Records...</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>Stage {importMode === 'strict' ? validationReport.total_rows : validationReport.valid_rows} Records</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 8: Staged Confirmation & Publish Prompt */}
      {step === 8 && stagingResult && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Records Successfully Staged in Private Draft State</h3>
              <p className="text-xs text-emerald-700 mt-1">
                Batch <strong>{stagingResult.batch_id}</strong> contains <strong>{stagingResult.staged_rows}</strong> staged records.
                These records are currently invisible on the public dashboard until you explicitly confirm publication.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#002225] text-white border border-[#00383D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-[#00FE89] uppercase tracking-wider mb-1">Publication Gate</div>
              <div className="text-sm font-semibold">Publish {stagingResult.staged_rows} records to public AEGIS-PAY platform?</div>
              <div className="text-xs text-slate-400 mt-0.5">This will update public merchant tables, transaction streams, and analytics immediately.</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('admin-datasets')}
                className="px-4 py-2 rounded-xl bg-[#00383D] text-xs font-bold text-slate-300 hover:text-white transition"
              >
                Keep in Staging
              </button>
              <button
                onClick={handlePublish}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#00FE89] text-xs font-black text-[#002225] hover:bg-[#00FE89]/90 transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#002225] border-t-transparent rounded-full animate-spin" />
                    <span>Publishing to Public App...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish to Public Dashboard</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 10: Final Success Result */}
      {step === 10 && publishResult && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Dataset Published Successfully!</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Public AEGIS-PAY dashboard now reflects <strong>{publishResult.published_rows}</strong> records.
              Dataset version recorded as <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{publishResult.dataset_version}</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('overview')}
              className="px-5 py-2.5 bg-[#002225] text-[#00FE89] font-bold text-xs rounded-xl hover:bg-[#00383D] transition flex items-center gap-2 shadow-sm"
            >
              <span>Explore Public Console &rarr;</span>
            </button>
            <button
              onClick={() => onNavigate('admin-datasets')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
            >
              View Dataset Audit Trail
            </button>
            <button
              onClick={resetWizard}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
