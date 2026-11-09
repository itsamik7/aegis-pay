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
      className={`fixed top-0 left-0 z-30 h-screen bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col border-r border-slate-800 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => setCurrentTab('overview')}>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/40 flex-shrink-0">
            <span className="font-black text-white text-lg tracking-wider">A</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-white text-base tracking-tight leading-none flex items-center gap-1.5">
                AEGIS<span className="text-purple-400 font-semibold">-PAY</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">
                Merchant Intelligence
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
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
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : item.merchantSpecial
                  ? 'bg-slate-800/60 hover:bg-slate-800 text-amber-300 border border-amber-500/20 mt-3'
                  : 'hover:bg-slate-800/70 text-slate-300 hover:text-white'
              }`}
            >
              <Icon
                size={19}
                className={`flex-shrink-0 transition ${
                  isActive
                    ? 'text-white'
                    : item.merchantSpecial
                    ? 'text-amber-400'
                    : 'text-slate-400 group-hover:text-purple-300'
                }`}
              />
              {!collapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-purple-800 text-white' : 'bg-slate-800 text-purple-300 border border-purple-800/40'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              {!collapsed && item.highlight && !isActive && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Prototype Notice */}
      {!collapsed ? (
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400">
          <div className="font-semibold text-slate-300">Independent Case Study</div>
          <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
            Synthetic Data Only. Not official PayU software.
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-slate-800 text-center text-[10px] text-slate-400">
          PROTOTYPE
        </div>
      )}
    </aside>
  );
};
