import React, { useState, useEffect } from 'react';
import { Plane, Database, ShieldCheck, Cpu, RefreshCw, LayoutDashboard, Search, Users } from 'lucide-react';
import { checkBackendHealth } from '../api/client';

export default function Navbar({ activeTab, setActiveTab }) {
  const [backendConnected, setBackendConnected] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    const health = await checkBackendHealth();
    setBackendConnected(!!health);
    setChecking(false);
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo & Architecture Specs */}
          <div className="flex items-center space-x-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
              <Plane className="w-6 h-6 text-white transform -rotate-12" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-white">SkyLedger</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Dual-Writer Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>Supabase PostgreSQL Single Ledger</span>
              </p>
            </div>
          </div>

          {/* Core View Switcher Tabs */}
          <nav className="hidden md:flex items-center p-1.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'search'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search & Booking</span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'admin'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Admin Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('waitlist')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'waitlist'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Waitlist & Status</span>
            </button>
          </nav>

          {/* System Ledger Status Badge */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={checkStatus} 
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="Check Ledger Connection"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span className="font-medium text-slate-300">
                {backendConnected ? 'FastAPI Live DB' : 'Simulated Ledger Mode'}
              </span>
            </div>
          </div>

        </div>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex items-center justify-around py-3 border-t border-slate-800/60">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center space-y-1 text-xs font-medium ${
              activeTab === 'search' ? 'text-sky-400' : 'text-slate-400'
            }`}
          >
            <Search className="w-5 h-5" />
            <span>Search</span>
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center space-y-1 text-xs font-medium ${
              activeTab === 'admin' ? 'text-sky-400' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Admin</span>
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`flex flex-col items-center space-y-1 text-xs font-medium ${
              activeTab === 'waitlist' ? 'text-sky-400' : 'text-slate-400'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Waitlist</span>
          </button>
        </div>

      </div>
    </header>
  );
}
