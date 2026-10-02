import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Search, 
  Users, 
  Network, 
  BarChart3, 
  Sliders, 
  FileSearch,
  Activity,
  Terminal,
  ExternalLink
} from 'lucide-react';

import { DashboardView } from './views/DashboardView';
import { AlertsView } from './views/AlertsView';
import { InvestigationView } from './views/InvestigationView';
import { AccountsView } from './views/AccountsView';
import { NetworkView } from './views/NetworkView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';
import { AIChatView } from './views/AIChatView';
import { Bot } from 'lucide-react';

type Tab = 'dashboard' | 'alerts' | 'investigation' | 'accounts' | 'network' | 'analytics' | 'chat' | 'settings';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [investigatingAccountId, setInvestigatingAccountId] = useState<string>('ACCT_149010');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  const navigateToInvestigation = (accountId: string) => {
    setInvestigatingAccountId(accountId);
    setActiveTab('investigation');
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = globalSearch.trim().toUpperCase();
    if (query.startsWith('ACCT_') || query.startsWith('ALT_')) {
      if (query.startsWith('ACCT_')) {
        navigateToInvestigation(query);
      } else {
        setActiveTab('alerts');
      }
      setGlobalSearch('');
    } else if (query) {
      navigateToInvestigation(query);
      setGlobalSearch('');
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] text-slate-800 overflow-hidden">
      {/* Sidebar - Modern White-Blue Executive Navigation */}
      <aside className="w-60 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none shadow-[2px_0_16px_rgba(37,99,235,0.03)] z-10">
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-slate-200/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-normal text-slate-900 text-base tracking-tight">
                MuleTrace
              </div>
              <div className="text-[11px] text-blue-600 font-normal tracking-wide">
                RBI INNOVATION HUB AML
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'dashboard'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'alerts'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <ShieldAlert className={`w-4 h-4 ${activeTab === 'alerts' ? 'text-rose-600' : 'text-rose-500'}`} />
              <span>Alert Queue</span>
            </button>

            <button
              onClick={() => setActiveTab('investigation')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'investigation'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <FileSearch className={`w-4 h-4 ${activeTab === 'investigation' ? 'text-amber-600' : 'text-amber-500'}`} />
              <span>Investigation</span>
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'accounts'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'accounts' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>Accounts Directory</span>
            </button>

            <button
              onClick={() => setActiveTab('network')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'network'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Network className={`w-4 h-4 ${activeTab === 'network' ? 'text-sky-600' : 'text-sky-500'}`} />
              <span>Network Topology</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'analytics'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-indigo-600' : 'text-indigo-500'}`} />
              <span>Behavioral Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'chat'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bot className="w-4 h-4 text-blue-600" />
                <span>AI Forensic Copilot</span>
              </div>
              <span className="px-1.5 py-0.5 text-[11px] font-normal rounded bg-blue-100 text-blue-700 border border-blue-200">
                AI
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === 'settings'
                  ? 'font-semibold bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'font-normal text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Sliders className={`w-4 h-4 ${activeTab === 'settings' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>Threshold Settings</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content View Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100/40">
        {/* Top Header Bar */}
        <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.03)] z-10">
          {/* Global Quick Search */}
          <form onSubmit={handleGlobalSearch} className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Jump to Account ID (e.g. ACCT_149010)..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none shadow-xs transition-all font-sans"
            />
          </form>

          {/* Quick Presets & AI Copilot */}
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setActiveTab('chat')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-[0_0_12px_rgba(37,99,235,0.3)] transition-all"
              title="Open AI Forensic Copilot Assistant"
            >
              <Bot className="w-3.5 h-3.5 text-white" />
              <span>Ask AI Copilot</span>
            </button>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-7 w-full max-w-none">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigateToInvestigation={navigateToInvestigation}
              onNavigateToAlerts={() => setActiveTab('alerts')}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              onInvestigateAccount={navigateToInvestigation}
            />
          )}

          {activeTab === 'investigation' && (
            <InvestigationView
              accountId={investigatingAccountId}
              onBack={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsView
              onInvestigateAccount={navigateToInvestigation}
            />
          )}

          {activeTab === 'network' && (
            <NetworkView
              initialAccountId={investigatingAccountId}
              onSelectAccount={navigateToInvestigation}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}

          {activeTab === 'chat' && (
            <AIChatView
              onNavigateToInvestigation={navigateToInvestigation}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
