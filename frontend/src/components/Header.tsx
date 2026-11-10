import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Bell, Shield, ChevronDown, UserCheck, 
  ExternalLink, Calendar, Check, AlertTriangle, Lock, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { DemoUser } from '../types';

interface HeaderProps {
  currentTab: string;
  onNavigate: (tab: string, meta?: any) => void;
  openLegalModal: () => void;
  dateRangeDays: number;
  setDateRangeDays: (days: number) => void;
  collapsed: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigate,
  openLegalModal,
  dateRangeDays,
  setDateRangeDays,
  collapsed
}) => {
  const { user, demoUsers, switchUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const notifs = await api.getNotifications();
        setNotifications(notifs);
      } catch (err) {
        // quiet
      }
    };
    fetchNotifs();
  }, []);

  // Handle Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.search(searchQuery.trim());
        setSearchResults(res);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const titleMap: Record<string, string> = {
    overview: 'Operations Overview',
    merchants: 'Merchant Monitoring & Behavioural Directory',
    alerts: 'Alerts & Risk Queue',
    cases: 'Investigation Case Management',
    transactions: 'Transaction Explorer',
    'risk-intel': 'Risk Intelligence & Signal Catalog',
    simulation: 'Simulation Lab & Evaluation Workbench',
    rules: 'Rules, Weights & Policy Configuration',
    reports: 'Operational & Portfolio Reports',
    audit: 'Immutable Audit Trail',
    compliance: 'Compliance Boundaries & System Settings',
    'merchant-portal': 'Merchant Clarification Demo Portal',
  };

  return (
    <header
      className={`fixed top-0 right-0 z-20 h-16 bg-white border-b border-slate-200 transition-all duration-300 flex items-center justify-between px-6 ${
        collapsed ? 'left-16' : 'left-64'
      }`}
    >
      {/* Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">
            {titleMap[currentTab] || 'AEGIS-PAY'}
          </h1>
          <div className="text-xs text-slate-500 font-medium">
            PayU Merchant Risk Intelligence Console &bull; <span className="text-[#008271] font-bold">Synthetic Sandbox</span>
          </div>
        </div>
      </div>

      {/* Center Global Search */}
      <div className="relative flex-1 max-w-md mx-6" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
          <input
            type="text"
            placeholder="Search merchants, alerts, cases, payer tokens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults) setShowSearchDropdown(true); }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200 focus:border-[#00C48C] focus:ring-2 focus:ring-[#00C48C]/20 outline-none transition"
          />
          {isSearching && (
            <div className="absolute right-3 top-2.5 text-xs text-slate-400 animate-spin">
              &bull;
            </div>
          )}
        </div>

        {/* Live Search Autocomplete Dropdown */}
        {showSearchDropdown && searchResults && (
          <div className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
            {searchResults.merchants?.length === 0 &&
             searchResults.alerts?.length === 0 &&
             searchResults.cases?.length === 0 &&
             searchResults.transactions?.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No matching records found for "{searchQuery}".
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {searchResults.merchants?.length > 0 && (
                  <div className="p-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1">Merchants</div>
                    {searchResults.merchants.map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onNavigate('merchants', { selectedMerchantId: m.id });
                          setShowSearchDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center justify-between text-sm group"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 group-hover:text-[#008271]">{m.name}</div>
                          <div className="text-xs text-slate-500">{m.id} &bull; {m.category} ({m.city})</div>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          Tier {m.tier} ({m.score})
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.cases?.length > 0 && (
                  <div className="p-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1">Cases</div>
                    {searchResults.cases.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onNavigate('cases', { selectedCaseId: c.id });
                          setShowSearchDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center justify-between text-sm group"
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold text-slate-800 group-hover:text-[#008271] truncate">{c.title}</div>
                          <div className="text-xs text-slate-500">{c.id} &bull; {c.merchant_id}</div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-[#008271] font-semibold border border-emerald-200">
                          {c.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.alerts?.length > 0 && (
                  <div className="p-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1">Alerts</div>
                    {searchResults.alerts.map((a: any) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          onNavigate('alerts', { selectedAlertId: a.id });
                          setShowSearchDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center justify-between text-sm group"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 group-hover:text-[#008271]">{a.id}</div>
                          <div className="text-xs text-slate-500">{a.merchant_id} &bull; Score {a.score}</div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold">
                          Tier {a.tier}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Date Filter */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/70 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 transition">
          <Calendar size={14} className="text-slate-500" />
          <select
            value={dateRangeDays}
            onChange={(e) => setDateRangeDays(Number(e.target.value))}
            className="bg-transparent border-none outline-none font-semibold text-slate-800 cursor-pointer"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>

        {/* Compliance Boundaries Button */}
        <button
          onClick={openLegalModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:border-[#008271] text-xs font-semibold text-slate-700 hover:text-[#008271] hover:bg-emerald-50 transition"
          title="View prototype compliance, privacy & regulatory boundaries"
        >
          <Shield size={14} className="text-[#008271]" />
          <span>Compliance Boundaries</span>
        </button>

        {/* User Manual PDF Download */}
        <a
          href="/AEGIS_PAY_User_Manual_and_Feature_Guide.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:border-[#008271] text-xs font-semibold text-slate-700 hover:text-[#008271] hover:bg-emerald-50 transition"
          title="Download the complete operational user manual and feature guide in PDF"
        >
          <FileText size={14} className="text-[#008271]" />
          <span>User Manual (PDF)</span>
        </a>

        {/* Admin Portal Gateway Button */}
        <button
          onClick={() => onNavigate('admin-overview')}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002225] text-[#00FE89] border border-[#00FE89]/30 hover:bg-[#00383D] text-xs font-bold transition shadow-sm"
          title="Open private admin portal for data ingestion and publication"
        >
          <Lock size={13} className="text-[#00FE89]" />
          <span>Admin Portal</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold text-slate-800">Operational Notifications</span>
                <span className="text-[11px] font-semibold text-[#008271] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {unreadCount} unread
                </span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl text-xs transition ${
                      n.is_read ? 'bg-slate-50 text-slate-600' : 'bg-emerald-50/70 border border-emerald-100 text-slate-800'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00C48C]" />
                      {n.title}
                    </div>
                    <p className="text-slate-600 text-[11px] mt-1">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PayU Demo User Switcher / Profile */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition"
          >
            <div className="h-7 w-7 rounded-lg bg-[#00383D] border border-[#004F56] text-[#00FE89] font-black text-xs flex items-center justify-center shadow-sm">
              {user?.full_name ? user.full_name[0] : 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {user?.full_name || 'Demo Analyst'}
              </div>
              <div className="text-[10px] font-semibold text-[#008271]">
                {user?.role || 'Risk Analyst'}
              </div>
            </div>
            <ChevronDown size={14} className="text-slate-500" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-50">
              <div className="px-3 py-2 border-b border-slate-100 mb-1.5">
                <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                  Switch Active Role (PayU RBAC)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Test role-based access control and views:
                </div>
              </div>
              <div className="space-y-1">
                {demoUsers.map((du) => {
                  const isCurrent = user?.username === du.username;
                  return (
                    <button
                      key={du.id}
                      onClick={() => {
                        switchUser(du);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                        isCurrent
                          ? 'bg-[#00383D] text-[#00FE89] font-bold border border-[#004F56]'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{du.full_name}</div>
                        <div className={isCurrent ? 'text-emerald-300 text-[10px]' : 'text-slate-400 text-[10px]'}>
                          {du.role}
                        </div>
                      </div>
                      {isCurrent && <Check size={16} className="text-[#00FE89]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
