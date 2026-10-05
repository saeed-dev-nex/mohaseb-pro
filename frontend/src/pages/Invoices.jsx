import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchInvoices, markInvoicePaid, cancelInvoice, deleteInvoice } from '../features/invoicesSlice';
import { StatusBadge, Button, Spinner, EmptyState, ConfirmDialog, formatPrice } from '../components/ui';
import { invoicesAPI } from '../services/api';

const invoiceTabs = [
  { value: 'pending', label: 'پرداخت نشده' },
  { value: 'paid', label: 'پرداخت شده' },
  { value: '', label: 'کل فاکتورها' },
];

const Invoices = () => {
  const dispatch = useDispatch();
  const { list, loading } = useSelector(s => s.invoices);
  const currentUser = useSelector(s => s.auth.currentUser);
  const canSeeIssuer = Boolean(currentUser?.is_staff || currentUser?.is_superuser);
  const isManager = Boolean(currentUser?.is_staff || currentUser?.is_superuser);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const initialStatus = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState(['pending', 'paid'].includes(initialStatus) ? initialStatus : initialStatus === '' ? '' : 'pending');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [editRequests, setEditRequests] = useState([]);
  const hasWaitingEditApproval = !isManager && list.some((invoice) => invoice.status === 'paid' && invoice.edit_request_status === 'pending');

  useEffect(() => {
    dispatch(fetchInvoices({ status: statusFilter, search }));
  }, [dispatch, statusFilter, search]);

  useEffect(() => {
    if (!hasWaitingEditApproval) return undefined;
    const timer = window.setInterval(() => dispatch(fetchInvoices({ status: statusFilter, search })), 3000);
    return () => window.clearInterval(timer);
  }, [dispatch, hasWaitingEditApproval, statusFilter, search]);

  const refreshEditRequests = async () => {
    if (!isManager) return;
    try { const { data } = await invoicesAPI.editRequests(); setEditRequests(data); } catch { setEditRequests([]); }
  };

  useEffect(() => {
    if (!isManager) return undefined;
    refreshEditRequests();
    const timer = window.setInterval(refreshEditRequests, 3000);
    return () => window.clearInterval(timer);
  }, [isManager]);

  const requestEdit = async (id) => {
    setActionLoading(`${id}_request`);
    try { await invoicesAPI.requestEdit(id); await dispatch(fetchInvoices({ status: statusFilter, search })); }
    finally { setActionLoading(null); }
  };

  const reviewEditRequest = async (item, decision) => {
    setActionLoading(`${item.id}_${decision}`);
    try {
      await invoicesAPI.reviewEditRequest(item.invoice_id, item.id, decision);
      await refreshEditRequests();
      await dispatch(fetchInvoices({ status: statusFilter, search }));
    } finally { setActionLoading(null); }
  };

  const selectTab = (status) => {
    setStatusFilter(status);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('status', status);
    setSearchParams(nextParams);
  };

  const handleMarkPaid = async (id) => {
    setActionLoading(id + '_paid');
    await dispatch(markInvoicePaid(id));
    setActionLoading(null);
  };

  const handleCancel = async (id) => {
    setActionLoading(id + '_cancel');
    await dispatch(cancelInvoice(id));
    setActionLoading(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await dispatch(deleteInvoice(deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const persianDate = (dateStr) => {
    if (!dateStr) return '---';
    try {
      return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(dateStr));
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">فاکتورها</h2>
          <p className="text-slate-400 text-sm mt-1">مدیریت و پیگیری فاکتورها</p>
        </div>
        <Link to="/invoices/new">
          <Button variant="primary">+ فاکتور جدید</Button>
        </Link>
      </div>

      {isManager && editRequests.length > 0 && (
        <section className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-amber-700 font-semibold">درخواست‌های ویرایش فاکتور پرداخت‌شده</h3>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-700">{editRequests.length} درخواست</span>
          </div>
          {editRequests.map(item => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-white/60 p-3">
              <div className="text-sm text-slate-700">
                <Link to={`/invoices/${item.invoice_id}`} className="font-semibold text-blue-600 hover:underline">{item.invoice_number}</Link>
                <span className="mx-2">·</span>{item.customer_name || 'بدون نام مشتری'}
                <span className="mx-2">·</span>درخواست‌کننده: {item.requested_by}
              </div>
              <div className="flex gap-2">
                <button onClick={() => reviewEditRequest(item, 'approve')} disabled={!!actionLoading} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">تأیید یک‌بار ویرایش</button>
                <button onClick={() => reviewEditRequest(item, 'reject')} disabled={!!actionLoading} className="rounded-lg border border-red-300 px-3 py-2 text-xs text-red-700 disabled:opacity-50">رد درخواست</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="جستجو: شماره فاکتور، نام مشتری، شماره پلاک یا VIN..."
            className="w-full px-4 py-3 pr-12 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="فیلتر وضعیت فاکتورها">
          {invoiceTabs.map(tab => (
            <button
              key={tab.value || 'all'}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.value}
              onClick={() => selectTab(tab.value)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${statusFilter === tab.value ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/60'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState icon="🧾" title="فاکتوری یافت نشد" description="با کلیک روی فاکتور جدید، اولین فاکتور خود را صادر کنید" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/30 text-slate-400">
                  <th className="text-right py-4 px-5 font-medium">شماره</th>
                  <th className="text-right py-4 px-5 font-medium">مشتری</th>
                  <th className="text-right py-4 px-5 font-medium">زمان ایجاد</th>
                  <th className="text-right py-4 px-5 font-medium">مبلغ</th>
                  <th className="text-right py-4 px-5 font-medium">وضعیت</th>
                  {canSeeIssuer && <th className="text-right py-4 px-5 font-medium">صادرکننده</th>}
                  <th className="py-4 px-5 font-medium text-right">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {list.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-4 px-5">
                      <span className="text-blue-400 font-mono text-xs bg-blue-500/10 px-2 py-1 rounded-lg">
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span className="text-slate-200">{inv.customer_name || '---'}</span>
                      {inv.vehicle_plate && (
                        <span className="block text-slate-500 text-xs font-mono mt-0.5">🚗 {inv.vehicle_plate}</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-slate-400 text-xs">{persianDate(inv.created_at)}<span className="block text-slate-500 mt-1">{inv.created_at ? new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(inv.created_at)) : ''}</span></td>
                    <td className="py-4 px-5 text-white font-medium">{formatPrice(inv.total_amount)}</td>
                    <td className="py-4 px-5"><StatusBadge status={inv.status} /></td>
                    {canSeeIssuer && <td className="py-4 px-5 text-slate-300">{inv.operator_name || '—'}</td>}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
                        >
                          👁️ جزئیات
                        </Link>
                        {inv.status === 'paid' && !isManager && (
                          inv.edit_request_status === 'approved' ?
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-300 border border-green-500/20">درخواست ویرایش تأیید شد</span> :
                          inv.edit_request_status === 'pending' ?
                            <button disabled className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 border border-amber-500/20 cursor-wait">درخواست ویرایش · در انتظار تأیید</button> :
                            <button onClick={() => requestEdit(inv.id)} disabled={!!actionLoading} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/20 disabled:opacity-50">{actionLoading === `${inv.id}_request` ? 'در حال ارسال...' : 'درخواست ویرایش'}</button>
                        )}
                        {inv.can_edit && <Link
                          to={`/invoices/${inv.id}/edit`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
                        >
                          ✏️ ویرایش
                        </Link>}
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => handleMarkPaid(inv.id)}
                            disabled={actionLoading === inv.id + '_paid'}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all disabled:opacity-50"
                          >
                            {actionLoading === inv.id + '_paid' ? '...' : '✅ پرداخت'}
                          </button>
                        )}
                        {(inv.status === 'pending' || inv.status === 'draft') && (
                          <button
                            onClick={() => handleCancel(inv.id)}
                            disabled={actionLoading === inv.id + '_cancel'}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-50"
                          >
                            {actionLoading === inv.id + '_cancel' ? '...' : '❌ لغو'}
                          </button>
                        )}
                        {(inv.status !== 'paid' || isManager) && (
                          <button
                            onClick={() => setDeleteTarget(inv)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border border-slate-500/20 transition-all"
                            aria-label={`حذف فاکتور ${inv.invoice_number}`}
                            title="حذف فاکتور"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف فاکتور"
        message={`آیا از حذف فاکتور "${deleteTarget?.invoice_number}" اطمینان دارید؟`}
        loading={deleting}
      />
    </div>
  );
};

export default Invoices;
