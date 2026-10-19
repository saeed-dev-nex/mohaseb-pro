import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import QuickInvoiceModal from './QuickInvoiceModal';
import InvoiceEditRequestAlerts from './InvoiceEditRequestAlerts';
import { backupConfigAPI } from '../services/api';
import api from '../services/api';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [quickInvoice, setQuickInvoice] = useState(false);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  React.useEffect(() => {
    let active = true;
    let timer;
    let lastRevision;
    const poll = async () => {
      try {
        const { data } = await api.get('changes/');
        const revision = JSON.stringify(data.revision);
        if (lastRevision !== undefined && revision !== lastRevision) {
          window.dispatchEvent(new CustomEvent('mohaseb:data-changed'));
        }
        lastRevision = revision;
      } catch {
        // Retry after a short delay; normal API errors are handled elsewhere.
      } finally {
        if (active) timer = window.setTimeout(poll, document.hidden ? 5000 : 1000);
      }
    };
    const onVisible = () => {
      if (!document.hidden && active) {
        window.clearTimeout(timer);
        poll();
      }
    };
    poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    backupConfigAPI.checkAuto().catch(() => {});
    const timer = window.setInterval(() => backupConfigAPI.checkAuto().catch(() => {}), 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated]);

  return (
    <div data-theme={localStorage.getItem("app-theme") || "dark"} className="min-h-screen bg-slate-950 font-vazirmatn" dir="rtl">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(value => { localStorage.setItem('sidebar-collapsed', String(!value)); return !value; })} onClose={() => setSidebarOpen(false)} />
      <InvoiceEditRequestAlerts />

      {/* Main content - offset for sidebar on desktop */}
      <div className={`${sidebarCollapsed ? 'lg:mr-20' : 'lg:mr-64'} flex flex-col min-h-screen transition-[margin] duration-300`}>
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
