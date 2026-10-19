import React, { useEffect, useState } from 'react';
import { chequesAPI, customersAPI } from '../services/api';
import PriceInput from '../components/PriceInput';
import JalaliDatePicker from '../components/JalaliDatePicker';
import SearchableSelect from '../components/SearchableSelect';
import { toJalali, toPersianKeyboard } from '../utils/persian';
import {
  StatCard,
  Spinner,
  EmptyState,
  Modal,
  InputField,
  SelectField,
  Button,
  ConfirmDialog,
  formatPrice
} from '../components/ui';

const fmt = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0);

const inp = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';

const ChequeStatusBadge = ({ status }) => {
  const map = {
    pending: { label: 'در جریان', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    passed: { label: 'پاس شده', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    bounced: { label: 'برگشت خورده', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    returned: { label: 'عودت داده شده', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  };
  const { label, cls } = map[status] || { label: status, cls: '' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
};

const ChequeTypeBadge = ({ type }) => {
  const map = {
    incoming: { label: 'دریافتی', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    outgoing: { label: 'پرداختی', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  };
  const { label, cls } = map[type] || { label: type, cls: '' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
};

const ChequeModal = ({ initial, customers, onSave, onClose, saving }) => {
  const [form, setForm] = useState(initial || {
    customer: '',
    cheque_number: '',
    bank_name: '',
    branch: '',
    amount: 0,
    due_date: new Date().toISOString().slice(0, 10),
    issue_date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    type: 'incoming',
    description: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const customerOptions = customers.map(c => ({
    value: c.id,
    label: c.name,
    sub: c.phone || 'بدون تلفن'
  }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <h3 className="text-white font-semibold">{initial?.id ? 'ویرایش چک' : 'ثبت چک جدید'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">نوع چک *</label>
              <select className={inp} value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="incoming">دریافتی (از مشتری)</option>
                <option value="outgoing">پرداختی (به همکار/تامین‌کننده)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">وضعیت چک *</label>
              <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="pending">در جریان (وصول نشده)</option>
                <option value="passed">پاس شده (وصول شده)</option>
                <option value="bounced">برگشت خورده</option>
                <option value="returned">عودت داده شده</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">مشتری مرتبط</label>
            <SearchableSelect
              value={form.customer}
              onChange={(val) => set('customer', val)}
              options={customerOptions}
              placeholder="انتخاب مشتری..."
              creatable={true}
              onCreateOption={async (name) => {
                const res = await customersAPI.create({ name });
                return { value: res.data.id, label: res.data.name };
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">نام بانک *</label>
              <input className={inp} value={form.bank_name} onChange={(e) => set('bank_name', toPersianKeyboard(e.target.value))} placeholder="مثال: ملی، صادرات..." required />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">شعبه</label>
              <input className={inp} value={form.branch} onChange={(e) => set('branch', toPersianKeyboard(e.target.value))} placeholder="مثال: مرکزی" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">شماره چک *</label>
              <input className={inp} value={form.cheque_number} onChange={(e) => set('cheque_number', toPersianKeyboard(e.target.value))} placeholder="شماره صیادی یا چک" required />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">مبلغ چک (تومان) *</label>
              <PriceInput value={form.amount} onChange={(v) => set('amount', v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">تاریخ صدور</label>
              <JalaliDatePicker value={form.issue_date} onChange={(v) => set('issue_date', v)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">تاریخ سررسید *</label>
              <JalaliDatePicker value={form.due_date} onChange={(v) => set('due_date', v)} required />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">توضیحات</label>
            <textarea className={inp} rows={2} value={form.description || ''} onChange={(e) => set('description', toPersianKeyboard(e.target.value))} placeholder="توضیحات اختیاری..." />
          </div>
        </div>
        <div className="flex gap-3 justify-end p-5 border-t border-slate-700/50">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all">انصراف</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.bank_name || !form.cheque_number || !form.amount || !form.due_date}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm transition-all disabled:opacity-60 flex items-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {initial?.id ? 'ذخیره تغییرات' : 'ثبت چک'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Cheques = () => {
  const [cheques, setCheques] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | {cheque}
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [chqRes, custRes] = await Promise.all([
        chequesAPI.list(filters),
        customersAPI.list()
      ]);
      setCheques(chqRes.data.results || chqRes.data);
      setCustomers(custRes.data.results || custRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('mohaseb:data-changed', loadData);
    return () => window.removeEventListener('mohaseb:data-changed', loadData);
  }, [filters]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      // API expects Customer ID or null
      const payload = {
        ...form,
        customer: form.customer || null,
        amount: Number(form.amount)
      };

      if (form.id) {
        await chequesAPI.update(form.id, payload);
      } else {
        await chequesAPI.create(payload);
      }
      setModal(null);
      loadData();
    } catch (e) {
      alert('خطا در ذخیره‌سازی چک: ' + JSON.stringify(e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await chequesAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      alert('خطا در حذف چک');
    }
  };

  const handleQuickStatus = async (cheque, newStatus) => {
    try {
      await chequesAPI.patch(cheque.id, { status: newStatus });
      loadData();
    } catch (e) {
      alert('خطا در تغییر وضعیت چک');
    }
  };

  // Calculations
  const stats = cheques.reduce((acc, curr) => {
    const amt = Number(curr.amount) || 0;
    if (curr.status === 'pending') {
      if (curr.type === 'incoming') acc.incomingPending += amt;
      else acc.outgoingPending += amt;
    }
    if (curr.status === 'passed') acc.passed += amt;
    if (curr.status === 'bounced') acc.bounced += amt;
    return acc;
  }, { incomingPending: 0, outgoingPending: 0, passed: 0, bounced: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">🎫 مدیریت چک‌ها</h2>
          <p className="text-slate-400 text-sm mt-0.5">ثبت، پیگیری و یادآوری چک‌های دریافتی و پرداختی</p>
        </div>
        <button onClick={() => setModal('add')}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium transition-all shadow-lg shadow-blue-500/25">
          + ثبت چک جدید
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="چک‌های دریافتی معلق" value={formatPrice(stats.incomingPending)} icon="📥" color="blue" />
        <StatCard label="چک‌های پرداختی معلق" value={formatPrice(stats.outgoingPending)} icon="📤" color="purple" />
        <StatCard label="چک‌های پاس شده" value={formatPrice(stats.passed)} icon="✅" color="green" />
        <StatCard label="چک‌های برگشت خورده" value={formatPrice(stats.bounced)} icon="🚨" color="red" />
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 items-center">
          <div className="w-full sm:w-48">
            <input
              type="text"
              placeholder="جستجوی شماره چک، بانک، مشتری..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: toPersianKeyboard(e.target.value) }))}
              className="w-full px-3.5 py-2 bg-slate-700/40 border border-slate-600/40 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="w-full sm:w-40">
            <select
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-700/40 border border-slate-600/40 rounded-xl text-white text-sm focus:outline-none"
            >
              <option value="">همه نوع چک‌ها</option>
              <option value="incoming">دریافتی (مشتریان)</option>
              <option value="outgoing">پرداختی</option>
            </select>
          </div>

          <div className="w-full sm:w-40">
            <select
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-700/40 border border-slate-600/40 rounded-xl text-white text-sm focus:outline-none"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="pending">در جریان</option>
              <option value="passed">پاس شده</option>
              <option value="bounced">برگشت خورده</option>
              <option value="returned">عودت داده شده</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          تعداد چک‌های یافت شده: {fmt(cheques.length)} مورد
        </div>
      </div>

      {/* Table / List */}
      {loading ? (
        <Spinner size="lg" />
      ) : cheques.length === 0 ? (
        <EmptyState title="هیچ چکی یافت نشد" description="چک جدیدی ثبت کنید یا فیلترهای جستجو را تغییر دهید" icon="🎫" />
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400 text-xs bg-slate-900/20">
                  <th className="text-right py-3.5 px-4 font-semibold">مشخصات چک</th>
                  <th className="text-right py-3.5 px-4 font-semibold">مشتری</th>
                  <th className="text-right py-3.5 px-4 font-semibold">نوع / وضعیت</th>
                  <th className="text-right py-3.5 px-4 font-semibold">مبلغ</th>
                  <th className="text-right py-3.5 px-4 font-semibold">سررسید (شمسی)</th>
                  <th className="text-center py-3.5 px-4 font-semibold">عملیات سریع</th>
                  <th className="text-left py-3.5 px-4 font-semibold">مدیریت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {cheques.map((chq) => {
                  const isOverdue = chq.status === 'pending' && new Date(chq.due_date) < new Date();
                  return (
                    <tr key={chq.id} className="hover:bg-slate-700/10 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white flex items-center gap-2">
                          <span>{chq.bank_name}</span>
                          {chq.branch && <span className="text-xs text-slate-500 font-normal">(شعبه {chq.branch})</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-mono">ش چک: {chq.cheque_number}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">
                        {chq.customer_name ? (
                          <span className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer">
                            {chq.customer_name}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">نامشخص</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          <ChequeTypeBadge type={chq.type} />
                          <ChequeStatusBadge status={chq.status} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-100">
                        {fmt(chq.amount)} <span className="text-xs text-slate-500 font-normal">تومان</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-sm ${isOverdue ? 'text-red-400 font-semibold' : 'text-slate-300'}`}>
                          {toJalali(chq.due_date)}
                        </span>
                        {isOverdue && (
                          <span className="block text-[10px] text-red-500 font-medium mt-0.5 animate-pulse">سررسید گذشته!</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {chq.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleQuickStatus(chq, 'passed')}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
                              >
                                وصول شد
                              </button>
                              <button
                                onClick={() => handleQuickStatus(chq, 'bounced')}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                              >
                                برگشت
                              </button>
                            </>
                          )}
                          {chq.status !== 'pending' && (
                            <button
                              onClick={() => handleQuickStatus(chq, 'pending')}
                              className="px-2 py-0.5 text-[10px] rounded-md bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-all"
                            >
                              بازگردانی به در جریان
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1.5">
                          <button onClick={() => setModal(chq)}
                            className="px-2 py-1 text-xs rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                            title="ویرایش"
                          >
                            ✏️
                          </button>
                          <button onClick={() => setDeleteTarget(chq)}
                            className="px-2 py-1 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                            title="حذف"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cheque Modal */}
      {modal && (
        <ChequeModal
          initial={modal === 'add' ? null : modal}
          customers={customers}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={true}
          title="حذف چک"
          message={`آیا از حذف چک شماره «${deleteTarget.cheque_number}» بانک «${deleteTarget.bank_name}» به مبلغ ${formatPrice(deleteTarget.amount)} اطمینان دارید؟`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Cheques;
