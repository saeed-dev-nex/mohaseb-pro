import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { chatAPI } from '../services/api';

const timeLabel = (value) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(value));
const mergeMessages = (current, incoming) => {
  const rows = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) rows.set(item.id, item);
  return [...rows.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
};

const Chat = () => {
  const currentUser = useSelector((state) => state.auth.currentUser);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [filterSender, setFilterSender] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await chatAPI.list();
      setMessages((previous) => mergeMessages(previous, data));
    } catch {
      setError('دریافت پیام‌ها انجام نشد. اتصال سرور را بررسی کنید.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadMessages();
    chatAPI.markRead().then(() => window.dispatchEvent(new CustomEvent('mohaseb:chat-read'))).catch(() => {});
    const onMessage = (event) => {
      const message = event.detail;
      if (!message) return;
      setMessages((previous) => mergeMessages(previous, [message]));
      if (document.visibilityState === 'visible') {
        chatAPI.markRead().then(() => window.dispatchEvent(new CustomEvent('mohaseb:chat-read'))).catch(() => {});
      }
    };
    const onConnection = (event) => setConnected(Boolean(event.detail?.connected));
    window.addEventListener('mohaseb:chat-message', onMessage);
    window.addEventListener('mohaseb:chat-connection', onConnection);
    return () => {
      window.removeEventListener('mohaseb:chat-message', onMessage);
      window.removeEventListener('mohaseb:chat-connection', onConnection);
    };
  }, [loadMessages]);

  useEffect(() => {
    if (connected) return undefined;
    const timer = window.setInterval(loadMessages, 3000);
    return () => window.clearInterval(timer);
  }, [connected, loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if ((!text.trim() && !file) || sending) return;
    const body = new FormData();
    body.append('text', text.trim());
    if (file) body.append('file', file);
    setSending(true); setError('');
    try {
      const { data } = await chatAPI.create(body);
      setMessages((previous) => mergeMessages(previous, [data]));
      setText(''); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const response = err.response?.data;
      setError(response?.file?.[0] || response?.text?.[0] || response?.detail || response?.non_field_errors?.[0] || 'ارسال پیام انجام نشد.');
    } finally { setSending(false); }
  };

  const downloadFile = async (message) => {
    try {
      const { data } = await chatAPI.download(message.id);
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = message.file_name || 'chat-file'; anchor.click();
      URL.revokeObjectURL(url);
    } catch { setError('دریافت فایل انجام نشد.'); }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    setNotificationPermission(await Notification.requestPermission());
  };

  const senders = useMemo(() => [...new Map(messages.map((message) => [message.sender, { id: message.sender, name: message.sender_name }])).values()], [messages]);
  const visibleMessages = filterSender ? messages.filter((message) => String(message.sender) === filterSender) : messages;

  return (
    <section className="mx-auto flex h-[calc(100vh-8rem)] max-w-5xl min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60 shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-800/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-xl">💬</div>
          <div><h1 className="font-bold text-white">گفتگوی کاربران</h1><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />{connected ? 'اتصال زنده برقرار است' : 'در حال اتصال…'}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="فیلتر پیام بر اساس کاربر" value={filterSender} onChange={(event) => setFilterSender(event.target.value)} className="max-w-44 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200">
            <option value="">پیام‌های همه کاربران</option>
            {senders.map((sender) => <option key={sender.id} value={sender.id}>{sender.name}</option>)}
          </select>
          {notificationPermission === 'default' && <button type="button" onClick={enableNotifications} className="rounded-xl border border-blue-500/30 px-3 py-2 text-xs text-blue-300 hover:bg-blue-500/10">فعال‌کردن اعلان</button>}
          {notificationPermission === 'granted' && <span className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">اعلان فعال است</span>}
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
        {loading ? <p className="py-12 text-center text-sm text-slate-500">در حال دریافت پیام‌ها…</p> : null}
        {!loading && visibleMessages.length === 0 && <div className="py-16 text-center"><p className="text-3xl">👋</p><p className="mt-3 text-sm text-slate-300">هنوز پیامی ثبت نشده است</p><p className="mt-1 text-xs text-slate-500">گفتگوی تیم را با ارسال یک پیام شروع کنید.</p></div>}
        {visibleMessages.map((message) => {
          const mine = Number(message.sender) === Number(currentUser?.id);
          return <article key={message.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${mine ? 'bg-blue-600/25 text-blue-200' : 'bg-violet-600/20 text-violet-200'}`}>{(message.sender_name || '?').slice(0, 1)}</div>
            <div className={`max-w-[85%] sm:max-w-[72%] ${mine ? 'text-left' : 'text-right'}`}>
              <div className={`mb-1 flex items-center gap-2 text-[11px] text-slate-400 ${mine ? 'justify-end' : ''}`}><span className="font-semibold text-slate-300">{mine ? 'شما' : message.sender_name}</span><time>{timeLabel(message.created_at)}</time></div>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-7 ${mine ? 'rounded-tr-md bg-blue-600/20 text-blue-50' : 'rounded-tl-md bg-slate-800 text-slate-100'}`}>
                {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
                {message.file_name && <button type="button" onClick={() => downloadFile(message)} className={`mt-2 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/5 ${mine ? 'mr-auto' : ''}`}><span>📎</span><span className="max-w-56 truncate">{message.file_name}</span><span className="text-slate-400">دریافت</span></button>}
              </div>
            </div>
          </article>;
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p role="alert" className="px-5 pb-2 text-xs text-rose-300">{error}</p>}
      <form onSubmit={sendMessage} className="border-t border-slate-700/60 bg-slate-800/40 p-3 sm:p-4">
        {file && <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2 text-xs text-slate-300"><span className="truncate">📎 {file.name}</span><button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="mr-3 text-rose-300">حذف</button></div>}
        <div className="flex items-end gap-2">
          <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-700 text-lg text-slate-300 hover:bg-slate-700" title="پیوست فایل">📎<input ref={fileInputRef} type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} maxLength={5000} placeholder="پیام خود را بنویسید… (Enter برای ارسال)" className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          <button type="submit" disabled={sending || (!text.trim() && !file)} className="h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">{sending ? '…' : 'ارسال'}</button>
        </div>
      </form>
    </section>
  );
};

export default Chat;
