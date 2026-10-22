import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  invoicesAPI,
  profileAPI,
  customersAPI,
  invoiceSettingsAPI,
  documentsAPI,
  downloadDocumentFile,
} from "../services/api";
import { useSelector } from "react-redux";
import { toJalali, numberToWords } from "../utils/persian";
import PriceInput from "../components/PriceInput";

// ─── helpers ──────────────────────────────────────────────────
const fmt = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fa-IR").format(Number(n) || 0) + " تومان";

const persianDate = (dateStr?: string | null) => toJalali(dateStr, "long");

type InvoicePayment = {
  id: number;
  amount: number;
  method: string;
  method_display?: string;
  paid_at: string;
  reference?: string | null;
  note?: string | null;
  created_by_name?: string | null;
};

type PaymentDescriptionsProps = {
  payments?: InvoicePayment[];
  exportMode?: boolean;
};

const PaymentDescriptions = ({
  payments = [],
  exportMode = false,
}: PaymentDescriptionsProps) => {
  if (!payments.length) return null;
  if (exportMode)
    return (
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "12px",
          color: "#374151",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#6b7280",
            marginBottom: "6px",
            fontWeight: 600,
          }}
        >
          توضیحات پرداخت
        </div>
        {payments.map((payment) => (
          <div key={payment.id} style={{ fontSize: "11px", marginTop: "4px" }}>
            دریافت {fmt(payment.amount)} از طریق{" "}
            {payment.method_display || "پرداخت"} در تاریخ{" "}
            {persianDate(payment.paid_at)}
            {payment.reference && ` · شماره پیگیری: ${payment.reference}`}
            {payment.note && ` · توضیح: ${payment.note}`}
          </div>
        ))}
      </section>
    );
  return (
    <section className="print-payment-notes border-b border-slate-700/50 px-5 py-4">
      <p className="mb-1 text-xs font-semibold text-slate-500">
        توضیحات پرداخت
      </p>
      <div className="space-y-1">
        {payments.map((payment) => (
          <p key={payment.id} className="text-sm text-slate-700">
            دریافت {fmt(payment.amount)} از طریق{" "}
            {payment.method_display || "پرداخت"} در تاریخ{" "}
            {persianDate(payment.paid_at)}
            {payment.reference && ` · شماره پیگیری: ${payment.reference}`}
            {payment.note && ` · توضیح: ${payment.note}`}
          </p>
        ))}
      </div>
    </section>
  );
};

type AuditSnapshotItem = {
  id?: number;
  title?: string;
  notes?: string | null;
  quantity?: number;
  main_price: number | string;
  extra_price: number | string;
  commission?: number | string;
};

type InvoiceSnapshot = {
  customer?: number | null;
  customer_name?: string | null;
  date?: string | null;
  status?: string;
  total_amount?: number;
  commission_total?: number;
  discount?: number;
  tax?: number;
  description?: string | null;
  items?: AuditSnapshotItem[];
  vehicle_plate?: string | null;
  vehicle_type?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | null;
  vehicle_vin?: string | null;
  due_date?: string | null;
};

type AuditEvent = {
  id: number;
  action: string;
  action_display: string;
  user_name: string;
  created_at: string;
  is_invoice_version?: boolean;
  changes?: {
    before?: InvoiceSnapshot;
    after?: any;
  };
};

