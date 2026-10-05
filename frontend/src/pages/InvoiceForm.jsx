import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchServices } from '../features/servicesSlice';
import { fetchCustomers, createCustomer } from '../features/customersSlice';
import { invoicesAPI, vehicleTypesAPI } from '../services/api';
import PriceInput from '../components/PriceInput';
import PlateInput from '../components/PlateInput';
import JalaliDatePicker from '../components/JalaliDatePicker';
import SearchableSelect from '../components/SearchableSelect';
import { jalaliYearRange, currentJalaliYear, toPersianKeyboard } from '../utils/persian';


const fmt = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0) + ' تومان';
const YEAR_OPTIONS = jalaliYearRange(1360, currentJalaliYear());

const STATUS_OPTIONS = [
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'pending', label: 'پرداخت نشده' },
  { value: 'paid', label: 'پرداخت شده' },
  { value: 'cancelled', label: 'لغو شده' },
];
const PAPER_SIZES = [
  { value: 'a5', label: 'A5' },
  { value: 'a4', label: 'A4' },
  { value: 'a6', label: 'A6' },
];

// ─── ۱۰۰ برند / مدل موتورسیکلت رایج ایران ──────────────────────
const MOTO_BRANDS = [
  // هوندا
  'هوندا CG125', 'هوندا CB125', 'هوندا Wave110', 'هوندا CBF150', 'هوندا CG150',
  // یاماها
  'یاماها YBR125', 'یاماها YBR125G', 'یاماها R15', 'یاماها FZ150', 'یاماها MT15',
  // کویر
  'کویر KV125', 'کویر KV150', 'کویر KV200', 'کویر KV250', 'کویر KH200',
  // رهرو
  'رهرو RH125', 'رهرو RH150', 'رهرو RH200', 'رهرو RH250', 'رهرو RH110',
  // گلکسی
  'گلکسی GL125', 'گلکسی GL150', 'گلکسی GL200', 'گلکسی GL250',
  // نامی
  'نامی NM125', 'نامی NM150', 'نامی NM200',
  // سانیار
  'سانیار SY125', 'سانیار SY150', 'سانیار SY200',
  // زرین
  'زرین ZR125', 'زرین ZR150', 'زرین ZR200',
  // پیشرو
  'پیشرو PS125', 'پیشرو PS150', 'پیشرو PS200',
  // آرین
  'آرین AR125', 'آرین AR150', 'آرین AR200',
  // سوزوکی
  'سوزوکی GS150', 'سوزوکی GN125', 'سوزوکی EN125', 'سوزوکی DR200',
  // دیفان
  'دیفان DF125', 'دیفان DF150', 'دیفان DF200',
  // لیفان
  'لیفان LF125', 'لیفان LF150', 'لیفان LF200', 'لیفان KPR150',
  // لونچین
  'لونچین LX150', 'لونچین LX200', 'لونچین LX250',
  // CF موتو
  'CF موتو 150NK', 'CF موتو 250NK', 'CF موتو CLX300',
  // باجاج
  'باجاج پالسار 135', 'باجاج پالسار 150', 'باجاج پالسار 180', 'باجاج پالسار 200',
  'باجاج CT100', 'باجاج پلاتینا', 'باجاج دیسکاور 100', 'باجاج دیسکاور 125',
  // TVS
  'TVS اپاچی 150', 'TVS اپاچی 160', 'TVS اپاچی 200', 'TVS استار',
  // کاوازاکی
  'کاوازاکی Z125', 'کاوازاکی KLX150', 'کاوازاکی D-Tracker150',
  // KTM
  'KTM Duke 125', 'KTM Duke 200', 'KTM Duke 390', 'KTM RC200',
  // بنلی
  'بنلی TNT125', 'بنلی TNT150', 'بنلی TNT25', 'بنلی Leoncino250',
  // کیم کو
  'کیم کو K150', 'کیم کو Agility125',
  // سیم
  'سیم SYM 125', 'سیم SYM 150',
  // سایر رایج
  'هرو اسپلندور', 'هرو گلامر', 'هرو پشن پرو', 'هرو اکستریم',
  'ری‌هو RX125', 'ری‌هو RX150',
  'تانگو TG125', 'تانگو TG150',
  'میهن 125', 'میهن 150',
  'شباهنگ 125', 'شباهنگ 150',
  // سه‌چرخه/کارگو
  'موتور باربری 200cc', 'موتور باربری 250cc', 'سه‌چرخه موتوری',
].map((m) => ({ value: m, label: m }));

