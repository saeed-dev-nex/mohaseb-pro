import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import QuickInvoiceModal from './QuickInvoiceModal';
import InvoiceEditRequestAlerts from './InvoiceEditRequestAlerts';
import { backupConfigAPI } from '../services/api';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickInvoice, setQuickInvoice] = useState(false);
  const isSuperuser = useSelector((state) => state.auth.currentUser?.is_superuser);

  React.useEffect(() => {
    if (!isSuperuser) return undefined;
    backupConfigAPI.checkAuto().catch(() => {});
    const timer = window.setInterval(() => backupConfigAPI.checkAuto().catch(() => {}), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isSuperuser]);

  return (
    <div data-theme={localStorage.getItem("app-theme") || "dark"} className="min-h-screen bg-slate-950 font-vazirmatn" dir="rtl">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <InvoiceEditRequestAlerts />

      {/* Main content - offset for sidebar on desktop */}
      <div className="lg:mr-64 flex flex-col min-h-screen">
        <Navbar onMenuToggle={() => setSidebarOpen(prev => !prev)} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>

      {/* Quick Invoice FAB */}
      <button
        onClick={() => setQuickInvoice(true)}
        title="فاکتور سریع"
        className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-2xl
          bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
          text-white shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50
          flex items-center justify-center text-2xl
          transition-all duration-300 hover:scale-110 active:scale-95
          group"
      >
        ⚡
        {/* Tooltip */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          bg-slate-800 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg border border-slate-700
          opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          فاکتور سریع
        </span>
      </button>

      {/* Quick Invoice Modal */}
      <QuickInvoiceModal
        isOpen={quickInvoice}
        onClose={() => setQuickInvoice(false)}
        onSuccess={() => {}}
      />
    </div>
  );
};

export default Layout;