const auditDescription = (event: AuditEvent): string => {
  const { before, after } = (event.changes || {}) as {
    before?: Record<string, any>;
    after?: any;
  };
  if (event.action === "payment") {
    const amount = after?.payment?.amount || after?.removed_payment?.amount;
    if (after?.payment_operation === "deleted")
      return `حذف پرداخت ${amount ? fmt(amount) : ""}`.trim();
    if (after?.payment_operation === "updated")
      return `ویرایش پرداخت ${amount ? fmt(amount) : ""}`.trim();
    return amount ? `ثبت دریافت ${fmt(amount)}` : "ثبت یا تکمیل پرداخت";
  }
  if (event.action === "approval") {
    return after?.event === "edit_requested"
      ? "درخواست ویرایش فاکتور پرداخت‌شده ثبت شد"
      : after?.status === "approved"
        ? "درخواست ویرایش تأیید شد"
        : "درخواست ویرایش رد شد";
  }
  if (event.action === "create") return "فاکتور ایجاد شد";
  if (event.action === "delete") return "فاکتور حذف شد";
  if (before && after) {
    const labels: Record<string, string> = {
      status: "وضعیت",
      customer: "مشتری",
      total_amount: "مبلغ",
      discount: "تخفیف",
      tax: "مالیات",
      description: "توضیحات",
      items: "ردیف‌های خدمات",
    };
    const changed = Object.keys(labels).filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    );
    if (changed.length)
      return `ویرایش ${changed.map((key) => labels[key]).join("، ")}`;
  }
  return event.action_display;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: {
    label: "پیش‌نویس",
    color: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  pending: {
    label: "پرداخت نشده",
    color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  },
  paid: {
    label: "پرداخت شده",
    color: "bg-green-500/20 text-green-300 border-green-500/30",
  },
  commission_paid: {
    label: "کارمزد پرداخت شده",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  cancelled: {
    label: "لغو شده",
    color: "bg-red-500/20 text-red-300 border-red-500/30",
  },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${s.color}`}
    >
      {s.label}
    </span>
  );
};

// ─── Print CSS builder ─────────────────────────────────────────
const buildPrintCSS = (size: string) => {
  const pageSize = size === "a4" ? "A4" : size === "a6" ? "A6" : "A5";
  return `
    @media print {
      @page { size: ${pageSize}; margin: 8mm; }
      body * { visibility: hidden !important; }
      #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
      #invoice-print-area {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        /* With RTL, left + right + width:100% is over-constrained. Chrome
           resolves that conflict differently while applying custom print scale. */
        width: auto;
        max-width: 100%;
        box-sizing: border-box;
        margin: 0;
        background: white; color: #111;
        padding: 0;
        font-family: Vazirmatn, sans-serif;
        font-size: ${size === "a6" ? "9px" : size === "a5" ? "10px" : "12px"};
        direction: rtl;
      }
      .no-print { display: none !important; }
      .print-payment-notes, .print-payment-notes * { color: #111 !important; background: transparent !important; }
      .print-table th, .print-table td { border: 1px solid #ddd; padding: 4px 6px; }
      .print-table { border-collapse: collapse; width: 100%; }
      .print-header { background: transparent !important; color: #111 !important; border: 1px solid #111 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .print-header * { color: #111 !important; }
    }
  `;
};

type InvoiceItem = {
  id?: number;
  service_title_snapshot?: string | null;
  service_title?: string | null;
  notes?: string | null;
  quantity: number;
  main_price: number;
  extra_price: number;
  line_total: number;
};

type InvoiceData = {
  id: number;
  invoice_number: string;
  status: string;
  commission_paid?: boolean;
  customer?: number | null;
  customer_name?: string | null;
  date: string;
  created_at?: string | null;
  due_date?: string | null;
  paper_size?: string;
  card_payment_source?: string | null;
  can_edit?: boolean;
  edit_request_status?: string | null;
  green_card_owner_name?: string | null;
  green_card_owner_national_id?: string | null;
  vehicle_plate?: string | null;
  vehicle_type?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | null;
  vehicle_vin?: string | null;
  description?: string | null;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  discount?: number;
  tax?: number;
  commission_total?: number;
  paid_amount?: number;
  remaining_amount?: number;
};

type BusinessProfile = {
  name?: string;
  subtitle?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  website?: string | null;
  footer_text?: string | null;
  logo_url?: string | null;
  social_links?: {
    id: number;
    name: string;
    url: string;
    logo_url?: string | null;
  }[];
};

type CustomerInfo = {
  phone?: string | null;
  email?: string | null;
};

type PaymentFormData = {
  amount: string | number;
  method: string;
  reference: string;
  note: string;
};

type InvoiceDocument = {
  id: number;
  title?: string | null;
  file_name?: string;
  file_url: string;
};

type InvoiceFields = {
  show_discount_field: boolean;
  show_tax_field: boolean;
  show_seller_signature: boolean;
  show_buyer_signature: boolean;
};

// ─── Main Component ───────────────────────────────────────────
const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((s: any) => s.auth.currentUser);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [paperSize, setPaperSize] = useState("a5");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [invoiceFields, setInvoiceFields] = useState<InvoiceFields>({
    show_discount_field: true,
    show_tax_field: true,
    show_seller_signature: true,
    show_buyer_signature: true,
  });
  const [loading, setLoading] = useState(true);
  const [statusChanging, setStatusChanging] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "jpg" | null>(null); // 'pdf' | 'jpg' | null
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>({
    amount: "",
    method: "cash",
    reference: "",
    note: "",
  });
  const [paymentEditId, setPaymentEditId] = useState<number | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState<PaymentFormData>({
    amount: "",
    method: "cash",
    reference: "",
    note: "",
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(
    null,
  );
  const [expandedVersionId, setExpandedVersionId] = useState<number | null>(
    null,
  );
  const [showPriorSnapshot, setShowPriorSnapshot] = useState(false);
  const [invoiceDocuments, setInvoiceDocuments] = useState<InvoiceDocument[]>(
    [],
  );
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsUploading, setDocumentsUploading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    invoiceSettingsAPI
      .get()
      .then(({ data }) =>
        setInvoiceFields({
          show_discount_field: data.show_discount_field !== false,
          show_tax_field: data.show_tax_field !== false,
          show_seller_signature: data.show_seller_signature !== false,
          show_buyer_signature: data.show_buyer_signature !== false,
        }),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const refreshProfile = () =>
      profileAPI
        .get()
        .then(({ data }) => {
          const p = Array.isArray(data) ? data[0] : data;
          if (p) setProfile(p);
        })
        .catch(() => {});
    refreshProfile();
    window.addEventListener("mohaseb:data-changed", refreshProfile);
    return () =>
      window.removeEventListener("mohaseb:data-changed", refreshProfile);
  }, []);

  useEffect(() => {
    invoicesAPI
      .history(id)
      .then(({ data }) => setHistory(data))
      .catch(() => setHistory([]));
  }, [id]);

  useEffect(() => {
    const refresh = () => {
      invoicesAPI
        .detail(id)
        .then((res) => {
          setInvoice(res.data);
          setPaperSize(res.data.paper_size || "a5");
        })
        .catch(() => {});
      invoicesAPI
        .history(id)
        .then(({ data }) => setHistory(data))
        .catch(() => setHistory([]));
    };
    window.addEventListener("mohaseb:data-changed", refresh);
    return () => window.removeEventListener("mohaseb:data-changed", refresh);
  }, [id]);

  useEffect(() => {
    invoicesAPI
      .detail(id)
      .then((res) => {
        setInvoice(res.data);
        setPaperSize(res.data.paper_size || "a5");
      })
      .catch(() => navigate("/invoices"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const isOperatorWaiting =
      invoice?.status === "paid" &&
      invoice.edit_request_status === "pending" &&
      !currentUser?.is_staff &&
      !currentUser?.is_superuser;
    if (!isOperatorWaiting) return undefined;
    let active = true;
    const refresh = () =>
      invoicesAPI
        .detail(id)
        .then((res) => {
          if (active) setInvoice(res.data);
        })
        .catch(() => {});
    window.addEventListener("mohaseb:data-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("mohaseb:data-changed", refresh);
    };
  }, [
    id,
    invoice?.status,
    invoice?.edit_request_status,
    currentUser?.is_staff,
    currentUser?.is_superuser,
  ]);

  // Fetch customer details (phone/email) for display
  useEffect(() => {
    if (invoice?.customer) {
      customersAPI
        .detail(invoice.customer)
        .then(({ data }) => setCustomerInfo(data))
        .catch(() => {});
    }
  }, [invoice?.customer]);

  const loadInvoiceDocuments = async () => {
    if (!id) return;
    setDocumentsLoading(true);
    try {
      const { data } = await documentsAPI.list({ invoice: id });
      setInvoiceDocuments(Array.isArray(data) ? data : data.results || []);
    } catch {
      setDocumentError("دریافت مدارک فاکتور انجام نشد.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoiceDocuments();
  }, [id]);

  const handleDocumentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!invoice?.customer) {
      setDocumentError(
        "برای بارگذاری مدرک، ابتدا یک مشتری برای فاکتور ثبت کنید.",
      );
      event.target.value = "";
      return;
    }
    setDocumentsUploading(true);
    setDocumentError("");
    try {
      await Promise.all(
        files.map((file) => {
          const formData = new FormData();
          formData.append("customer", String(invoice.customer));
          formData.append("invoice", String(invoice.id));
          formData.append("title", file.name);
          formData.append("file", file);
          return documentsAPI.create(formData);
        }),
      );
      if (documentInputRef.current) documentInputRef.current.value = "";
      await loadInvoiceDocuments();
      window.dispatchEvent(new Event("mohaseb:data-changed"));
    } catch (error) {
      setDocumentError(
        error.response?.data?.file?.[0] || "بارگذاری مدرک انجام نشد.",
      );
    } finally {
      setDocumentsUploading(false);
    }
  };

  const handleDeleteDocument = async (document: InvoiceDocument) => {
    if (!window.confirm(`مدرک «${document.title}» حذف شود؟`)) return;
    setDocumentError("");
    try {
      await documentsAPI.delete(document.id);
      setInvoiceDocuments((items) =>
        items.filter((item) => item.id !== document.id),
      );
      window.dispatchEvent(new Event("mohaseb:data-changed"));
    } catch {
      setDocumentError("حذف مدرک انجام نشد.");
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    setStatusChanging(true);
    setShowStatusMenu(false);
    try {
      const res = await invoicesAPI.changeStatus(id, newStatus);
      setInvoice(res.data);
    } finally {
      setStatusChanging(false);
    }
  };

  const handleCardSourceChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const card_payment_source = event.target.value;
    setStatusChanging(true);
    try {
      const { data } = await invoicesAPI.patch(id, { card_payment_source });
      setInvoice(data);
    } catch (error) {
      setPaymentError(
        error.response?.data?.detail || "ذخیره نوع کارت پرداخت انجام نشد.",
      );
    } finally {
      setStatusChanging(false);
    }
  };

  const handleRequestEdit = async () => {
    setRequestingEdit(true);
    try {
      await invoicesAPI.requestEdit(id);
      const res = await invoicesAPI.detail(id);
      setInvoice(res.data);
    } finally {
      setRequestingEdit(false);
    }
  };

  const handleAddPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaymentSaving(true);
    setPaymentError("");
    try {
      await invoicesAPI.addPayment(id, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      });
      const [invoiceRes, historyRes] = await Promise.all([
        invoicesAPI.detail(id),
        invoicesAPI.history(id),
      ]);
      setInvoice(invoiceRes.data);
      setHistory(historyRes.data);
      setPaymentForm({ amount: "", method: "cash", reference: "", note: "" });
    } catch (error) {
      setPaymentError(
        error.response?.data?.amount ||
          error.response?.data?.detail ||
          "ثبت پرداخت انجام نشد.",
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  const refreshPaymentData = async () => {
    const [invoiceRes, historyRes] = await Promise.all([
      invoicesAPI.detail(id),
      invoicesAPI.history(id),
    ]);
    setInvoice(invoiceRes.data);
    setHistory(historyRes.data);
  };

  const startPaymentEdit = (payment: InvoicePayment) => {
    setPaymentError("");
    setPaymentEditId(payment.id);
    setPaymentEditForm({
      amount: String(payment.amount),
      method: payment.method,
      reference: payment.reference || "",
      note: payment.note || "",
    });
  };

  const handleUpdatePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaymentSaving(true);
    setPaymentError("");
    try {
      await invoicesAPI.updatePayment(id, paymentEditId, {
        ...paymentEditForm,
        amount: Number(paymentEditForm.amount),
      });
      await refreshPaymentData();
      setPaymentEditId(null);
    } catch (error) {
      setPaymentError(
        error.response?.data?.amount ||
          error.response?.data?.detail ||
          "ویرایش پرداخت انجام نشد.",
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDeletePayment = async (payment: InvoicePayment) => {
    if (!window.confirm(`پرداخت ${fmt(payment.amount)} حذف شود؟`)) return;
    setPaymentSaving(true);
    setPaymentError("");
    try {
      await invoicesAPI.deletePayment(id, payment.id);
      await refreshPaymentData();
      if (paymentEditId === payment.id) setPaymentEditId(null);
    } catch (error) {
      setPaymentError(error.response?.data?.detail || "حذف پرداخت انجام نشد.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleRestoreVersion = async (event: AuditEvent) => {
    if (
      !window.confirm(
        "نسخهٔ پیش از ویرایش جایگزین اطلاعات فعلی فاکتور شود؟ این عملیات در تاریخچه ثبت می‌شود.",
      )
    )
      return;
    setRestoringVersionId(event.id);
    try {
      const invoiceRes = await invoicesAPI.restoreVersion(id, event.id);
      const historyRes = await invoicesAPI.history(id);
      setInvoice(invoiceRes.data);
      setHistory(historyRes.data);
      setPaperSize(invoiceRes.data.paper_size || "a5");
    } catch (error) {
      window.alert(error.response?.data?.detail || "بازیابی نسخه انجام نشد.");
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handlePrint = () => window.print();

  const captureCanvas = async () => {
    const { default: html2canvas } = await import("html2canvas");
    const el = exportRef.current;
    if (!el) return null;
    return html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
  };

  const handleSavePDF = async () => {
    setExporting("pdf");
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const { jsPDF } = await import("jspdf");
      const fmt = paperSize.toUpperCase();
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: fmt,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      // Scale image to fill page width
      const ratio = canvas.height / canvas.width;
      const imgH = pageW * ratio;
      let y = 0;
      let remaining = imgH;
      // handle multi-page
      while (remaining > 0) {
        pdf.addImage(
          imgData,
          "JPEG",
          0,
          y === 0
            ? 0
            : -imgH +
                remaining +
                pageH *
                  (Math.ceil(imgH / pageH) - Math.ceil(remaining / pageH)),
          pageW,
          imgH,
        );
        remaining -= pageH;
        if (remaining > 0) pdf.addPage();
        y += pageH;
      }
      pdf.save(`${invoice.invoice_number || "invoice"}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  const handleSaveJPG = async () => {
    setExporting("jpg");
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `${invoice.invoice_number || "invoice"}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    } finally {
      setExporting(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  if (!invoice) return null;

  const isPaidOperator =
    invoice.status === "paid" &&
    !currentUser?.is_staff &&
    !currentUser?.is_superuser;
  const isManager = !!(currentUser?.is_staff || currentUser?.is_superuser);
  const latestInvoiceVersion = isManager
    ? history.find((event) => event.is_invoice_version)
    : null;
  const priorSnapshot = latestInvoiceVersion?.changes?.before;
  const editDateText = latestInvoiceVersion?.created_at
    ? new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(latestInvoiceVersion.created_at))
    : null;
  const priorSnapshotCustomer =
    priorSnapshot?.customer_name ||
    (priorSnapshot?.customer === invoice.customer
      ? invoice.customer_name
      : `شناسه ${priorSnapshot?.customer || "---"}`);
  const priorSnapshotSubtotal = (priorSnapshot?.items || []).reduce(
    (sum, item) =>
      sum +
      (Number(item.main_price) + Number(item.extra_price)) *
        Number(item.quantity || 1),
    0,
  );
  const priorSnapshotFinal =
    priorSnapshotSubtotal +
    Number(priorSnapshot?.commission_total || 0) +
    (priorSnapshotSubtotal * Number(priorSnapshot?.tax || 0)) / 100 -
    Number(priorSnapshot?.discount || 0);

  const subtotal =
    invoice.items?.reduce(
      (s, it) =>
        s +
        ((Number(it.main_price) || 0) + (Number(it.extra_price) || 0)) *
          (Number(it.quantity) || 1),
      0,
    ) || 0;
  const taxAmount = (subtotal * Number(invoice.tax || 0)) / 100;
  const commissionAmt = Number(invoice.commission_total || 0);
  const finalAmount =
    subtotal + commissionAmt + taxAmount - Number(invoice.discount || 0);
  const finalAmountWords = numberToWords(finalAmount);

  return (
    <>
      <style>{buildPrintCSS(paperSize)}</style>

      {/* ── Toolbar (no-print) ── */}
      <div className="no-print space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to="/invoices"
              className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-2 transition-colors"
            >
              ← بازگشت به فاکتورها
            </Link>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                {invoice.invoice_number}
              </h2>
              <StatusBadge
                status={
                  invoice.commission_paid && invoice.status !== "paid"
                    ? "commission_paid"
                    : invoice.status
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Number(invoice.commission_total) > 0 && !isPaidOperator && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 text-sm border border-emerald-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(invoice.commission_paid)}
                  disabled={statusChanging}
                  onChange={async (event) => {
                    setStatusChanging(true);
                    try {
                      const { data } = await invoicesAPI.markCommissionPaid(
                        id,
                        event.target.checked,
                      );
                      setInvoice(data);
                      window.dispatchEvent(new Event("mohaseb:data-changed"));
                    } finally {
                      setStatusChanging(false);
                    }
                  }}
                />
                کارمزد توسط مشتری پرداخت شده است
              </label>
            )}
            {!isPaidOperator && (
              <label className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-300">
                <span>کارت پرداخت</span>
                <select
                  aria-label="کارت پرداخت فاکتور"
                  value={invoice.card_payment_source || "customer"}
                  onChange={handleCardSourceChange}
                  disabled={statusChanging}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white disabled:opacity-60"
                >
                  <option value="customer">کارت مشتری</option>
                  <option value="office">کارت دفتر</option>
                </select>
              </label>
            )}
            {/* Status Change Dropdown */}
            {!isPaidOperator && (
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu((v) => !v)}
                  disabled={statusChanging}
                  className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600 transition-all flex items-center gap-2"
                >
                  {statusChanging ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "⚡"
                  )}
                  تغییر وضعیت
                </button>
                {showStatusMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden w-48">
                    {Object.entries(STATUS_MAP)
                      .filter(([val]) => val !== "commission_paid")
                      .map(([val, { label, color }]) => (
                        <button
                          key={val}
                          onClick={() => handleChangeStatus(val)}
                          className={`w-full text-right px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2 ${invoice.status === val ? "bg-slate-700" : ""}`}
                        >
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs border ${color}`}
                          >
                            {label}
                          </span>
                          {invoice.status === val && (
                            <span className="text-blue-400 text-xs mr-auto">
                              ✓ فعلی
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {invoice.can_edit && (
              <Link
                to={`/invoices/${id}/edit`}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm transition-all flex items-center gap-2"
              >
                ✏️ ویرایش
              </Link>
            )}
            {isManager && latestInvoiceVersion && (
              <button
                type="button"
                onClick={() => setShowPriorSnapshot(true)}
                className="px-3 py-2 rounded-xl bg-sky-700/80 hover:bg-sky-600 text-white text-sm border border-sky-500/40 transition-all flex items-center gap-2"
              >
                ◷ نمایش فاکتور پیش از ویرایش
              </button>
            )}
            {invoice.status === "paid" &&
              !currentUser?.is_staff &&
              !currentUser?.is_superuser &&
              (invoice.edit_request_status === "approved" ? (
                <span className="px-3 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-green-300 text-sm">
                  درخواست ویرایش تأیید شد
                </span>
              ) : invoice.edit_request_status === "pending" ? (
                <button
                  disabled
                  className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-sm cursor-wait"
                >
                  درخواست ویرایش · در انتظار تأیید
                </button>
              ) : (
                <button
                  onClick={handleRequestEdit}
                  disabled={requestingEdit}
                  className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 text-sm disabled:opacity-50"
                >
                  {requestingEdit
                    ? "در حال ارسال..."
                    : "درخواست ویرایش از مدیر"}
                </button>
              ))}

            <button
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600 transition-all flex items-center gap-2"
            >
              🖨️ چاپ ({paperSize.toUpperCase()})
            </button>

            <button
              onClick={handleSavePDF}
              disabled={!!exporting}
              className="px-3 py-2 rounded-xl bg-red-700/80 hover:bg-red-600 text-white text-sm border border-red-600/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
            >
              {exporting === "pdf" ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "📄"
              )}
              ذخیره PDF
            </button>

            <button
              onClick={handleSaveJPG}
              disabled={!!exporting}
              className="px-3 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white text-sm border border-emerald-600/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
            >
              {exporting === "jpg" ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "🖼️"
              )}
              ذخیره تصویر
            </button>
          </div>
        </div>

        {/* Paper Size */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>📄 سایز چاپ:</span>
          {isPaidOperator ? (
            <select
              value={paperSize}
              onChange={(event) => setPaperSize(event.target.value)}
              aria-label="اندازهٔ چاپ فاکتور"
              className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white"
            >
              <option value="a5">A5</option>
              <option value="a4">A4</option>
              <option value="a6">A6</option>
            </select>
          ) : (
            ["a4", "a5", "a6"].map((sz) => (
              <span
                key={sz}
                className={`px-2 py-0.5 rounded-lg border text-xs ${paperSize === sz ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "border-slate-700 text-slate-500"}`}
              >
                {sz.toUpperCase()}
              </span>
            ))
          )}
          {isPaidOperator && (
            <span className="text-slate-600">
              — برای چاپ همین اندازه استفاده می‌شود
            </span>
          )}
        </div>
      </div>

      {/* ── Printable Invoice Area ── */}
      <div id="invoice-print-area" ref={printRef}>
        {/* Invoice Card (screen) */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden no-print-border">
          {/* Header */}
          <div className="print-header bg-transparent border border-slate-900 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {profile?.logo_url ? (
                  <img
                    src={profile.logo_url}
                    alt="logo"
                    className="w-12 h-12 rounded-xl object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl">
                    💎
                  </div>
                )}
                <div>
                  <h1 className="text-white font-bold text-lg">
                    {profile?.name || "محاسب پرو"}
                  </h1>
                  <p className="text-slate-400 text-xs">
                    {profile?.subtitle || "سیستم مدیریت مالی"}
                  </p>
                  {profile?.phone && (
                    <p className="text-slate-400 text-xs">📞 {profile.phone}</p>
                  )}
                  {profile?.mobile && (
                    <p className="text-slate-400 text-xs">
                      📱 {profile.mobile}
                    </p>
                  )}
                  {profile?.address && (
                    <p className="text-slate-400 text-xs">
                      📍 {profile.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-left space-y-1">
                <p className="text-blue-400 font-mono text-lg font-bold">
                  {invoice.invoice_number}
                </p>
                <StatusBadge
                  status={
                    invoice.commission_paid && invoice.status !== "paid"
                      ? "commission_paid"
                      : invoice.status
                  }
                />
                <p className="text-slate-500 text-xs">
                  تاریخ صدور: {persianDate(invoice.date)}
                </p>
                {editDateText && (
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    ویرایش: {editDateText}
                  </p>
                )}
                {invoice.created_at && (
                  <p className="text-slate-500 text-xs mt-1">
                    ایجاد: {persianDate(invoice.created_at)}،{" "}
                    {new Intl.DateTimeFormat("fa-IR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(invoice.created_at))}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer + Vehicle Info — compact horizontal layout */}
          <div className="border-b border-slate-700/50 px-5 py-4">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              {/* Customer card */}
              <div className="flex items-center gap-3 min-w-[160px]">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-blue-600/20 border border-indigo-500/30 flex items-center justify-center text-base shrink-0">
                  👤
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                    مشتری
                  </p>
                  <div className="flex items-center gap-2">
                    {invoice.customer ? (
                      <Link
                        to={`/customers/${invoice.customer}`}
                        className="text-white text-sm font-semibold leading-tight hover:text-blue-300 hover:underline"
                      >
                        {invoice.customer_name || "---"}
                      </Link>
                    ) : (
                      <span className="text-white text-sm font-semibold leading-tight">
                        {invoice.customer_name || "---"}
                      </span>
                    )}
                    {invoice.customer && (
                      <Link
                        to={`/customers/${invoice.customer}?tab=edit`}
                        className="rounded-md border border-slate-600 px-1.5 py-0.5 text-[10px] text-blue-300 hover:bg-slate-700"
                        title="مشاهده و ویرایش پروفایل مشتری"
                      >
                        پروفایل
                      </Link>
                    )}
                  </div>
                  {customerInfo?.phone && (
                    <p className="text-slate-400 text-[11px] mt-0.5 font-mono dir-ltr">
                      📞 {customerInfo.phone}
                    </p>
                  )}
                  {customerInfo?.email && (
                    <p className="text-slate-500 text-[10px] truncate max-w-[140px]">
                      ✉ {customerInfo.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px self-stretch bg-slate-700/50" />

              {/* Vehicle chips */}
              <div className="flex flex-wrap gap-2 flex-1">
                {(invoice.green_card_owner_name ||
                  invoice.green_card_owner_national_id) && (
                  <div className="flex flex-wrap gap-2 w-full">
                    {invoice.green_card_owner_name && (
                      <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200">
                        صاحب برگ سبز: {invoice.green_card_owner_name}
                      </span>
                    )}
                    {invoice.green_card_owner_national_id && (
                      <span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200">
                        کد ملی: {invoice.green_card_owner_national_id}
                      </span>
                    )}
                  </div>
                )}
                {invoice.vehicle_plate && (
                  <div className="flex items-center gap-1.5 bg-slate-700/40 border border-slate-600/40 rounded-lg px-3 py-1.5">
                    <span className="text-slate-500 text-[10px]">پلاک</span>
                    <span className="text-white font-mono text-xs">
                      {invoice.vehicle_plate}
                    </span>
                  </div>
                )}
                {invoice.vehicle_type && (
                  <div className="flex items-center gap-1.5 bg-slate-700/40 border border-slate-600/40 rounded-lg px-3 py-1.5">
                    <span className="text-slate-500 text-[10px]">نوع</span>
                    <span className="text-white text-xs">
                      {invoice.vehicle_type}
                    </span>
                  </div>
                )}
                {invoice.vehicle_model && (
                  <div className="flex items-center gap-1.5 bg-slate-700/40 border border-slate-600/40 rounded-lg px-3 py-1.5">
                    <span className="text-slate-500 text-[10px]">مدل</span>
                    <span className="text-white text-xs">
                      {invoice.vehicle_model}
                    </span>
                  </div>
                )}
                {invoice.vehicle_year && (
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-1.5">
                    <span className="text-emerald-600/70 text-[10px]">سال</span>
                    <span className="text-emerald-400 text-xs font-medium">
                      {invoice.vehicle_year}
                    </span>
                  </div>
                )}
                {invoice.vehicle_vin && (
                  <div className="flex items-center gap-1.5 bg-slate-700/40 border border-slate-600/40 rounded-lg px-3 py-1.5">
                    <span className="text-slate-500 text-[10px]">VIN</span>
                    <span className="text-white font-mono text-[10px]">
                      {invoice.vehicle_vin}
                    </span>
                  </div>
                )}
                {invoice.due_date && (
                  <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-3 py-1.5">
                    <span className="text-yellow-600/70 text-[10px]">
                      سررسید
                    </span>
                    <span className="text-yellow-400 text-xs">
                      {persianDate(invoice.due_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-5 border-b border-slate-700/50">
            <div className="overflow-x-auto">
              <table className="print-table w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700/50 text-xs">
                    <th className="text-right py-3 px-2 font-medium">#</th>
                    <th className="text-right py-3 px-2 font-medium">خدمت</th>
                    <th className="text-right py-3 px-2 font-medium">تعداد</th>
                    <th className="text-right py-3 px-2 font-medium">
                      مبلغ پرداختی
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      مبلغ استعلامی
                    </th>
                    <th className="text-right py-3 px-2 font-medium">
                      جمع ردیف
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {invoice.items?.map((item, i) => (
                    <tr key={item.id || i}>
                      <td className="py-3 px-2 text-slate-500 text-xs">
                        {i + 1}
                      </td>
                      <td className="py-3 px-2 text-white font-medium">
                        {item.service_title_snapshot ||
                          item.service_title ||
                          "---"}
                        {item.notes && (
                          <p className="text-slate-500 text-xs mt-0.5">
                            {item.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-2 text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-2 text-slate-300">
                        {fmt(item.main_price)}
                      </td>
                      <td className="py-3 px-2 text-slate-400">
                        {Number(item.extra_price) > 0
                          ? fmt(item.extra_price)
                          : "—"}
                      </td>
                      <td className="py-3 px-2 text-white font-semibold">
                        {fmt(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Description */}
          {invoice.description && (
            <div className="px-5 py-4 border-b border-slate-700/50">
              <p className="text-slate-500 text-xs mb-1">توضیحات</p>
              <p className="text-slate-300 text-sm">{invoice.description}</p>
            </div>
          )}

          <PaymentDescriptions payments={invoice.payments || []} />

          <section className="no-print border-b border-slate-700/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">
                  📎 مدارک پیوست فاکتور
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  مدارک در پوشهٔ مشتری و همراه این فاکتور ذخیره می‌شوند.
                </p>
              </div>
              <label
                className={`cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 ${documentsUploading ? "pointer-events-none opacity-60" : ""}`}
              >
                {documentsUploading ? "در حال بارگذاری…" : "افزودن مدرک"}
                <input
                  ref={documentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  disabled={documentsUploading}
                  onChange={handleDocumentUpload}
                />
              </label>
            </div>
            {documentError && (
              <p role="alert" className="mt-3 text-xs text-red-400">
                {documentError}
              </p>
            )}
            {documentsLoading ? (
              <p className="mt-4 text-xs text-slate-500">
                در حال دریافت مدارک…
              </p>
            ) : invoiceDocuments.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {invoiceDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/30 px-3 py-2.5"
                  >
                    <span className="text-lg">📄</span>
                    <button
                      type="button"
                      onClick={() => downloadDocumentFile(document.id, document.file_name || document.title).catch(() => setDocumentError("دانلود مدرک ممکن نشد."))}
                      className="min-w-0 flex-1 truncate text-sm text-blue-300 hover:text-blue-200 hover:underline"
                    >
                      {document.title || "مدرک بدون عنوان"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(document)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                مدرکی برای این فاکتور ثبت نشده است.
              </p>
            )}
          </section>

          <section className="no-print p-5 border-b border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold text-white">پرداخت‌های ثبت‌شده</h3>
              <span className="text-sm text-slate-400">
                دریافت‌شده: {fmt(invoice.paid_amount)} · مانده:{" "}
                {fmt(invoice.remaining_amount)}
              </span>
            </div>
            {invoice.payments?.length > 0 ? (
              <div className="space-y-2">
                {invoice.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl bg-slate-700/30 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-emerald-600 font-medium">
                        {fmt(payment.amount)}
                      </span>
                      <span className="text-slate-400">
                        {payment.method_display} ·{" "}
                        {persianDate(payment.paid_at)}
                      </span>
                      <span className="text-slate-500 text-xs">
                        {payment.created_by_name}
                      </span>
                      {payment.reference && (
                        <span className="text-slate-500 text-xs">
                          پیگیری: {payment.reference}
                        </span>
                      )}
                      {!isPaidOperator && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startPaymentEdit(payment)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            disabled={paymentSaving}
                            onClick={() => handleDeletePayment(payment)}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            حذف
                          </button>
                        </div>
                      )}
                    </div>
                    {paymentEditId === payment.id && !isPaidOperator && (
                      <form
                        onSubmit={handleUpdatePayment}
                        className="mt-3 space-y-3 border-t border-slate-600/50 pt-3"
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <PriceInput
                            required
                            min="1"
                            value={paymentEditForm.amount}
                            blankWhenZero
                            placeholder="مبلغ پرداختی"
                            onChange={(amount) =>
                              setPaymentEditForm((f) => ({ ...f, amount }))
                            }
                          />
                          <select
                            value={paymentEditForm.method}
                            onChange={(e) =>
                              setPaymentEditForm((f) => ({
                                ...f,
                                method: e.target.value,
                              }))
                            }
                            className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white"
                          >
                            <option value="cash">نقدی</option>
                            <option value="card">کارت‌خوان</option>
                            <option value="transfer">
                              کارت‌به‌کارت / حواله
                            </option>
                            <option value="other">سایر</option>
                          </select>
                          <input
                            value={paymentEditForm.reference}
                            onChange={(e) =>
                              setPaymentEditForm((f) => ({
                                ...f,
                                reference: e.target.value,
                              }))
                            }
                            placeholder="شماره پیگیری"
                            className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={paymentSaving}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {paymentSaving ? "در حال ذخیره..." : "ذخیره"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentEditId(null)}
                              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300"
                            >
                              انصراف
                            </button>
                          </div>
                        </div>
                        <input
                          value={paymentEditForm.note}
                          onChange={(e) =>
                            setPaymentEditForm((f) => ({
                              ...f,
                              note: e.target.value,
                            }))
                          }
                          placeholder="یادداشت (اختیاری)"
                          className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500"
                        />
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-xs">
                هنوز پرداختی به‌صورت مرحله‌ای ثبت نشده است.
              </p>
            )}
            {paymentError && (
              <p role="alert" className="text-xs text-red-500">
                {paymentError}
              </p>
            )}

            {!isPaidOperator &&
              Number(invoice.remaining_amount) > 0 &&
              !["cancelled", "draft"].includes(invoice.status) && (
                <form
                  onSubmit={handleAddPayment}
                  className="space-y-3 rounded-xl border border-slate-700/50 p-4"
                >
                  <h4 className="text-sm font-medium text-slate-300">
                    ثبت دریافت جدید
                  </h4>
                  {paymentError && (
                    <p role="alert" className="text-xs text-red-500">
                      {paymentError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <PriceInput
                      required
                      min="1"
                      value={paymentForm.amount}
                      blankWhenZero
                      placeholder="مبلغ پرداختی"
                      onChange={(amount) =>
                        setPaymentForm((f) => ({ ...f, amount }))
                      }
                    />
                    <select
                      value={paymentForm.method}
                      onChange={(e) =>
                        setPaymentForm((f) => ({
                          ...f,
                          method: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white"
                    >
                      <option value="cash">نقدی</option>
                      <option value="card">کارت‌خوان</option>
                      <option value="transfer">کارت‌به‌کارت / حواله</option>
                      <option value="other">سایر</option>
                    </select>
                    <input
                      value={paymentForm.reference}
                      onChange={(e) =>
                        setPaymentForm((f) => ({
                          ...f,
                          reference: e.target.value,
                        }))
                      }
                      placeholder="شماره پیگیری (اختیاری)"
                      className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500"
                    />
                    <button
                      disabled={paymentSaving || !paymentForm.amount}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {paymentSaving ? "در حال ثبت..." : "ثبت پرداخت"}
                    </button>
                  </div>
                  <input
                    value={paymentForm.note}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, note: e.target.value }))
                    }
                    placeholder="یادداشت (اختیاری)"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500"
                  />
                </form>
              )}
          </section>

          {/* Totals */}
          <div className="p-5">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">جمع خدمات</span>
                  <span className="text-slate-200">{fmt(subtotal)}</span>
                </div>
                {Number(invoice.commission_total) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400/80">
                      💼{" "}
                      <span className="print:hidden">کارمزد (درآمد شما)</span>
                      <span className="hidden print:inline">کارمزد</span>
                    </span>
                    <span className="text-gray-400">
                      +{fmt(invoice.commission_total)}
                    </span>
                  </div>
                )}
                {invoiceFields.show_tax_field && Number(invoice.tax) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      مالیات ({invoice.tax}%)
                    </span>
                    <span className="text-orange-400">+{fmt(taxAmount)}</span>
                  </div>
                )}
                {invoiceFields.show_discount_field &&
                  Number(invoice.discount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">تخفیف</span>
                      <span className="text-green-400">
                        −{fmt(Number(invoice.discount))}
                      </span>
                    </div>
                  )}
                <div className="flex justify-between text-base font-bold border-t border-slate-600 pt-3">
                  <span className="text-slate-100">
                    جمع قابل پرداخت توسط مشتری
                  </span>
                  <span className="text-blue-400 text-xl">
                    {fmt(finalAmount)}
                  </span>
                </div>
                {Number(invoice.paid_amount ?? 0) > 0 &&
                  Number(invoice.remaining_amount ?? 0) > 0 &&
                  !["cancelled", "draft"].includes(invoice.status) && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">دریافت‌شده</span>
                        <span className="text-emerald-400">
                          {fmt(invoice.paid_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-bold">
                        <span className="text-amber-400">
                          مانده قابل پرداخت
                        </span>
                        <span className="text-amber-400">
                          {fmt(invoice.remaining_amount)}
                        </span>
                      </div>
                    </>
                  )}
                {/* Amount in words */}
                <div className="bg-slate-700/30 rounded-lg px-3 py-2 border border-slate-600/30">
                  <span className="text-slate-500 text-[10px]">به حروف: </span>
                  <span className="text-slate-300 text-[11px] font-medium">
                    {finalAmountWords}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seller seal and buyer signature */}
        {(invoiceFields.show_seller_signature ||
          invoiceFields.show_buyer_signature) && (
          <div
            className={`grid ${invoiceFields.show_seller_signature && invoiceFields.show_buyer_signature ? "grid-cols-2" : "grid-cols-1"} gap-4 border-t border-slate-700/50 p-5 print-seller-signature`}
          >
            {invoiceFields.show_seller_signature && (
              <div className="flex min-h-28 flex-col justify-between rounded-xl border border-dashed border-slate-500/60 p-3">
                <span className="text-xs font-semibold text-slate-300">
                  مهر و امضای فروشنده
                </span>
                <span className="text-center text-[10px] text-slate-500">
                  محل مهر و امضا
                </span>
              </div>
            )}
            {invoiceFields.show_buyer_signature && (
              <div className="flex min-h-28 flex-col justify-between rounded-xl border border-dashed border-slate-500/60 p-3">
                <span className="text-xs font-semibold text-slate-300">
                  امضای خریدار
                </span>
                <span className="text-center text-[10px] text-slate-500">
                  نام و امضا
                </span>
              </div>
            )}
          </div>
        )}

        {/* Print Footer */}
        <div className="hidden print:block text-center text-sm font-semibold text-gray-600 mt-4 pt-2 border-t border-gray-200">
          {profile?.footer_text ||
            "این فاکتور توسط سیستم محاسب پرو صادر شده است"}
          {profile?.website && (
            <span className="mr-2">| {profile.website}</span>
          )}
          {!!profile?.social_links?.length && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-normal">
              {profile.social_links.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5"
                  dir="ltr"
                >
                  {item.logo_url && (
                    <img
                      src={item.logo_url}
                      alt=""
                      crossOrigin="anonymous"
                      className="h-4 w-4 object-contain"
                    />
                  )}
                  <span>
                    {item.name}: {item.url}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {isManager && showPriorSnapshot && priorSnapshot && (
        <div
          className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prior-invoice-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setShowPriorSnapshot(false);
          }}
        >
          <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-700 bg-slate-900/95 px-5 py-4 backdrop-blur">
              <div>
                <h3
                  id="prior-invoice-title"
                  className="text-lg font-bold text-white"
                >
                  فاکتور پیش از ویرایش
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  این تصویر، اطلاعات فاکتور را پیش از آخرین ویرایش نشان می‌دهد.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPriorSnapshot(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                aria-label="بستن پیش‌نمایش"
              >
                بستن ✕
              </button>
            </header>
            <div className="space-y-5 p-5 text-sm text-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <div>
                  <p className="text-xs text-slate-400">شماره فاکتور</p>
                  <p className="mt-1 font-mono text-lg font-bold text-blue-300">
                    {invoice.invoice_number}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    مشتری:{" "}
                    <span className="text-slate-200">
                      {priorSnapshotCustomer}
                    </span>
                  </p>
                </div>
                <div className="text-left text-xs">
                  <p className="text-slate-300">
                    تاریخ صدور:{" "}
                    {priorSnapshot.date
                      ? persianDate(priorSnapshot.date)
                      : "---"}
                  </p>
                  <p className="mt-1 text-sky-300">
                    تاریخ ویرایش: {editDateText}
                  </p>
                  <p className="mt-2">
                    <StatusBadge status={priorSnapshot.status} />
                  </p>
                </div>
              </div>

              {(priorSnapshot.vehicle_plate ||
                priorSnapshot.vehicle_type ||
                priorSnapshot.vehicle_model ||
                priorSnapshot.vehicle_year ||
                priorSnapshot.vehicle_vin ||
                priorSnapshot.due_date) && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-slate-700 p-4 text-xs text-slate-300">
                  {priorSnapshot.vehicle_plate && (
                    <span>پلاک: {priorSnapshot.vehicle_plate}</span>
                  )}
                  {priorSnapshot.vehicle_type && (
                    <span>نوع خودرو: {priorSnapshot.vehicle_type}</span>
                  )}
                  {priorSnapshot.vehicle_model && (
                    <span>مدل: {priorSnapshot.vehicle_model}</span>
                  )}
                  {priorSnapshot.vehicle_year && (
                    <span>سال ساخت: {priorSnapshot.vehicle_year}</span>
                  )}
                  {priorSnapshot.vehicle_vin && (
                    <span>VIN: {priorSnapshot.vehicle_vin}</span>
                  )}
                  {priorSnapshot.due_date && (
                    <span>سررسید: {persianDate(priorSnapshot.due_date)}</span>
                  )}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full min-w-[620px] text-right text-xs">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="p-3">شرح</th>
                      <th className="p-3">تعداد</th>
                      <th className="p-3">مبلغ پرداختی</th>
                      <th className="p-3">مبلغ استعلام</th>
                      <th className="p-3">کارمزد</th>
                      <th className="p-3">جمع ردیف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(priorSnapshot.items || []).map((item, index) => (
                      <tr
                        key={`${latestInvoiceVersion.id}-${item.id || index}`}
                      >
                        <td className="p-3">
                          {item.title || "خدمت"}
                          {item.notes && (
                            <div className="mt-1 text-[10px] text-slate-500">
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {new Intl.NumberFormat("fa-IR").format(
                            item.quantity || 1,
                          )}
                        </td>
                        <td className="p-3">{fmt(item.main_price)}</td>
                        <td className="p-3">{fmt(item.extra_price)}</td>
                        <td className="p-3">
                          {fmt(
                            Number(item.commission) *
                              Number(item.quantity || 1),
                          )}
                        </td>
                        <td className="p-3">
                          {fmt(
                            (Number(item.main_price) +
                              Number(item.extra_price)) *
                              Number(item.quantity || 1),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {priorSnapshot.description && (
                <p className="whitespace-pre-wrap rounded-xl border border-slate-700 p-4 text-xs text-slate-300">
                  توضیحات: {priorSnapshot.description}
                </p>
              )}
              <div className="ml-auto max-w-sm space-y-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4 text-xs">
                <div className="flex justify-between">
                  <span>مبلغ کل</span>
                  <span>{fmt(priorSnapshotSubtotal)}</span>
                </div>
                {Number(priorSnapshot.commission_total) > 0 && (
                  <div className="flex justify-between">
                    <span>کارمزد</span>
                    <span>{fmt(priorSnapshot.commission_total)}</span>
                  </div>
                )}
                {invoiceFields.show_tax_field &&
                  Number(priorSnapshot.tax) > 0 && (
                    <div className="flex justify-between">
                      <span>مالیات ({priorSnapshot.tax}٪)</span>
                      <span>
                        {fmt(
                          (priorSnapshotSubtotal * Number(priorSnapshot.tax)) /
                            100,
                        )}
                      </span>
                    </div>
                  )}
                {invoiceFields.show_discount_field &&
                  Number(priorSnapshot.discount) > 0 && (
                    <div className="flex justify-between">
                      <span>تخفیف</span>
                      <span>−{fmt(priorSnapshot.discount)}</span>
                    </div>
                  )}
                <div className="flex justify-between border-t border-slate-700 pt-2 text-sm font-bold text-white">
                  <span>مبلغ نهایی</span>
                  <span>{fmt(priorSnapshotFinal)}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {isManager && history.length > 0 && (
        <section className="no-print mt-6 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <h3 className="mb-3 font-semibold text-white">تاریخچهٔ فاکتور</h3>
          <div className="space-y-2">
            {history.map((event) => {
              const oldInvoice = event.changes?.before;
              const canRestore =
                event.is_invoice_version &&
                (currentUser?.is_staff || currentUser?.is_superuser);
              const expanded = expandedVersionId === event.id;
              return (
                <div
                  key={event.id}
                  className="rounded-xl bg-slate-700/30 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-200">
                      {auditDescription(event)}{" "}
                      <span className="text-slate-500">
                        — {event.user_name}
                      </span>
                    </span>
                    <time className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat("fa-IR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.created_at))}
                    </time>
                  </div>
                  {event.is_invoice_version && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedVersionId(expanded ? null : event.id)
                        }
                        className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-blue-300 hover:bg-slate-700"
                      >
                        {expanded
                          ? "بستن نسخهٔ پیش از ویرایش"
                          : "مشاهدهٔ نسخهٔ پیش از ویرایش"}
                      </button>
                      {canRestore && (
                        <button
                          type="button"
                          disabled={restoringVersionId === event.id}
                          onClick={() => handleRestoreVersion(event)}
                          className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          {restoringVersionId === event.id
                            ? "در حال بازیابی…"
                            : "بازیابی این نسخه"}
                        </button>
                      )}
                    </div>
                  )}
                  {expanded && oldInvoice && (
                    <div className="mt-3 rounded-lg border border-slate-600/70 bg-slate-900/40 p-3 text-xs text-slate-300">
                      <div className="mb-2 grid gap-1 sm:grid-cols-2">
                        <span>
                          مشتری:{" "}
                          {oldInvoice.customer_name ||
                            (oldInvoice.customer === invoice.customer
                              ? invoice.customer_name
                              : `شناسه ${oldInvoice.customer || "---"}`)}
                        </span>
                        <span>
                          تاریخ فاکتور:{" "}
                          {oldInvoice.date
                            ? persianDate(oldInvoice.date)
                            : "---"}
                        </span>
                        <span>مبلغ کل: {fmt(oldInvoice.total_amount)}</span>
                        <span>کارمزد: {fmt(oldInvoice.commission_total)}</span>
                        <span>تخفیف: {fmt(oldInvoice.discount)}</span>
                        <span>مالیات: {oldInvoice.tax || 0}٪</span>
                        <span>
                          وضعیت:{" "}
                          {STATUS_MAP[oldInvoice.status]?.label ||
                            oldInvoice.status ||
                            "---"}
                        </span>
                      </div>
                      {oldInvoice.description && (
                        <p className="mb-2 whitespace-pre-wrap">
                          توضیحات: {oldInvoice.description}
                        </p>
                      )}
                      <div className="space-y-1 border-t border-slate-700 pt-2">
                        {(oldInvoice.items || []).map((item, index) => (
                          <div
                            key={`${event.id}-${item.id || index}`}
                            className="flex flex-wrap justify-between gap-x-3 gap-y-1"
                          >
                            <span>
                              {item.title || "خدمت"} ×{" "}
                              {new Intl.NumberFormat("fa-IR").format(
                                item.quantity || 1,
                              )}
                            </span>
                            <span>
                              {fmt(
                                (Number(item.main_price) +
                                  Number(item.extra_price)) *
                                  Number(item.quantity || 1),
                              )}
                            </span>
                          </div>
                        ))}
                        {!(oldInvoice.items || []).length && (
                          <span className="text-slate-500">
                            ردیفی برای این نسخه ثبت نشده است.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {/* ── Hidden Export Area (clean white for PDF/JPG) ── */}
      <div
        ref={exportRef}
        style={{
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          width: "794px",
          background: "#ffffff",
          color: "#111111",
          fontFamily: "Vazirmatn, sans-serif",
          direction: "rtl",
          padding: "24px",
          fontSize: "13px",
        }}
      >
        {/* Export Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            background: "#1e3a5f",
            color: "white",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {profile?.logo_url && (
              <img
                src={profile.logo_url}
                alt="logo"
                crossOrigin="anonymous"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  objectFit: "cover",
                }}
              />
            )}
            <div>
              <div style={{ fontWeight: "bold", fontSize: "16px" }}>
                {profile?.name || "محاسب پرو"}
              </div>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>
                {profile?.subtitle || "سیستم مدیریت مالی"}
              </div>
              {profile?.phone && (
                <div style={{ fontSize: "11px", opacity: 0.7 }}>
                  📞 {profile.phone}
                </div>
              )}
              {profile?.mobile && (
                <div style={{ fontSize: "11px", opacity: 0.7 }}>
                  📱 {profile.mobile}
                </div>
              )}
              {profile?.address && (
                <div style={{ fontSize: "11px", opacity: 0.7 }}>
                  📍 {profile.address}
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "18px",
                fontWeight: "bold",
                color: "#93c5fd",
              }}
            >
              {invoice?.invoice_number}
            </div>
            <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "4px" }}>
              تاریخ صدور: {invoice?.date && persianDate(invoice.date)}
            </div>
            {editDateText && (
              <div style={{ fontSize: "9px", opacity: 0.65, marginTop: "2px" }}>
                ویرایش: {editDateText}
              </div>
            )}
            <div
              style={{
                display: "inline-block",
                marginTop: "4px",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                background:
                  invoice?.status === "paid"
                    ? "#166534"
                    : invoice?.status === "cancelled"
                      ? "#991b1b"
                      : "#713f12",
                color: "white",
              }}
            >
              {invoice?.commission_paid && invoice?.status !== "paid"
                ? "کارمزد پرداخت شده"
                : STATUS_MAP[invoice?.status]?.label || ""}
            </div>
          </div>
        </div>

        {/* Customer + Vehicle — export area */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "12px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          {/* Customer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: "160px",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                flexShrink: 0,
              }}
            >
              👤
            </div>
            <div>
              <div
                style={{
                  fontSize: "9px",
                  color: "#9ca3af",
                  marginBottom: "2px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                مشتری
              </div>
              <div
                style={{
                  fontWeight: "700",
                  fontSize: "13px",
                  color: "#111827",
                }}
              >
                {invoice?.customer_name || "---"}
              </div>
              {customerInfo?.phone && (
                <div
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    marginTop: "1px",
                    direction: "ltr",
                    textAlign: "right",
                  }}
                >
                  📞 {customerInfo.phone}
                </div>
              )}
            </div>
          </div>
          {/* Vehicle chips */}
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: "6px", flex: 1 }}
          >
            {invoice?.vehicle_plate && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "9px" }}>پلاک</span>
                <span style={{ fontFamily: "monospace" }}>
                  {invoice.vehicle_plate}
                </span>
              </div>
            )}
            {invoice?.vehicle_type && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "9px" }}>نوع</span>
                {invoice.vehicle_type}
              </div>
            )}
            {invoice?.vehicle_model && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "9px" }}>مدل</span>
                {invoice.vehicle_model}
              </div>
            )}
            {invoice?.vehicle_year && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "#6b7280", fontSize: "9px" }}>سال</span>
                <span style={{ color: "#16a34a", fontWeight: "600" }}>
                  {invoice.vehicle_year}
                </span>
              </div>
            )}
            {invoice?.vehicle_vin && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "10px",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "9px" }}>VIN</span>
                <span style={{ fontFamily: "monospace" }}>
                  {invoice.vehicle_vin}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "12px",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f3f4f6",
                borderBottom: "2px solid #e5e7eb",
              }}
            >
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                #
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                خدمت
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                تعداد
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                مبلغ پرداختی
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                مبلغ استعلامی
              </th>
              <th
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                جمع ردیف
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice?.items?.map((item, i) => (
              <tr
                key={item.id || i}
                style={{ borderBottom: "1px solid #e5e7eb" }}
              >
                <td
                  style={{ padding: "8px", color: "#9ca3af", fontSize: "11px" }}
                >
                  {i + 1}
                </td>
                <td style={{ padding: "8px", fontWeight: "500" }}>
                  {item.service_title_snapshot || item.service_title || "---"}
                  {item.notes && (
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "10px",
                        marginTop: "2px",
                      }}
                    >
                      {item.notes}
                    </div>
                  )}
                </td>
                <td style={{ padding: "8px" }}>{item.quantity}</td>
                <td style={{ padding: "8px" }}>{fmt(item.main_price)}</td>
                <td style={{ padding: "8px", color: "#6b7280" }}>
                  {Number(item.extra_price) > 0 ? fmt(item.extra_price) : "—"}
                </td>
                <td style={{ padding: "8px", fontWeight: "600" }}>
                  {fmt(item.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Description */}
        {invoice?.description && (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: "#6b7280",
                marginBottom: "4px",
              }}
            >
              توضیحات
            </div>
            <div style={{ fontSize: "12px" }}>{invoice.description}</div>
          </div>
        )}

        <PaymentDescriptions payments={invoice?.payments || []} exportMode />

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              minWidth: "280px",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
                fontSize: "12px",
              }}
            >
              <span style={{ color: "#6b7280" }}>جمع خدمات</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {commissionAmt > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                  fontSize: "12px",
                }}
              >
                <span style={{ color: "#92400e" }}>💼 کارمزد</span>
                <span style={{ color: "#92400e" }}>+{fmt(commissionAmt)}</span>
              </div>
            )}
            {invoiceFields.show_tax_field && taxAmount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                  fontSize: "12px",
                }}
              >
                <span style={{ color: "#6b7280" }}>
                  مالیات ({invoice?.tax}%)
                </span>
                <span style={{ color: "#d97706" }}>+{fmt(taxAmount)}</span>
              </div>
            )}
            {invoiceFields.show_discount_field &&
              Number(invoice?.discount) > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>تخفیف</span>
                  <span style={{ color: "#059669" }}>
                    −{fmt(Number(invoice?.discount))}
                  </span>
                </div>
              )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "2px solid #e5e7eb",
                paddingTop: "8px",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              <span>جمع قابل پرداخت</span>
              <span style={{ color: "#1d4ed8" }}>{fmt(finalAmount)}</span>
            </div>
            <div
              style={{
                marginTop: "8px",
                padding: "8px",
                background: "#f9fafb",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#4b5563",
              }}
            >
              به حروف: {finalAmountWords}
            </div>
          </div>
        </div>

        {/* Seller seal and buyer signature */}
        {(invoiceFields.show_seller_signature ||
          invoiceFields.show_buyer_signature) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                invoiceFields.show_seller_signature &&
                invoiceFields.show_buyer_signature
                  ? "1fr 1fr"
                  : "1fr",
              gap: "12px",
              marginTop: "14px",
            }}
          >
            {invoiceFields.show_seller_signature && (
              <div
                style={{
                  height: "88px",
                  border: "1px dashed #9ca3af",
                  borderRadius: "8px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ fontSize: "11px" }}>
                  مهر و امضای فروشنده
                </strong>
                <span
                  style={{
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "9px",
                  }}
                >
                  محل مهر و امضا
                </span>
              </div>
            )}
            {invoiceFields.show_buyer_signature && (
              <div
                style={{
                  height: "88px",
                  border: "1px dashed #9ca3af",
                  borderRadius: "8px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ fontSize: "11px" }}>امضای خریدار</strong>
                <span
                  style={{
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "9px",
                  }}
                >
                  نام و امضا
                </span>
              </div>
            )}
          </div>
        )}

        {/* Export Footer */}
        <div
          style={{
            textAlign: "center",
            borderTop: "1px solid #e5e7eb",
            marginTop: "16px",
            paddingTop: "8px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#6b7280",
          }}
        >
          {profile?.footer_text ||
            "این فاکتور توسط سیستم محاسب پرو صادر شده است"}
          {profile?.website && (
            <span style={{ marginRight: "8px" }}>| {profile.website}</span>
          )}
          {!!profile?.social_links?.length && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                columnGap: "16px",
                rowGap: "6px",
                marginTop: "8px",
                fontWeight: 400,
              }}
            >
              {profile.social_links.map((item) => (
                <span
                  key={item.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    direction: "ltr",
                  }}
                >
                  {item.logo_url && (
                    <img
                      src={item.logo_url}
                      alt=""
                      crossOrigin="anonymous"
                      style={{
                        width: "14px",
                        height: "14px",
                        objectFit: "contain",
                      }}
                    />
                  )}
                  <span>
                    {item.name}: {item.url}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InvoiceDetail;
