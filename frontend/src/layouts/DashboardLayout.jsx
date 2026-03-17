import React from 'react';
import { Shield, LayoutDashboard, Server, FileText, Settings } from 'lucide-react';

export function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="text-[#0ea5e9]" />
            PQC Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">Hackathon User</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <a href="#" className="flex items-center gap-3 px-3 py-2 bg-[#0284c7]/20 text-[#0ea5e9] rounded-lg">
            <LayoutDashboard size={20} /> Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Server size={20} /> Asset Discovery
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <Shield size={20} /> CBOM Inventory
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
            <FileText size={20} /> Reporting
          </a>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Posture of PQC</h2>
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Settings size={20} className="text-slate-500" />
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}