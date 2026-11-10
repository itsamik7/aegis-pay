import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Header } from './components/Header';
import { LegalModal } from './components/LegalModal';

// Pages
import { Overview } from './pages/Overview';
import { Merchants } from './pages/Merchants';
import { Alerts } from './pages/Alerts';
import { Cases } from './pages/Cases';
import { Transactions } from './pages/Transactions';
import { RiskIntelligence } from './pages/RiskIntelligence';
import { SimulationLab } from './pages/SimulationLab';
import { RulesPolicy } from './pages/RulesPolicy';
import { Reports } from './pages/Reports';
import { AuditTrail } from './pages/AuditTrail';
import { SettingsCompliance } from './pages/SettingsCompliance';
import { MerchantPortal } from './pages/MerchantPortal';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [dateRangeDays, setDateRangeDays] = useState<number>(30);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);

  // Navigation metadata parameters
  const [navMeta, setNavMeta] = useState<any>({});

  const handleNavigate = (tab: string, meta?: any) => {
    setCurrentTab(tab);
    if (meta) {
      setNavMeta(meta);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#002124] flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-10 h-10 border-4 border-[#00FE89] border-t-transparent rounded-full animate-spin"></div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-white">Pay<span className="text-[#00FE89]">U</span></span>
          <span className="text-xs text-slate-400 font-medium">&bull; Loading Risk Console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7F8] text-slate-900 flex">
      {/* Persistent Left Navigation Sidebar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setNavMeta({});
        }}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onNavigate={handleNavigate}
          openLegalModal={() => setIsLegalModalOpen(true)}
          dateRangeDays={dateRangeDays}
          setDateRangeDays={setDateRangeDays}
          collapsed={collapsed}
        />

        {/* Page Viewport */}
        <main className="flex-1 mt-16 p-6 max-w-7xl w-full mx-auto">
          {currentTab === 'overview' && (
            <Overview dateRangeDays={dateRangeDays} onNavigate={handleNavigate} />
          )}

          {currentTab === 'merchants' && (
            <Merchants
              initialMerchantId={navMeta.selectedMerchantId}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'alerts' && (
            <Alerts
              initialAlertId={navMeta.selectedAlertId}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'cases' && (
            <Cases
              initialCaseId={navMeta.selectedCaseId}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'transactions' && (
            <Transactions
              initialSearch={navMeta.search}
              onNavigate={handleNavigate}
            />
          )}

          {currentTab === 'risk-intel' && <RiskIntelligence />}

          {currentTab === 'simulation' && (
            <SimulationLab onNavigate={handleNavigate} />
          )}

          {currentTab === 'rules' && <RulesPolicy />}

          {currentTab === 'reports' && <Reports />}

          {currentTab === 'audit' && <AuditTrail />}

          {currentTab === 'compliance' && <SettingsCompliance />}

          {currentTab === 'merchant-portal' && <MerchantPortal />}
        </main>
      </div>

      {/* Compliance Boundaries Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
