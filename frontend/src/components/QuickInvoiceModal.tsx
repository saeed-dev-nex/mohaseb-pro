import React, { useEffect, useState, useRef } from "react";
import {
  invoicesAPI,
  servicesAPI,
  customersAPI,
  invoiceSettingsAPI,
} from "../services/api";
import PriceInput from "./PriceInput";
import { toPersianKeyboard } from "../utils/persian";

const fmt = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fa-IR").format(Number(n) || 0);
const inp =
  "w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all";

type QuickItem = {
  _key: number;
  service: number | null;
  service_title_snapshot: string;
  quantity: number;
  main_price: number;
  extra_price: number;
  notes: string;
};

type ServiceOption = {
  id: number;
  title: string;
  is_active: boolean;
  default_main_price?: number | null;
  default_extra_price?: number | null;
};

type CustomerSuggestion = {
  id: number;
  name: string;
  phone?: string;
};

// ── Customer Autocomplete ──
type CustomerAutoCompleteProps = {
  value?: string;
  onChange: (value: string) => void;
  onPhoneChange: (phone: string) => void;
  phone?: string;
};

const CustomerAutoComplete = ({
  value,
  onChange,
  onPhoneChange,
  phone,
}: CustomerAutoCompleteProps) => {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await customersAPI.list({ search: query });
        const list = data.results || data;
        setSuggestions(list.slice(0, 6));
        setOpen(list.length > 0);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className={inp}
        value={query}
        onChange={(e) => {
          const val = toPersianKeyboard(e.target.value);
          setQuery(val);
          onChange(val);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="نام مشتری (جدید یا موجود)"
        autoFocus
      />
      {query && !suggestions.find((s) => s.name === query) && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400/80 pointer-events-none">
          + مشتری جدید
        </span>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-50 shadow-xl max-h-48 overflow-y-auto">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setQuery(c.name);
                onChange(c.name);
                if (c.phone) onPhoneChange(c.phone);
                setOpen(false);
              }}
              className="w-full text-right px-4 py-2.5 hover:bg-slate-700/50 transition-colors flex items-center justify-between gap-2"
            >
              <span className="text-white text-sm">{c.name}</span>
              <span className="text-slate-500 text-xs font-mono">
                {c.phone || ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Quick Service Row ──
type ServiceRowProps = {
  item: QuickItem;
  index: number;
  services: ServiceOption[];
  onChange: (index: number, item: QuickItem) => void;
  onRemove: (index: number) => void;
};

const ServiceRow = ({
  item,
  index,
  services,
  onChange,
  onRemove,
}: ServiceRowProps) => {
  const [showSvcList, setShowSvcList] = useState(false);
  const filteredSvc = services.filter(
    (s) =>
      s.is_active &&
      s.title
        .toLowerCase()
        .includes((item.service_title_snapshot || "").toLowerCase()),
  );

  return (
    <div className="bg-slate-700/30 rounded-xl p-3 space-y-2 group relative">
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-2 left-2 w-6 h-6 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all text-xs opacity-0 group-hover:opacity-100"
      >
        ×
      </button>

      {/* Service title + auto-suggest */}
      <div className="relative">
        <input
          value={item.service_title_snapshot}
          onChange={(e) => {
            const val = toPersianKeyboard(e.target.value);
            onChange(index, {
              ...item,
              service_title_snapshot: val,
              service: null,
            });
            setShowSvcList(val.length > 0);
          }}
          onFocus={() => item.service_title_snapshot && setShowSvcList(true)}
          onBlur={() => setTimeout(() => setShowSvcList(false), 200)}
          placeholder="عنوان خدمت (تایپ کنید یا از لیست انتخاب کنید)"
          className={`${inp} text-xs`}
        />
        {showSvcList && filteredSvc.length > 0 && (
          <div className="absolute top-full right-0 left-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-50 shadow-xl max-h-36 overflow-y-auto">
            {filteredSvc.slice(0, 5).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(index, {
                    ...item,
                    service: s.id,
                    service_title_snapshot: s.title,
                    main_price: s.default_main_price || 0,
                    extra_price: s.default_extra_price || 0,
                  });
                  setShowSvcList(false);
                }}
                className="w-full text-right px-3 py-2 hover:bg-slate-700/50 text-sm text-white transition-colors flex justify-between"
              >
                <span>{s.title}</span>
                <span className="text-slate-500 text-xs">
                  {fmt(s.default_main_price)} ت
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Price + Quantity */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 mb-0.5 block">
            قیمت اصلی
          </label>
          <PriceInput
            value={item.main_price}
            onChange={(v) => onChange(index, { ...item, main_price: v })}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-0.5 block">
            قیمت اضافی
          </label>
          <PriceInput
            value={item.extra_price}
            onChange={(v) => onChange(index, { ...item, extra_price: v })}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 mb-0.5 block">
            تعداد
          </label>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) =>
              onChange(index, {
                ...item,
                quantity: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className={`${inp} text-xs`}
          />
        </div>
      </div>

      {/* Line total */}
      <div className="text-left">
        <span className="text-blue-400 text-xs font-medium">
          {fmt(
            ((Number(item.main_price) || 0) + (Number(item.extra_price) || 0)) *
              (Number(item.quantity) || 1),
          )}{" "}
          تومان
        </span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// ══  Quick Invoice Modal  ════════════════════
// ══════════════════════════════════════════════
type QuickInvoiceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
};

const QuickInvoiceModal = ({
  isOpen,
  onClose,
  onSuccess,
}: QuickInvoiceModalProps) => {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<QuickItem[]>([
    {
      _key: Math.random(),
      service: null,
      service_title_snapshot: "",
      quantity: 1,
      main_price: 0,
      extra_price: 0,
      notes: "",
    },
  ]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("pending");
  const [cardPaymentSource, setCardPaymentSource] = useState("customer");
  const [officeCardThreshold, setOfficeCardThreshold] = useState(0);
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    servicesAPI
      .list()
      .then(({ data }) => setServices(data.results || data))
      .catch(() => {});
    invoiceSettingsAPI
      .get()
      .then(({ data }) =>
        setOfficeCardThreshold(Number(data.office_card_fee_threshold) || 0),
      )
      .catch(() => {});
    // Reset form on open
    setCustomerName("");
    setCustomerPhone("");
    setDescription("");
    setItems([
      {
        _key: Math.random(),
        service: null,
        service_title_snapshot: "",
        quantity: 1,
        main_price: 0,
        extra_price: 0,
        notes: "",
      },
    ]);
    setCommissionTotal(0);
    setResult(null);
    setError("");
    setStatus("pending");
    setCardPaymentSource("customer");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const refreshReferences = () => {
      servicesAPI
        .list()
        .then(({ data }) => setServices(data.results || data))
        .catch(() => {});
      invoiceSettingsAPI
        .get()
        .then(({ data }) =>
          setOfficeCardThreshold(Number(data.office_card_fee_threshold) || 0),
        )
        .catch(() => {});
    };
    window.addEventListener("mohaseb:data-changed", refreshReferences);
    return () =>
      window.removeEventListener("mohaseb:data-changed", refreshReferences);
  }, [isOpen]);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        _key: Math.random(),
        service: null,
        service_title_snapshot: "",
        quantity: 1,
        main_price: 0,
        extra_price: 0,
        notes: "",
      },
    ]);
  };

  const updateRow = (idx: number, updated: QuickItem) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  const removeRow = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce(
    (s, it) =>
      s +
      ((Number(it.main_price) || 0) + (Number(it.extra_price) || 0)) *
        (Number(it.quantity) || 1),
    0,
  );
  const commissionAmt = Number(commissionTotal) || 0;
  const officeCardFee =
    cardPaymentSource === "office" &&
    officeCardThreshold > 0 &&
    subtotal > officeCardThreshold
      ? Math.floor(subtotal / 100)
      : 0;
  const grandTotal = subtotal + commissionAmt + officeCardFee;

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      setError("نام مشتری الزامی است");
      return;
    }
    if (items.every((it) => !it.service_title_snapshot && !it.main_price)) {
      setError("حداقل یک ردیف خدمت لازم است");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        status,
        card_payment_source: cardPaymentSource,
        description,
        commission_total: commissionAmt,
        items: items
          .filter((it) => it.service_title_snapshot || it.main_price)
          .map((it) => ({
            service: it.service || null,
            service_title_snapshot: it.service_title_snapshot,
            quantity: Number(it.quantity) || 1,
            main_price: Number(it.main_price) || 0,
            extra_price: Number(it.extra_price) || 0,
            notes: it.notes || "",
          })),
      };
      const { data } = await invoicesAPI.quickCreate(payload);
      setResult(data);
      if (onSuccess) onSuccess(data);
    } catch (e) {
      const msg = e.response?.data;
      setError(
        typeof msg === "object"
          ? msg.error || JSON.stringify(msg)
          : "خطا در صدور فاکتور",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Success view
  if (result) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-3xl animate-bounce">
              ✅
            </div>
            <h3 className="text-white font-bold text-lg">{result.message}</h3>
            <div className="bg-slate-700/40 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">شماره فاکتور</span>
                <span className="text-blue-400 font-mono">
                  {result.invoice?.invoice_number}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">مشتری</span>
                <span className="text-white">{result.customer?.name}</span>
              </div>
              {result.customer?.is_new && (
                <span className="inline-block text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                  🆕 مشتری جدید ایجاد شد
                </span>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">مبلغ کل</span>
                <span className="text-white font-semibold">
                  {fmt(result.invoice?.total_amount)} تومان
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-all"
              >
                بستن
              </button>
              <button
                onClick={() => {
                  window.location.href = `/invoices/${result.invoice?.id}`;
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm transition-all"
              >
                مشاهده فاکتور
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-500/30 flex items-center justify-center text-lg">
              ⚡
            </span>
            <div>
              <h3 className="text-white font-semibold text-sm">فاکتور سریع</h3>
              <p className="text-slate-500 text-[10px]">
                صدور فاکتور بدون نیاز به تنظیمات کامل
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-xl">
              ⚠️ {error}
            </div>
          )}

          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                👤 نام مشتری *
              </label>
              <CustomerAutoComplete
                value={customerName}
                onChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
                phone={customerPhone}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                📱 تلفن مشتری
              </label>
              <input
                className={inp}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="09..."
              />
            </div>
          </div>

          {/* Services */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-medium">
                🔧 خدمات
              </label>
              <button
                type="button"
                onClick={addRow}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
              >
                + ردیف جدید
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <ServiceRow
                  key={item._key}
                  item={item}
                  index={idx}
                  services={services}
                  onChange={updateRow}
                  onRemove={removeRow}
                />
              ))}
            </div>
          </div>

          {/* Commission */}
          <div className="bg-yellow-500/5 border border-yellow-500/25 rounded-xl p-3">
            <label className="text-xs text-yellow-400/80 mb-1 block">
              💼 کارمزد کلی (اصلی)
            </label>
            <PriceInput
              value={commissionTotal}
              onChange={(v) => setCommissionTotal(v)}
            />
            <p className="text-yellow-500/50 text-[10px] mt-1">
              کارمزد به مبلغ کل اضافه می‌شود
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              📝 توضیحات
            </label>
            <textarea
              className={inp}
              rows={2}
              value={description}
              onChange={(e) =>
                setDescription(toPersianKeyboard(e.target.value))
              }
              placeholder="توضیحات اختیاری..."
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              کارت پرداخت
            </label>
            <div className="flex gap-2">
              {[
                { value: "customer", label: "کارت مشتری" },
                { value: "office", label: "کارت دفتر" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCardPaymentSource(option.value)}
                  className={`flex-1 text-xs py-2 rounded-xl border transition-all ${cardPaymentSource === option.value ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-slate-700/30 border-slate-600/30 text-slate-400"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {officeCardFee > 0 && (
              <p className="text-amber-300 text-[11px] mt-2">
                ردیف واریزی خودکار: {fmt(officeCardFee)} تومان
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">وضعیت</label>
            <div className="flex gap-2">
              {[
                { v: "pending", l: "پرداخت نشده", c: "yellow" },
                { v: "paid", l: "پرداخت شده", c: "green" },
              ].map((s) => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setStatus(s.v)}
                  className={`flex-1 text-xs py-2 rounded-xl border transition-all ${
                    status === s.v
                      ? `bg-${s.c}-500/20 border-${s.c}-500/40 text-${s.c}-400`
                      : "bg-slate-700/30 border-slate-600/30 text-slate-400 hover:bg-slate-700/50"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-700/50 p-5 space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">جمع خدمات</span>
              <span className="text-slate-200">
                {fmt(subtotal)}{" "}
                <span className="text-xs font-normal">تومان</span>
              </span>
            </div>
            {officeCardFee > 0 && (
              <div className="flex justify-between text-sm text-amber-300">
                <span>واریزی کارت دفتر</span>
                <span>+{fmt(officeCardFee)} تومان</span>
              </div>
            )}
            {commissionAmt > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-yellow-400/80">💼 کارمزد</span>
                <span className="text-yellow-400">
                  +{fmt(commissionAmt)}{" "}
                  <span className="text-xs font-normal">تومان</span>
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-slate-600/50 pt-1.5">
              <span className="text-slate-100">مبلغ کل قابل پرداخت</span>
              <span className="text-white text-lg">
                {fmt(grandTotal)}{" "}
                <span className="text-xs font-normal">تومان</span>
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-all"
            >
              انصراف
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "⚡"
              )}
              صدور فاکتور
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickInvoiceModal;
