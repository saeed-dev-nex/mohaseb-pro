import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { invoicesAPI } from '../services/api';

const InvoiceEditRequestAlerts = () => {
  const user = useSelector((state) => state.auth.currentUser);
  const isManager = Boolean(user?.is_staff || user?.is_superuser);
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!isManager) return undefined;
    let active = true;
    let timer;
    const refresh = async () => {
      try {
        const { data } = await invoicesAPI.editRequests();
        if (active) setRequests(data);
      } catch {
        // Keep the last known requests visible while the API is temporarily unavailable.
      } finally {
        if (active) timer = window.setTimeout(refresh, 3000);
      }
    };
    refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [isManager]);

  const review = async (item, decision) => {
    setBusyId(item.id);
    try {
      await invoicesAPI.reviewEditRequest(item.invoice_id, item.id, decision);
      setRequests((current) => current.filter((request) => request.id !== item.id));
    } finally {
      setBusyId(null);
    }
  };

  if (!isManager || requests.length === 0) return null;

  return (
    <div className="fixed left-4 top-20 z-[80] w-[min(26rem,calc(100vw-2rem))] space-y-2" aria-live="polite">
      {requests.map((item) => (
        <section key={item.id} className="rounded-2xl border border-amber-400/50 bg-white p-4 shadow-2xl shadow-slate-900/20">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl" aria-hidden="true">🔔</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">درخواست ویرایش فاکتور پرداخت‌شده</p>
              <p className="mt-1 text-sm text-slate-600">
                {item.requested_by} برای فاکتور <Link className="font-semibold text-blue-700 hover:underline" to={`/invoices/${item.invoice_id}`}>{item.invoice_number}</Link> درخواست داده است.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => review(item, 'approve')} disabled={busyId === item.id} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">تأیید یک‌بار ویرایش</button>
                <button type="button" onClick={() => review(item, 'reject')} disabled={busyId === item.id} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50">رد درخواست</button>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export default InvoiceEditRequestAlerts;
