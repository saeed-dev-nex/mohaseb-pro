import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCustomers } from '../features/customersSlice';
import { fetchServices } from '../features/servicesSlice';
import { createInvoice } from '../features/invoicesSlice';
import { Button, SelectField, formatPrice } from '../components/ui';

const emptyItem = { service: '', main_price: '', extra_price: 0, quantity: 1, notes: '' };

const NewInvoice = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list: customers } = useSelector(s => s.customers);
  const { list: services } = useSelector(s => s.services);

  const [customer, setCustomer] = useState('');
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const refreshReferences = () => {
      dispatch(fetchCustomers());
      dispatch(fetchServices({ active: 'true' }));
    };
    refreshReferences();
    window.addEventListener('mohaseb:data-changed', refreshReferences);
    return () => window.removeEventListener('mohaseb:data-changed', refreshReferences);
  }, [dispatch]);

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, key, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      // Auto-fill prices when service selected
      if (key === 'service') {
        const svc = services.find(s => String(s.id) === String(value));
        if (svc) {
          next[idx].main_price = Number(svc.default_main_price) > 0 ? svc.default_main_price : '';
          next[idx].extra_price = svc.has_extra ? svc.default_extra_price : 0;
        }
      }
      return next;
    });
  };

  const subtotal = items.reduce((sum, item) => {
    return sum + (Number(item.main_price) + Number(item.extra_price)) * Number(item.quantity || 1);
  }, 0);
  const taxAmount = (subtotal * Number(tax)) / 100;
  const finalTotal = subtotal + taxAmount - Number(discount);

  const handleSubmit = async () => {
    if (!customer) { setError('مشتری را انتخاب کنید'); return; }
    const validItems = items.filter(i => i.service);
    if (validItems.length === 0) { setError('حداقل یک خدمت را انتخاب کنید'); return; }
    setError('');
    setSaving(true);
    try {
      await dispatch(createInvoice({
        customer: Number(customer),
        description,
        discount: Number(discount),
        tax: Number(tax),
        commission_total: 0,
        status,
        items: validItems.map(i => ({
          service: Number(i.service),
          service_title_snapshot: '',
          main_price: Number(i.main_price),
          extra_price: Number(i.extra_price),
          quantity: Number(i.quantity || 1),
          notes: i.notes || '',
          commission: 0,
        })),
      })).unwrap();
      navigate('/invoices');
    } catch (e) {
      setError('خطا در ثبت فاکتور. لطفاً دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">فاکتور جدید</h2>
        <p className="text-slate-400 text-sm mt-1">صدور فاکتور برای مشتری</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Customer + Info */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-semibold border-b border-slate-700/50 pb-3">اطلاعات پایه</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="مشتری *"
            value={customer}
            onChange={e => setCustomer(e.target.value)}
          >
            <option value="" className="bg-slate-800">انتخاب مشتری...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id} className="bg-slate-800">{c.name} {c.phone ? `(${c.phone})` : ''}</option>
            ))}
          </SelectField>
          <SelectField
            label="وضعیت"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="pending" className="bg-slate-800">در انتظار پرداخت</option>
            <option value="paid" className="bg-slate-800">پرداخت شده</option>
            <option value="draft" className="bg-slate-800">پیش‌نویس</option>
          </SelectField>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-300">توضیحات</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            placeholder="توضیحات اختیاری فاکتور"
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
          <h3 className="text-white font-semibold">آیتم‌های فاکتور</h3>
          <Button variant="outline" size="sm" onClick={addItem}>+ افزودن ردیف</Button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const selectedSvc = services.find(s => String(s.id) === String(item.service));
            const lineTotal = (Number(item.main_price) + Number(item.extra_price)) * Number(item.quantity || 1);

            return (
              <div key={idx} className="p-4 bg-slate-700/30 border border-slate-600/30 rounded-xl space-y-3">
                <div className="flex items-start gap-3">
                  {/* Service Select */}
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">خدمت</label>
                    <select
                      value={item.service}
                      onChange={e => updateItem(idx, 'service', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="" className="bg-slate-800">انتخاب خدمت...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-800">{s.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="w-20">
                    <label className="block text-xs text-slate-400 mb-1">تعداد</label>
                    <input
                      type="number"
                      value={item.quantity}
                      min="1"
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center"
                    />
                  </div>

                  {/* Remove button */}
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="mt-5 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">قیمت اصلی (تومان)</label>
                    <input
                      type="number"
                      value={item.main_price}
                      placeholder="مبلغ را وارد کنید"
                      min="0"
                      onChange={e => updateItem(idx, 'main_price', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  {selectedSvc?.has_extra && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{selectedSvc.extra_label || 'قیمت اضافه'} (تومان)</label>
                      <input
                        type="number"
                        value={item.extra_price}
                        min="0"
                        onChange={e => updateItem(idx, 'extra_price', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">یادداشت</label>
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={e => updateItem(idx, 'notes', e.target.value)}
                      placeholder="اختیاری"
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                {/* Line total */}
                <div className="flex justify-end">
                  <span className="text-xs text-slate-400">جمع ردیف: <span className="text-white font-medium">{formatPrice(lineTotal)}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-semibold border-b border-slate-700/50 pb-3">خلاصه مالی</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">تخفیف (تومان)</label>
            <input
              type="number"
              value={discount}
              min="0"
              onChange={e => setDiscount(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">مالیات (%)</label>
            <input
              type="number"
              value={tax}
              min="0"
              max="100"
              onChange={e => setTax(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="bg-slate-700/30 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">جمع خدمات</span>
            <span className="text-white">{formatPrice(subtotal)}</span>
          </div>
          {Number(tax) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">مالیات ({tax}%)</span>
              <span className="text-yellow-400">+{formatPrice(taxAmount)}</span>
            </div>
          )}
          {Number(discount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">تخفیف</span>
              <span className="text-green-400">-{formatPrice(Number(discount))}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-slate-600 pt-2 mt-2">
            <span className="text-slate-200">مبلغ نهایی</span>
            <span className="text-blue-400">{formatPrice(finalTotal)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={() => navigate('/invoices')}>انصراف</Button>
        <Button variant="success" loading={saving} onClick={handleSubmit}>
          ✅ ثبت فاکتور
        </Button>
      </div>
    </div>
  );
};

export default NewInvoice;
