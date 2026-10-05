import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchServices, createService, updateService, deleteService,
} from '../features/servicesSlice';
import PriceInput from '../components/PriceInput';
import { toPersianKeyboard } from '../utils/persian';


const fmt = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0);

const emptyForm = {
  title: '', description: '', has_extra: false, extra_label: '',
  default_main_price: 0, default_extra_price: 0,
  default_commission: 0, commission_label: 'کارمزد',
  is_active: true,
};

// ── Inline Input ──
const F = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-slate-400">{label}</label>
    {children}
  </div>
);
const inp = 'w-full px-3 py-2 bg-slate-700/60 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';

// ── Service Modal ──
const ServiceModal = ({ initial, onSave, onClose, loading }) => {
  const [form, setForm] = useState(initial || emptyForm);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <h3 className="text-white font-semibold">{initial?.id ? 'ویرایش خدمت' : 'افزودن خدمت جدید'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <F label="عنوان خدمت *">
            <input className={inp} value={form.title} onChange={(e) => set('title', toPersianKeyboard(e.target.value))} placeholder="عنوان خدمت" />
          </F>
          <F label="توضیحات">
            <textarea className={inp} rows={2} value={form.description || ''} onChange={(e) => set('description', toPersianKeyboard(e.target.value))} placeholder="توضیح کوتاه" />
          </F>


          <div className="grid grid-cols-2 gap-3">
            <F label="مبلغ پرداختی پیش‌فرض">
              <PriceInput value={form.default_main_price} onChange={(v) => set('default_main_price', v)} />
            </F>
            <F label="مبلغ استعلامی پیش‌فرض">
              <PriceInput value={form.default_extra_price} onChange={(v) => set('default_extra_price', v)} />
            </F>
          </div>

          {/* Commission */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 space-y-3">
            <p className="text-yellow-400 text-xs font-semibold flex items-center gap-1.5">💼 تنظیمات کارمزد</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="کارمزد پیش‌فرض">
                <PriceInput value={form.default_commission} onChange={(v) => set('default_commission', v)}
                  borderColor="border-yellow-500/30" />
              </F>
              <F label="برچسب کارمزد">
                <input type="text" className={inp} value={form.commission_label} onChange={(e) => set('commission_label', e.target.value)} placeholder="کارمزد" />
              </F>
            </div>
          </div>

          {/* Extra */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('has_extra', !form.has_extra)}
              className={`relative w-11 h-6 rounded-full transition-all ${form.has_extra ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.has_extra ? 'right-0.5' : 'right-5'}`} />
            </button>
            <span className="text-slate-300 text-sm">دارای خدمت اضافه</span>
          </div>
          {form.has_extra && (
            <F label="برچسب خدمت اضافه">
              <input className={inp} value={form.extra_label || ''} onChange={(e) => set('extra_label', e.target.value)} placeholder="مثال: هزینه ارسال" />
            </F>
          )}

          {/* Active toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative w-11 h-6 rounded-full transition-all ${form.is_active ? 'bg-green-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.is_active ? 'right-0.5' : 'right-5'}`} />
            </button>
            <span className="text-slate-300 text-sm">{form.is_active ? 'خدمت فعال' : 'خدمت غیرفعال'}</span>
          </div>
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-slate-700/50">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all">انصراف</button>
          <button
            onClick={() => onSave(form)}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {initial?.id ? 'ذخیره تغییرات' : 'افزودن'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────
const Services = () => {
  const dispatch = useDispatch();
  const { list, loading } = useSelector((s) => s.services);
  const [modal, setModal] = useState(null); // null | 'add' | {service}
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { dispatch(fetchServices()); }, [dispatch]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal?.id) {
        await dispatch(updateService({ id: modal.id, data: form })).unwrap();
      } else {
        await dispatch(createService(form)).unwrap();
      }
      setModal(null);
    } catch (e) {
      alert('خطا: ' + JSON.stringify(e));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dispatch(deleteService(deleteTarget.id)).unwrap();
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">خدمات</h2>
          <p className="text-slate-400 text-sm mt-0.5">مدیریت خدمات و تعرفه‌ها</p>
        </div>
        <button
          onClick={() => setModal('add')}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all"
        >
          + افزودن خدمت
        </button>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 border border-slate-700/50 rounded-2xl">
          <p className="text-4xl mb-3">⚙️</p>
          <p className="text-slate-300 font-medium text-lg">خدمتی تعریف نشده</p>
          <p className="text-slate-500 text-sm mt-1">با کلیک روی افزودن خدمت، اولین سرویس خود را ایجاد کنید</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((svc) => (
            <div
              key={svc.id}
              className={`bg-slate-800/50 border rounded-2xl overflow-hidden transition-all group ${svc.is_active ? 'border-slate-700/50' : 'border-slate-700/30 opacity-60'}`}
            >
              {/* Card Header */}
              <div className="p-5 border-b border-slate-700/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-base truncate">{svc.title}</h3>
                    {svc.description && <p className="text-slate-500 text-xs mt-0.5 truncate">{svc.description}</p>}
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${svc.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>
                    {svc.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-5 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">مبلغ پرداختی</span>
                  <span className="text-white font-medium">{fmt(svc.default_main_price)} تومان</span>
                </div>
                {svc.has_extra && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{svc.extra_label || 'استعلام'}</span>
                    <span className="text-slate-300">{fmt(svc.default_extra_price)} تومان</span>
                  </div>
                )}
                {Number(svc.default_commission) > 0 && (
                  <div className="flex justify-between text-sm bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-3 py-2">
                    <span className="text-yellow-400/80">💼 {svc.commission_label || 'کارمزد'}</span>
                    <span className="text-yellow-400 font-medium">{fmt(svc.default_commission)} تومان</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-700/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setModal(svc)}
                  className="flex-1 py-1.5 text-xs rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
                >
                  ✏️ ویرایش
                </button>
                <button
                  onClick={() => setDeleteTarget(svc)}
                  className="flex-1 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                >
                  🗑️ حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ServiceModal
          initial={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
          loading={saving}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <p className="text-white font-semibold mb-2">حذف خدمت</p>
            <p className="text-slate-400 text-sm mb-5">
              آیا از حذف خدمت «<span className="text-white">{deleteTarget.title}</span>» اطمینان دارید؟
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all">انصراف</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm transition-all disabled:opacity-60"
              >
                {deleting ? 'در حال حذف...' : 'بله، حذف شود'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