const Section = ({ title, icon, children }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-700/50 bg-slate-700/20">
      <span className="text-lg">{icon}</span>
      <h3 className="text-white font-semibold text-sm">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const Field = ({ label, required, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label className="block text-xs font-medium text-slate-400">
      {label}{required && <span className="text-red-400 mr-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';
const selectCls = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';

// ─── New Customer Modal ───────────────────────────────────────
const NewCustomerModal = ({ initialName, onConfirm, onCancel, saving, error }) => {
  const [name, setName] = React.useState(initialName || '');
  const [phone, setPhone] = React.useState('');
  const [nationalId, setNationalId] = React.useState('');
  const [address, setAddress] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    onConfirm({ name: name.trim(), phone: phone.trim(), national_id: nationalId.trim(), address: address.trim() });
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="new-customer-title" className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-slate-700/50">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-blue-600/20 border border-indigo-500/30 flex items-center justify-center text-lg">👤</div>
          <div>
            <h3 id="new-customer-title" className="text-white font-semibold text-sm">افزودن مشتری جدید</h3>
            <p className="text-slate-500 text-xs mt-0.5">ثبت نام مشتری کافی است؛ سایر اطلاعات اختیاری هستند</p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="بستن پنجره مشتری" className="mr-auto text-slate-400 hover:text-white text-xl transition-colors disabled:opacity-50">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{error}</div>}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">نام مشتری <span className="text-red-400">*</span></label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="نام کامل مشتری" className={inputCls} autoFocus required maxLength={255}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">📞 شماره تماس <span className="text-slate-600">(اختیاری)</span></label>
            <input
              type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxxx" className={inputCls} dir="ltr"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">کد ملی <span className="text-slate-600">(اختیاری)</span></label>
              <input
                type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value)}
                placeholder="کد ملی" className={inputCls} dir="ltr" maxLength={15}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">آدرس <span className="text-slate-600">(اختیاری)</span></label>
              <input
                type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="آدرس کوتاه" className={inputCls}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all">انصراف</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✅'}
              ثبت مشتری
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Service Picker Modal ────────────────────────────────────
const ServicePickerModal = ({ services, onAdd, onClose }) => {
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');

  const toggle = (id) => setSelected((p) => {
    const copy = { ...p };
    if (copy[id]) delete copy[id];
    else copy[id] = true;
    return copy;
  });

  const selectAll = () => {
    const obj = {};
    filtered.forEach((s) => { obj[s.id] = true; });
    setSelected(obj);
  };

  const filtered = services.filter(
    (s) => s.is_active && s.title.toLowerCase().includes(search.toLowerCase())
  );
  const count = Object.keys(selected).length;

  const handleAdd = () => {
    const rows = services
      .filter((s) => selected[s.id])
      .map((s) => ({
        _key: Math.random(),
        service: String(s.id),
        service_title_snapshot: s.title,
        quantity: 1,
        main_price: Number(s.default_main_price) > 0 ? s.default_main_price : '',
        extra_price: s.default_extra_price || 0,
        notes: '',
      }));
    onAdd(rows);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <h3 className="text-white font-semibold">انتخاب خدمات</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors">×</button>
        </div>

        {/* Search + Select All */}
        <div className="px-5 pt-4 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی خدمت..."
            className={inputCls}
            autoFocus
          />
          <div className="flex items-center justify-between">
            <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              انتخاب همه ({filtered.length})
            </button>
            {count > 0 && (
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/30">
                {count} خدمت انتخاب شده
              </span>
            )}
          </div>
        </div>

        {/* Service List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">خدمتی یافت نشد</p>
          ) : filtered.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => toggle(svc.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all text-right ${
                selected[svc.id]
                  ? 'bg-blue-500/15 border border-blue-500/40 text-blue-200'
                  : 'bg-slate-700/30 border border-slate-700/30 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs shrink-0 transition-all ${
                selected[svc.id] ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-500'
              }`}>
                {selected[svc.id] && '✓'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{svc.title}</p>
                {svc.description && <p className="text-slate-500 text-xs truncate mt-0.5">{svc.description}</p>}
              </div>
              <span className="text-xs text-slate-400 shrink-0">
                {fmt(svc.default_main_price)}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-between items-center p-5 border-t border-slate-700/50">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all">
            انصراف
          </button>
          <button
            onClick={handleAdd}
            disabled={count === 0}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm transition-all disabled:opacity-40 flex items-center gap-2"
          >
            ➕ افزودن {count > 0 ? `${count} خدمت` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Compact Item Row ────────────────────────────────────────
const ItemRow = ({ item, idx, services, onChange, onRemove }) => {
  const lineTotal = ((Number(item.main_price) || 0) + (Number(item.extra_price) || 0)) * (Number(item.quantity) || 1);

  return (
    <div className="flex items-start gap-2 group">
      <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded-lg mt-2.5 shrink-0">{idx + 1}</span>
      <div className="flex-1 grid grid-cols-12 gap-2 items-end">
        {/* Title */}
        <div className="col-span-12 sm:col-span-4">
          <label className="text-[10px] text-slate-500 mb-0.5 block">خدمت</label>
          <input
            type="text"
            value={item.service_title_snapshot}
            onChange={(e) => onChange(idx, { ...item, service_title_snapshot: toPersianKeyboard(e.target.value) })}
            placeholder="عنوان خدمت"
            className={inputCls}
          />
        </div>
        {/* Qty */}
        <div className="col-span-3 sm:col-span-2">
          <label className="text-[10px] text-slate-500 mb-0.5 block">تعداد</label>
          <input type="number" min="1" value={item.quantity}
            onChange={(e) => onChange(idx, { ...item, quantity: e.target.value })}
            className={inputCls} />
        </div>
        {/* Main Price */}
        <div className="col-span-4 sm:col-span-2">
          <label className="text-[10px] text-slate-500 mb-0.5 block">مبلغ پرداختی</label>
          <PriceInput value={item.main_price} blankWhenZero placeholder="مبلغ را وارد کنید"
            onChange={(v) => onChange(idx, { ...item, main_price: v })} />
        </div>
        {/* Extra Price */}
        <div className="col-span-4 sm:col-span-2">
          <label className="text-[10px] text-slate-500 mb-0.5 block">مبلغ استعلامی</label>
          <PriceInput value={item.extra_price}
            onChange={(v) => onChange(idx, { ...item, extra_price: v })} />
        </div>
        {/* Line Total */}
        <div className="col-span-3 sm:col-span-1 flex items-end pb-1">
          <span className="text-xs text-slate-400 whitespace-nowrap">{fmt(lineTotal)}</span>
        </div>
        {/* Remove */}
        <div className="col-span-2 sm:col-span-1 flex items-end pb-0.5">
          <button type="button" onClick={() => onRemove(idx)}
            className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg p-2 transition-all text-xs opacity-0 group-hover:opacity-100">
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────
const InvoiceForm = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: services } = useSelector((s) => s.services);
  const { list: customers } = useSelector((s) => s.customers);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingVehicleType, setCreatingVehicleType] = useState(false);
  const [inlineNotice, setInlineNotice] = useState('');
  // New customer modal state
  const [newCustomerModal, setNewCustomerModal] = useState(null); // null | { pendingName, resolve }
  const [customerError, setCustomerError] = useState('');

  useEffect(() => {
    vehicleTypesAPI.list().then(({ data }) => setVehicleTypes(data)).catch(() => {});
  }, []);

  // ── Auto-create customer (opens modal for phone/details) ─────────
  const handleCreateCustomer = useCallback(async (name) => {
    // Open modal to collect optional customer details
    setCustomerError('');
    return new Promise((resolve) => {
      setNewCustomerModal({ pendingName: name, resolve });
    });
  }, []);

  const handleCustomerModalConfirm = useCallback(async (customerData) => {
    if (!newCustomerModal || creatingCustomer) return;
    const { resolve } = newCustomerModal;
    setCreatingCustomer(true);
    setCustomerError('');
    setInlineNotice('');
    try {
      const data = await dispatch(createCustomer(customerData)).unwrap();
      setError('');
      setNewCustomerModal(null);
      setInlineNotice(`✅ مشتری جدید «${data.name}» ثبت شد`);
      setTimeout(() => setInlineNotice(''), 4000);
      resolve({ value: String(data.id), label: data.name });
    } catch (err) {
      const details = typeof err === 'object' && err !== null
        ? Object.values(err).flat().filter((message) => typeof message === 'string').join('، ')
        : err;
      setCustomerError(details || 'خطا در ثبت مشتری؛ دوباره تلاش کنید');
    } finally {
      setCreatingCustomer(false);
    }
  }, [dispatch, newCustomerModal, creatingCustomer]);

  const handleCustomerModalCancel = useCallback(() => {
    if (creatingCustomer) return;
    if (newCustomerModal?.resolve) newCustomerModal.resolve(null);
    setNewCustomerModal(null);
  }, [newCustomerModal, creatingCustomer]);

  // ── Auto-create vehicle type ──────────────────────────────────
  const handleCreateVehicleType = useCallback(async (name) => {
    setCreatingVehicleType(true);
    setInlineNotice('');
    try {
      const { data } = await vehicleTypesAPI.create({ name });
      setVehicleTypes((prev) => [...prev, data]);
      setInlineNotice(`✅ نوع خودرو «${data.name}» به لیست اضافه شد`);
      setTimeout(() => setInlineNotice(''), 4000);
      return { value: data.name, label: data.name };
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || 'خطا در ثبت نوع خودرو';
      setError(msg);
      return null;
    } finally {
      setCreatingVehicleType(false);
    }
  }, []);

  const [form, setForm] = useState({
    customer: '', status: 'pending',
    date: new Date().toISOString().slice(0, 10),
    due_date: '', description: '',
    discount: 0, tax: 0, commission_total: 0,
    paper_size: 'a5',
    vehicle_plate: '', vehicle_vin: '', vehicle_model: '', vehicle_type: '', vehicle_year: '',
    tags: [],
  });
  const [items, setItems] = useState([]);

  useEffect(() => { dispatch(fetchServices()); dispatch(fetchCustomers()); }, [dispatch]);

  useEffect(() => {
    if (!isEdit) return;
    invoicesAPI.detail(id).then(({ data }) => {
      setForm({
        customer: data.customer || '', status: data.status || 'pending',
        date: data.date ? data.date.slice(0, 10) : '',
        due_date: data.due_date || '', description: data.description || '',
        discount: data.discount || 0, tax: data.tax || 0,
        commission_total: data.commission_total || 0,
        paper_size: data.paper_size || 'a5',
        vehicle_plate: data.vehicle_plate || '', vehicle_vin: data.vehicle_vin || '',
        vehicle_model: data.vehicle_model || '', vehicle_type: data.vehicle_type || '',
        vehicle_year: data.vehicle_year || '',
        tags: data.tags || [],
      });
      setItems((data.items || []).map((it) => ({
        _key: Math.random(), service: it.service || '',
        service_title_snapshot: it.service_title_snapshot || it.service_title || '',
        quantity: it.quantity || 1, main_price: it.main_price || '',
        extra_price: it.extra_price || '', notes: it.notes || '',
      })));
    }).catch(() => navigate('/invoices')).finally(() => setLoading(false));
  }, [id]);

  // Calculations
  const subtotal = items.reduce((s, it) =>
    s + ((Number(it.main_price) || 0) + (Number(it.extra_price) || 0)) * (Number(it.quantity) || 1), 0);
  const taxAmount = (subtotal * Number(form.tax || 0)) / 100;
  const commissionAmt = Number(form.commission_total || 0);
  const finalAmount = subtotal + commissionAmt + taxAmount - Number(form.discount || 0);

  const handleItemChange = useCallback((idx, updated) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  }, []);
  const handleRemoveItem = useCallback((idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const handleAddManualRow = () => {
    setItems((prev) => [...prev, {
      _key: Math.random(), service: '', service_title_snapshot: '',
      quantity: 1, main_price: '', extra_price: '', notes: '',
    }]);
  };
  const handleAddFromPicker = (rows) => setItems((prev) => [...prev, ...rows]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer) { setError('لطفاً مشتری را انتخاب کنید'); return; }
    if (items.length === 0) { setError('حداقل یک ردیف وارد کنید'); return; }
    setError(''); setSaving(true);
    const payload = {
      ...form,
      customer: Number(form.customer),
      discount: Number(form.discount) || 0,
      tax: Number(form.tax) || 0,
      commission_total: Number(form.commission_total) || 0,
      due_date: form.due_date || null,
      vehicle_year: form.vehicle_year || '',
      tags: form.tags || [],
      items: items.map((it) => ({
        service: it.service ? Number(it.service) : null,
        service_title_snapshot: it.service_title_snapshot || '',
        quantity: Number(it.quantity) || 1,
        main_price: Number(it.main_price) || 0,
        extra_price: Number(it.extra_price) || 0,
        commission: 0, notes: it.notes || '',
      })),
    };
    try {
      if (isEdit) { await invoicesAPI.update(id, payload); navigate(`/invoices/${id}`); }
      else { const { data } = await invoicesAPI.create(payload); navigate(`/invoices/${data.id}`); }
    } catch (err) {
      const msg = err.response?.data;
      setError(typeof msg === 'object' ? JSON.stringify(msg) : 'خطا در ذخیره فاکتور');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate(isEdit ? `/invoices/${id}` : '/invoices')}
            className="text-slate-400 hover:text-white text-sm mb-1 flex items-center gap-1 transition-colors">← بازگشت</button>
          <h2 className="text-2xl font-bold text-white">{isEdit ? `ویرایش فاکتور` : 'صدور فاکتور جدید'}</h2>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(isEdit ? `/invoices/${id}` : '/invoices')}
            className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all">انصراف</button>
          <button type="submit" disabled={saving}
            className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-60 flex items-center gap-2">
            {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> ذخیره...</> : isEdit ? '💾 ذخیره' : '✅ ثبت فاکتور'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}
      {inlineNotice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-sm flex items-center gap-2">
          {inlineNotice}
        </div>
      )}

      {/* Customer + Status */}
      <Section title="مشتری و وضعیت" icon="👤">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="مشتری" required className="lg:col-span-2">
            <SearchableSelect
              value={form.customer}
              onChange={(v) => setField('customer', v)}
              options={customers.map((c) => ({
                value: String(c.id),
                label: c.name,
                sub: c.phone || c.national_id || undefined,
              }))}
              placeholder="— انتخاب مشتری —"
              searchPlaceholder="جستجو یا افزودن مشتری جدید..."
              required
              clearable={false}
              creatable
              onCreateOption={handleCreateCustomer}
              creating={creatingCustomer}
              createLabel={(name) => (
                <><span className="text-slate-400">افزودن مشتری جدید: </span><span className="font-medium">«{name}»</span></>
              )}
            />
          </Field>
          <Field label="وضعیت فاکتور">
            <SearchableSelect
              value={form.status}
              onChange={(v) => setField('status', v)}
              options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="وضعیت"
              clearable={false}
            />
          </Field>
          <Field label="سایز کاغذ">
            <SearchableSelect
              value={form.paper_size}
              onChange={(v) => setField('paper_size', v)}
              options={PAPER_SIZES.map((p) => ({ value: p.value, label: p.label }))}
              placeholder="سایز"
              clearable={false}
            />
          </Field>
          <Field label="تاریخ فاکتور">
            <JalaliDatePicker value={form.date} onChange={(v) => setField('date', v)} required />
          </Field>
          <Field label="تاریخ سررسید">
            <JalaliDatePicker value={form.due_date} onChange={(v) => setField('due_date', v)} placeholder="بدون سررسید" />
          </Field>

        </div>
      </Section>

      {/* Vehicle */}
      {(() => {
        // Detect moto from plate string: moto format = "NNN-NNNNN" or just "-" when fields are empty
        const plateTrimmed = (form.vehicle_plate || '').trim();
        const isMoto = plateTrimmed === '-' || /^\d+-\d+$/.test(plateTrimmed);
        return (
          <Section
            title={isMoto ? 'اطلاعات موتورسیکلت' : 'اطلاعات خودرو'}
            icon={isMoto ? '🏍️' : '🚗'}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Plate */}
              <Field label="شماره پلاک" className="md:col-span-2">
                <PlateInput
                  value={form.vehicle_plate}
                  onChange={(v) => {
                    const wasMotoBefore = (function(p) { return p === '-' || /^\d+-\d+$/.test(p); })((form.vehicle_plate || '').trim());
                    const isMotoNow = (function(p) { return p === '-' || /^\d+-\d+$/.test(p); })((v || '').trim());
                    const typeChanged = wasMotoBefore !== isMotoNow;
                    // Atomically update both fields to avoid stale-closure double-setState bug
                    setForm((f) => ({
                      ...f,
                      vehicle_plate: v,
                      ...(typeChanged ? { vehicle_type: '' } : {}),
                    }));
                  }}
                />
              </Field>

              {/* VIN */}
              <Field label="شماره شاسی (VIN)">
                <input type="text" placeholder="17 کاراکتر" value={form.vehicle_vin}
                  onChange={(e) => setField('vehicle_vin', e.target.value)}
                  className={inputCls} dir="ltr" maxLength={17} />
              </Field>

              {/* Vehicle / Moto Type */}
              <Field label={isMoto ? 'برند و مدل موتور' : 'نوع خودرو'}>
                {isMoto ? (
                  <SearchableSelect
                    key="moto-type"
                    value={form.vehicle_type}
                    onChange={(v) => setField('vehicle_type', v)}
                    options={MOTO_BRANDS}
                    placeholder="— انتخاب یا افزودن برند/مدل —"
                    searchPlaceholder="جستجو در موتورسیکلت‌ها..."
                    emptyText="موتوری یافت نشد"
                    creatable
                    onCreateOption={handleCreateVehicleType}
                    creating={creatingVehicleType}
                    createLabel={(name) => (
                      <><span className="text-slate-400">افزودن: </span><span className="font-medium">«{name}»</span><span className="text-xs text-emerald-600 mr-2">(ذخیره خودکار)</span></>
                    )}
                  />
                ) : (
                  <SearchableSelect
                    key="car-type"
                    value={form.vehicle_type}
                    onChange={(v) => setField('vehicle_type', v)}
                    options={vehicleTypes.map((vt) => ({ value: vt.name, label: vt.name }))}
                    placeholder="— انتخاب یا افزودن نوع —"
                    searchPlaceholder="جستجو یا افزودن نوع خودرو..."
                    creatable
                    onCreateOption={handleCreateVehicleType}
                    creating={creatingVehicleType}
                    createLabel={(name) => (
                      <><span className="text-slate-400">افزودن نوع جدید: </span><span className="font-medium">«{name}»</span><span className="text-xs text-emerald-600 mr-2">(ذخیره خودکار)</span></>
                    )}
                  />
                )}
              </Field>

              {/* Vehicle Model (text) */}
              <Field label={isMoto ? 'اطلاعات تکمیلی موتور' : 'نام / مدل خودرو'}>
                <input
                  type="text"
                  placeholder={isMoto ? 'مثال: رنگ، سال، موتور ویژه' : 'مثال: پراید، سمند، پژو ۲۰۶'}
                  value={form.vehicle_model}
                  onChange={(e) => setField('vehicle_model', toPersianKeyboard(e.target.value))}
                  className={inputCls}
                />
              </Field>

              {/* Model Year — Jalali */}
              <Field label="سال ساخت (شمسی)">
                <SearchableSelect
                  value={form.vehicle_year || ''}
                  onChange={(v) => setField('vehicle_year', v)}
                  options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))}
                  placeholder="— انتخاب سال —"
                  searchPlaceholder="جستجوی سال..."
                />
              </Field>
            </div>
          </Section>
        );
      })()}

      {/* Items */}
      <Section title={`ردیف‌های فاکتور (${items.length})`} icon="🧾">
        <div className="space-y-2">
          {items.map((item, idx) => (
            <ItemRow key={item._key} item={item} idx={idx} services={services}
              onChange={handleItemChange} onRemove={handleRemoveItem} />
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">هنوز خدمتی اضافه نشده — از دکمه‌های زیر استفاده کنید</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" onClick={() => setShowPicker(true)}
            className="flex-1 min-w-[200px] py-3 rounded-xl bg-blue-500/10 border-2 border-dashed border-blue-500/40 text-blue-400 hover:bg-blue-500/15 hover:border-blue-500/60 transition-all text-sm font-medium flex items-center justify-center gap-2">
            ⚡ انتخاب از لیست خدمات
          </button>
          <button type="button" onClick={handleAddManualRow}
            className="py-3 px-5 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all text-sm">
            + ردیف دستی
          </button>
        </div>
      </Section>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="خلاصه مالی" icon="💰">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="تخفیف">
                <PriceInput value={form.discount} onChange={(v) => setField('discount', v)} />
              </Field>
              <Field label="مالیات (%)">
                <input type="number" step="0.1" min="0" max="100" placeholder="0" value={form.tax} onChange={(e) => setField('tax', e.target.value)} className={inputCls} />
              </Field>
            </div>

            {/* Global Commission */}
            <div className="bg-yellow-500/5 border border-yellow-500/25 rounded-xl p-4">
              <Field label="💼 کارمزد (درآمد شما)">
                <PriceInput value={form.commission_total}
                  onChange={(v) => setField('commission_total', v)}
                  borderColor="border-yellow-500/30 focus:ring-yellow-500/30" />
              </Field>
              <p className="text-yellow-500/60 text-[10px] mt-2">کارمزد به مبلغ کل فاکتور اضافه می‌شود — فقط این مبلغ به عنوان درآمد شما محاسبه می‌گردد</p>
            </div>

            <div className="mt-4 space-y-2 pt-4 border-t border-slate-700/50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">جمع خدمات</span>
                <span className="text-slate-200">{fmt(subtotal)}</span>
              </div>
              {Number(form.commission_total) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-400/80">💼 کارمزد (درآمد شما)</span>
                  <span className="text-yellow-400">+{fmt(Number(form.commission_total))}</span>
                </div>
              )}
              {Number(form.tax) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">مالیات ({form.tax}%)</span>
                  <span className="text-orange-400">+{fmt(taxAmount)}</span>
                </div>
              )}
              {Number(form.discount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">تخفیف</span>
                  <span className="text-green-400">−{fmt(Number(form.discount))}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-slate-600 pt-3">
                <span className="text-white">جمع قابل پرداخت توسط مشتری</span>
                <span className="text-blue-400 text-lg">{fmt(finalAmount)}</span>
              </div>
              {Number(form.commission_total) > 0 && (
                <div className="flex justify-between text-xs text-emerald-400/70 pt-1">
                  <span>🏦 درآمد خالص شما</span>
                  <span>{fmt(Number(form.commission_total))}</span>
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="توضیحات فاکتور" icon="📝">
          <textarea value={form.description} onChange={(e) => setField('description', toPersianKeyboard(e.target.value))}
            rows={5} placeholder="توضیحات اختیاری فاکتور..."
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none min-h-[120px]" />

          {/* Tags */}
          <div className="mt-4">
            <label className="text-xs text-slate-400 mb-1.5 block">🏷️ برچسب‌ها (با کاما جدا کنید)</label>
            <input
              value={(form.tags || []).join('، ')}
              onChange={(e) => {
                const raw = e.target.value;
                const tags = raw.split(/[,،]/).map(t => t.trim()).filter(Boolean);
                setField('tags', tags);
              }}
              placeholder="مثال: فوری، VIP، گارانتی"
              className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {form.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map((tag, i) => (
                  <span key={i} className="text-xs bg-blue-500/15 text-blue-300 border border-blue-500/25 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    {tag}
                    <button type="button" onClick={() => setField('tags', form.tags.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-400 text-[10px]">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Service Picker Modal */}
      {showPicker && (
        <ServicePickerModal services={services} onAdd={handleAddFromPicker} onClose={() => setShowPicker(false)} />
      )}

      <div className="flex justify-end gap-3 border-t border-slate-700/50 pt-4 pb-2">
        <button type="button" onClick={() => navigate(isEdit ? `/invoices/${id}` : '/invoices')}
          className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all">انصراف</button>
        <button type="submit" disabled={saving}
          className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-60">
          {saving ? 'در حال ذخیره...' : isEdit ? '💾 ذخیره' : '✅ ثبت فاکتور'}
        </button>
      </div>
    </form>

      {/* New Customer Modal */}
      {newCustomerModal && (
        <NewCustomerModal
          initialName={newCustomerModal.pendingName}
          onConfirm={handleCustomerModalConfirm}
          onCancel={handleCustomerModalCancel}
          saving={creatingCustomer}
          error={customerError}
        />
      )}
    </>
  );
};

export default InvoiceForm;
