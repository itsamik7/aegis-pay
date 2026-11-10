import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Lock, AlertCircle, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onCancel }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid administrative credentials or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin');
    setPassword('admin123');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#002225] border border-[#00383D] rounded-2xl p-8 shadow-2xl relative text-white">
        {/* Top return button */}
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#00FE89] mb-6 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Public Console</span>
        </button>

        {/* Brand Lock Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#00383D] border border-[#00FE89]/30 flex items-center justify-center text-[#00FE89] shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white">Pay<span className="text-[#00FE89]">U</span></span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#00383D] text-[#00FE89] border border-[#00FE89]/20">
                AEGIS ADMIN
              </span>
            </div>
            <h1 className="text-sm text-slate-300 font-medium">Authorized Administrator Sign-in</h1>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          The Private Admin Portal allows manual data entry, bulk CSV/XLSX file ingestion, staging verification, and publication to the public platform.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              required
              className="w-full px-3.5 py-2.5 bg-[#001719] border border-[#00383D] focus:border-[#00FE89] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-[#001719] border border-[#00383D] focus:border-[#00FE89] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#00FE89] hover:bg-[#00FE89]/90 text-[#002225] font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#002225] border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating Admin...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Access Private Admin Portal</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Demo Credentials Helper Pill */}
        <div className="mt-6 pt-5 border-t border-[#00383D]/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00FE89]" />
            <span>Pre-seeded demo admin: <strong className="text-slate-200">admin / admin123</strong></span>
          </div>
          <button
            type="button"
            onClick={handleQuickFill}
            className="text-[#00FE89] hover:underline font-medium"
          >
            Auto-fill
          </button>
        </div>
      </div>
    </div>
  );
};
