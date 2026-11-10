import React from 'react';
import { 
  LayoutDashboard, Store, AlertOctagon, FolderKanban, 
  ArrowLeftRight, Sparkles, FlaskConical, Sliders, 
  BarChart3, History, ShieldAlert, ChevronLeft, ChevronRight,
  StoreIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  setCollapsed
}) => {
  const { user, isAdmin, isMerchant } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'merchants', label: 'Merchant Monitoring', icon: Store },
    { id: 'alerts', label: 'Alerts & Risk Queue', icon: AlertOctagon, badge: '4' },
    { id: 'cases', label: 'Investigation Cases', icon: FolderKanban, badge: '2' },
    { id: 'transactions', label: 'Transaction Explorer', icon: ArrowLeftRight },
    { id: 'risk-intel', label: 'Risk Intelligence', icon: Sparkles },
    { id: 'simulation', label: 'Simulation Lab', icon: FlaskConical, highlight: true },
    ...(isAdmin ? [{ id: 'rules', label: 'Rules & Policy', icon: Sliders }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'audit', label: 'Audit Trail', icon: History },
    { id: 'compliance', label: 'Compliance & Settings', icon: ShieldAlert },
    { id: 'merchant-portal', label: 'Merchant Demo Portal', icon: StoreIcon, merchantSpecial: true },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-screen bg-[#002225] text-slate-300 transition-all duration-300 flex flex-col border-r border-[#003B3F] ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* PayU Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#003B3F] bg-[#001D20]">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => setCurrentTab('overview')}>
          <div className="h-9 w-9 rounded-xl bg-[#00383D] border border-[#004F56] flex items-center justify-center shadow-md flex-shrink-0">
            <span className="font-black text-white text-base tracking-tighter">
              P<span className="text-[#00FE89]">U</span>
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-white text-lg tracking-tight">Pay<span className="text-[#00FE89]">U</span></span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#00383D] text-[#00FE89] border border-[#00FE89]/20">
                  AEGIS
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">
                Risk & Laundering Hub
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-[#00FE89] p-1.5 rounded-lg hover:bg-[#003136] transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition group relative ${
                isActive
                  ? 'bg-[#00383D] text-[#00FE89] font-bold border-l-4 border-[#00FE89] shadow-inner'
                  : item.merchantSpecial
                  ? 'bg-[#002B2E] hover:bg-[#00383D] text-emerald-300 border border-emerald-500/30 mt-3'
                  : 'hover:bg-[#002D31] text-slate-300 hover:text-white'
              }`}
            >
              <Icon
                size={19}
                className={`flex-shrink-0 transition ${
                  isActive
                    ? 'text-[#00FE89]'
                    : item.merchantSpecial
                    ? 'text-emerald-400'
                    : 'text-slate-400 group-hover:text-[#00FE89]'
                }`}
              />
              {!collapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-[#002225] text-[#00FE89] border border-[#00FE89]/40' : 'bg-[#00383D] text-[#00FE89] border border-[#004D54]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              {!collapsed && item.highlight && !isActive && (
                <span className="h-2 w-2 rounded-full bg-[#00FE89] animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* PayU Footer Status Widget */}
      {!collapsed ? (
        <div className="p-3.5 border-t border-[#003B3F] bg-[#001D20] text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#00FE89] animate-pulse"></span>
              PayU Engine v2.4
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00383D] text-[#00FE89] font-mono">SANDBOX</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 leading-snug">
            Synthetic Case Study Prototype.
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-[#003B3F] text-center text-[10px] text-[#00FE89] font-bold">
          PayU
        </div>
      )}
    </aside>
  );
};
