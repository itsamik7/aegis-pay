import React from 'react';
import { 
  LayoutDashboard, 
  FileEdit, 
  UploadCloud, 
  Database, 
  History, 
  BookOpen, 
  ArrowLeft,
  ShieldAlert,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminNavHeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export const AdminNavHeader: React.FC<AdminNavHeaderProps> = ({ currentTab, onNavigate }) => {
  const { user, logout } = useAuth();

  const adminTabs = [
    { id: 'admin-overview', label: 'Admin Overview', icon: LayoutDashboard },
    { id: 'admin-data-entry', label: 'Manual Data Entry', icon: FileEdit },
    { id: 'admin-import', label: 'File Import Wizard', icon: UploadCloud },
    { id: 'admin-datasets', label: 'Staged & Datasets', icon: Database },
    { id: 'admin-audit', label: 'Admin Audit Log', icon: History },
    { id: 'admin-guide', label: 'Data Entry Guide', icon: BookOpen },
  ];

  return (
    <div className="bg-[#002225] border border-[#00383D] rounded-2xl p-4 mb-6 shadow-xl text-white">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#00383D]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00383D] border border-[#00FE89]/30 flex items-center justify-center text-[#00FE89]">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white">Pay<span className="text-[#00FE89]">U</span></span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#00FE89]/10 text-[#00FE89] border border-[#00FE89]/30">
                PRIVATE ADMIN PORTAL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Authenticated Admin: <span className="text-slate-200 font-semibold">{user?.full_name || 'Administrator'}</span> ({user?.role})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('overview')}
            className="px-3 py-1.5 rounded-xl bg-[#00383D] hover:bg-[#00484e] text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1.5 border border-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#00FE89]" />
            <span>View Public Platform</span>
          </button>
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 hover:text-rose-200 transition flex items-center gap-1.5 border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Admin Subnav Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pt-3 text-xs scrollbar-none">
        {adminTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#00FE89] text-[#002225] font-bold shadow-md shadow-[#00FE89]/20'
                  : 'text-slate-300 hover:text-white hover:bg-[#00383D]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#002225]' : 'text-[#00FE89]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
