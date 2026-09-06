import React, { useState } from 'react';
import Navbar from './components/Navbar';
import AdminDashboard from './components/AdminDashboard';
import FlightSearch from './components/FlightSearch';
import WaitlistStatus from './components/WaitlistStatus';
import { Database, ShieldCheck, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('search');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-sky-500 selection:text-white">
      
      {/* Navbar with Dual-Writer Status */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'search' && (
          <FlightSearch onNavigateWaitlist={() => setActiveTab('waitlist')} />
        )}
        {activeTab === 'admin' && (
          <AdminDashboard />
        )}
        {activeTab === 'waitlist' && (
          <WaitlistStatus />
        )}
      </main>

      {/* Enterprise Dual-Writer Architecture Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-400">SkyLedger System Architecture</span>
            <span>•</span>
            <span>FastAPI (Exclusive Live Write Path) + n8n (Background Automation Engine)</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Supabase PostgreSQL Single Ledger</span>
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pessimistic & SKIP LOCKED Locks</span>
            </span>
          </div>

        </div>
      </footer>

    </div>
  );
}
