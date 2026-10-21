import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import QuickInvoiceModal from './QuickInvoiceModal';
import InvoiceEditRequestAlerts from './InvoiceEditRequestAlerts';
import WelcomeModal from './WelcomeModal';
import { backupConfigAPI, chatAPI, chatSocketProtocols, chatSocketURL, welcomeAPI } from '../services/api';
import api from '../services/api';

type ChatNotice = { sender: string; text: string };

const ChatRealtimeBridge = () => {
  const user = useSelector((state: any) => state.auth.currentUser);
  const isAuthenticated = useSelector((state: any) => state.auth.isAuthenticated);
  const [notice, setNotice] = React.useState<ChatNotice | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    let active = true;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let noticeTimer: number | undefined;
    let heartbeatTimer: number | undefined;
    let reconnectDelay = 1000;

    const setConnection = (connected: boolean) => window.dispatchEvent(new CustomEvent('mohaseb:chat-connection', { detail: { connected } }));
    const refreshUnread = () => chatAPI.unread().then(({ data }) => {
      if (active) window.dispatchEvent(new CustomEvent('mohaseb:chat-unread', { detail: { count: data.count || 0 } }));
    }).catch(() => {});
    const handleVisibility = () => { if (!document.hidden) refreshUnread(); };
    const handleRead = () => window.dispatchEvent(new CustomEvent('mohaseb:chat-unread', { detail: { count: 0 } }));

    const connect = () => {
      if (!active) return;
      try { socket = new WebSocket(chatSocketURL(), chatSocketProtocols()); }
      catch { scheduleReconnect(); return; }
      socket.onopen = () => {
        reconnectDelay = 1000;
        setConnection(true);
        window.dispatchEvent(new CustomEvent('mohaseb:chat-presence'));
        refreshUnread();
        heartbeatTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'heartbeat' }));
        }, 30000);
      };
      socket.onmessage = (event) => {
        let payload: any;
        try { payload = JSON.parse(event.data); } catch { return; }
        if (payload.type === 'presence') {
          window.dispatchEvent(new CustomEvent('mohaseb:chat-presence'));
          return;
        }
        if (payload.type === 'deleted') {
          window.dispatchEvent(new CustomEvent('mohaseb:chat-deleted', { detail: { id: payload.message_id } }));
          return;
        }
        if (payload.type !== 'message' || !payload.message) return;
        const message = payload.message;
        window.dispatchEvent(new CustomEvent('mohaseb:chat-message', { detail: message }));
        if (Number(message.sender) === Number(user.id)) return;
        const onChatPage = window.location.pathname === '/chat' && !document.hidden;
        if (!onChatPage) {
          chatAPI.unread().then(({ data }) => window.dispatchEvent(new CustomEvent('mohaseb:chat-unread', { detail: { count: data.count || 0 } }))).catch(() => {});
          setNotice({ sender: message.sender_name, text: message.text || `فایل پیوست: ${message.file_name}` });
          window.clearTimeout(noticeTimer);
          noticeTimer = window.setTimeout(() => setNotice(null), 7000);
        }
        if (!onChatPage && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const notification = new Notification(`پیام جدید از ${message.sender_name}`, {
              body: message.text || `فایل پیوست: ${message.file_name}`,
              tag: `mohaseb-chat-${message.id}`,
            });
            notification.onclick = () => { window.focus(); window.location.href = '/chat'; notification.close(); };
          } catch { /* Browser notification delivery is optional. */ }
        }
      };
      socket.onclose = () => { window.clearInterval(heartbeatTimer); setConnection(false); scheduleReconnect(); };
      socket.onerror = () => socket?.close();
    };
    const scheduleReconnect = () => {
      if (!active || reconnectTimer) return;
      setConnection(false);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        refreshUnread();
        connect();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };

    window.addEventListener('mohaseb:chat-read', handleRead);
    document.addEventListener('visibilitychange', handleVisibility);
    connect();
    return () => {
      active = false;
      window.removeEventListener('mohaseb:chat-read', handleRead);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(noticeTimer);
      window.clearInterval(heartbeatTimer);
      socket?.close();
    };
  }, [isAuthenticated, user?.id]);

  return notice ? <a href="/chat" onClick={() => setNotice(null)} className="fixed left-5 top-20 z-[60] max-w-sm rounded-2xl border border-blue-400/30 bg-slate-800 px-4 py-3 text-right shadow-2xl shadow-black/30"><p className="text-sm font-semibold text-blue-200">پیام تازه از {notice.sender}</p><p className="mt-1 truncate text-xs text-slate-300">{notice.text}</p><span className="mt-2 block text-[10px] text-blue-300">برای مشاهده وارد گفتگو شوید</span></a> : null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<unknown>;
};

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [quickInvoice, setQuickInvoice] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const isAuthenticated = useSelector((state: any) => state.auth.isAuthenticated);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    welcomeAPI.today().then(({ data }) => {
      if (data.show && data.message) setWelcomeMessage(data.message);
    }).catch(() => {});
  }, [isAuthenticated]);

  React.useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let lastRevision: string | undefined;
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

  React.useEffect(() => {
    const captureInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
  }, []);

  const installPwa = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div data-theme={localStorage.getItem("app-theme") || "dark"} className="min-h-screen bg-slate-950 font-vazirmatn" dir="rtl">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(value => { localStorage.setItem('sidebar-collapsed', String(!value)); return !value; })} onClose={() => setSidebarOpen(false)} />
      <ChatRealtimeBridge />
      <InvoiceEditRequestAlerts />
      {welcomeMessage && <WelcomeModal message={welcomeMessage} onClose={() => setWelcomeMessage('')} />}

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
      {installPrompt && <button type="button" onClick={installPwa} className="fixed bottom-24 left-6 z-40 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-emerald-900/30 hover:bg-emerald-500">⬇ نصب محاسب پرو</button>}
    </div>
  );
};

export default Layout;
