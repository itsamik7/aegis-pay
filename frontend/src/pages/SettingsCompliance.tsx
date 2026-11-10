import React from 'react';
import { Shield, Key, Server, Scale, Lock, Info, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsCompliance: React.FC = () => {
  const { demoUsers, switchUser } = useAuth();

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-[#008271] text-xs font-bold uppercase tracking-wider">
          <Shield size={16} /> System Settings & Compliance
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
          Platform Architecture & Regulatory Safeguards
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Prototype environment configuration, role accounts, and statutory boundaries.
        </p>
      </div>

      {/* Demo Credentials Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Key size={16} className="text-[#008271]" />
              Pre-Configured Demo Accounts (Safe Local Credentials)
            </h3>
            <p className="text-xs text-slate-500">
              Click any profile to instantly authenticate into that role.
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Local Synthetic Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {demoUsers.map((du) => (
            <div
              key={du.id}
              onClick={() => switchUser(du)}
              className="p-4 rounded-2xl border border-slate-200 hover:border-[#00C48C] hover:bg-emerald-50/30 transition cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-slate-900 group-hover:text-[#008271]">
                  {du.full_name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-[#008271]">
                  {du.role}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-0.5 font-mono">
                <div>User: <span className="font-bold text-slate-900">{du.username}</span></div>
                <div>Pass: <span className="font-bold text-slate-900">{du.demo_password}</span></div>
                <div className="text-[10px] font-sans text-slate-400 pt-1">{du.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statutory Disclaimers */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Scale size={16} className="text-[#008271]" />
          Statutory Limitations & Governance Boundaries
        </h3>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <strong className="text-slate-900 block mb-0.5">1. Explainability Over Black-Box Accusations</strong>
            Anomalous payment patterns are treated as statistical signals for graduated inquiry, never proof of money laundering or unlicensed betting.
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <strong className="text-slate-900 block mb-0.5">2. No Automated Funds De-Platforming</strong>
            The platform strictly prohibits algorithmic account termination. Payout containment or rolling reserves remain simulated recommendations requiring authorized compliance counsel determination.
          </div>
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <strong className="text-slate-900 block mb-0.5">3. Payment Provider Rail Visibility</strong>
            Metrics reflect provider-observed transactions only. The platform makes no inference regarding external bank balances or external money flows once funds settle.
          </div>
        </div>
      </div>
    </div>
  );
};
