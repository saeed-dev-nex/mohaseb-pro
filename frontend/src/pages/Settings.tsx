import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import {
  profileAPI,
  socialNetworksAPI,
  backupConfigAPI,
  backupAPI,
  invoiceSettingsAPI,
  welcomeAPI,
  servicesAPI,
  servicePackagesAPI,
} from "../services/api";
import PasswordInput from "../components/PasswordInput";
import { hideWaiting, showWaiting } from "../lib/waiting";
import {
  SHORTCUT_ACTIONS,
  comboFromEvent,
  findConflict,
  loadShortcuts,
  resetShortcuts,
  saveShortcuts,
} from "../lib/shortcuts";
import type { ShortcutMap } from "../lib/shortcuts";

const inp =
  "w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all";
const RESTORE_CONFIRMATION_PHRASE = "تایید";

type ProfileForm = {
  name: string;
  subtitle: string;
  phone: string;
  mobile: string;
  address: string;
  website: string;
  footer_text: string;
  tax_id: string;
  customer_documents_path: string;
};

type BackupCfg = {
  backup_path: string;
  auto_backup: boolean;
  backup_frequency: string;
  backup_hour: number;
  last_backup_at: string | null;
  last_backup_path: string;
  cloud_enabled: boolean;
  cloud_endpoint: string;
  cloud_bucket: string;
  cloud_access_key: string;
  cloud_retention: number;
  last_cloud_backup_at: string | null;
  last_cloud_backup_key: string;
  last_cloud_error: string;
};

type CloudBackupItem = {
  key: string;
  size: number;
  last_modified: string;
};

type InvoiceCfg = {
  office_card_fee_threshold: number | string;
  show_discount_field: boolean;
  show_tax_field: boolean;
  show_seller_signature: boolean;
  show_buyer_signature: boolean;
  enable_invoice_clone: boolean;
};

type WelcomeCfg = {
  enabled: boolean;
  global_message: string;
};

type WelcomeUser = {
  id: number;
  name: string;
};

type PersonalGreeting = {
  user_id: number;
  name: string;
  message: string;
};

type SocialLink = {
  id: number;
  name: string;
  url: string;
  logo_url?: string | null;
};

type SocialForm = {
  id: number | null;
  name: string;
  url: string;
  logo: File | null;
};

type FolderPickerData = {
  path: string;
  roots?: string[];
  parent?: string | null;
  folders?: { name: string; path: string }[];
};

type SectionProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
};

const Section = ({ title, icon, children }: SectionProps) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-700/50 bg-slate-700/20">
      <span className="text-lg">{icon}</span>
      <h3 className="text-white font-semibold text-sm">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

type FieldProps = {
  label: string;
  children: ReactNode;
};

const F = ({ label, children }: FieldProps) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-slate-400">{label}</label>
    {children}
  </div>
);

type PkgService = { id: number; title: string; is_active: boolean };
type Pkg = {
  id: number;
  name: string;
  services: number[];
  service_titles: { id: number; title: string }[];
  is_active: boolean;
};

// Manager-arranged ready-made service bundles. Applied with one click from
// the invoice form / quick invoice; editing them lives here in Settings.
const ServicePackagesSection = () => {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [allServices, setAllServices] = useState<PkgService[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    servicePackagesAPI
      .list()
      .then(({ data }) => setPkgs(data?.results || data || []))
      .catch(() => {});
    servicesAPI
      .list()
      .then(({ data }) => setAllServices(data?.results || data || []))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const resetEditor = () => {
    setEditingId(null);
    setPkgName("");
    setSelected([]);
  };

  const handleSave = async () => {
    if (!pkgName.trim()) {
      setErr("نام پکیج را وارد کنید");
      return;
    }
    if (selected.length === 0) {
      setErr("حداقل یک خدمت برای پکیج انتخاب کنید");
      return;
    }
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      if (editingId)
        await servicePackagesAPI.update(editingId, {
          name: pkgName.trim(),
          services: selected,
        });
      else
        await servicePackagesAPI.create({
          name: pkgName.trim(),
          services: selected,
        });
      setMsg(editingId ? "✅ پکیج ویرایش شد" : "✅ پکیج ساخته شد");
      resetEditor();
      load();
    } catch {
      setErr("خطا در ذخیره پکیج؛ دوباره تلاش کنید");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: Pkg) => {
    if (!window.confirm(`پکیج «${pkg.name}» حذف شود؟`)) return;
    try {
      await servicePackagesAPI.delete(pkg.id);
      if (editingId === pkg.id) resetEditor();
      load();
    } catch {
      setErr("خطا در حذف پکیج");
    }
  };

  const toggleService = (sid: number) =>
    setSelected((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );

  return (
    <Section title="پکیج‌های خدمات آماده" icon="📦">
      <p className="text-xs text-slate-400 leading-6 mb-4">
        برای هر نیاز تکرارشونده یک بستهٔ آماده از خدمات بچینید؛ موقع صدور فاکتور
        (فرم کامل و فاکتور سریع) با یک کلیک، همهٔ خدمات پکیج با قیمت‌های پیش‌فرض
        به ردیف‌های فاکتور اضافه می‌شوند.
      </p>
      {err && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm mb-4">
          {err}
        </div>
      )}
      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 text-sm mb-4">
          {msg}
        </div>
      )}
      {pkgs.length > 0 && (
        <div className="space-y-2 mb-5">
          {pkgs.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-600/50 bg-slate-700/30 px-4 py-3"
            >
              <span className="text-sm text-white font-medium">
                📦 {pkg.name}
              </span>
              <span className="text-xs text-slate-400 flex-1">
                {pkg.service_titles.map((t) => t.title).join("، ") ||
                  "بدون خدمت"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingId(pkg.id);
                  setPkgName(pkg.name);
                  setSelected(pkg.services);
                  setErr("");
                  setMsg("");
                }}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
              >
                ✏️ ویرایش
              </button>
              <button
                type="button"
                onClick={() => handleDelete(pkg)}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
              >
                🗑️ حذف
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-4 rounded-xl border border-slate-600/40 p-4">
        <F label={editingId ? "ویرایش پکیج" : "پکیج جدید"}>
          <input
            value={pkgName}
            onChange={(e) => setPkgName(e.target.value)}
            placeholder="مثال: خلافی و عوارض"
            className={inp}
          />
        </F>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            خدمات پکیج
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pl-1">
            {allServices
              .filter((s) => s.is_active)
              .map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm text-slate-200 bg-slate-700/30 border border-slate-600/40 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="accent-violet-500"
                  />
                  {s.title}
                </label>
              ))}
            {allServices.length === 0 && (
              <p className="text-xs text-slate-500">خدمتی یافت نشد</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60 transition-all"
          >
            {saving
              ? "در حال ذخیره..."
              : editingId
                ? "💾 ذخیره ویرایش"
                : "➕ ساخت پکیج"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetEditor}
              className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm"
            >
              انصراف
            </button>
          )}
        </div>
      </div>
    </Section>
  );
};

// ─── Keyboard shortcuts editor ─────────────────────────────────────
// Per-user shortcuts (localStorage — see lib/shortcuts). Click «تغییر»
// and press the desired combo; Esc cancels. A combo must include
// Ctrl/Alt/Meta so plain typing is never hijacked; assigning a combo
// that another action already uses is rejected with a message.
const ShortcutsSection: React.FC = () => {
  const [map, setMap] = useState<ShortcutMap>(() => loadShortcuts());
  const [capturing, setCapturing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!capturing) return undefined;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return; // modifier-only so far — keep waiting
      const conflict = findConflict(map, combo, capturing);
      if (conflict) {
        setMsg(`⚠️ این میانبر قبلاً برای «${conflict.label}» ثبت شده است`);
        return;
      }
      const next = { ...map, [capturing]: combo };
      setMap(next);
      saveShortcuts(next);
      setCapturing(null);
      setMsg("✅ میانبر ذخیره شد و همین حالا فعال است");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, map]);

  const clearOne = (id: string) => {
    const next = { ...map, [id]: "" };
    setMap(next);
    saveShortcuts(next);
    setMsg("میانبر حذف شد");
  };

  return (
    <Section title="میانبرهای صفحه‌کلید" icon="⌨️">
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-400">
          برای تغییر، روی «تغییر» بزنید و ترکیب کلید دلخواه را فشار دهید (Esc =
          لغو). میانبر باید دست‌کم یکی از کلیدهای Ctrl یا Alt را داشته باشد تا
          با تایپ عادی تداخل نکند. میانبرها برای کاربر فعلی روی همین سیستم و
          مرورگر ذخیره می‌شوند و بلافاصله فعال‌اند.
        </p>
        {SHORTCUT_ACTIONS.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3"
          >
            <span className="flex-1 text-sm text-slate-200">{a.label}</span>
            {capturing === a.id ? (
              <span className="animate-pulse text-xs text-amber-300">
                ⌨️ کلیدها را فشار دهید… (Esc = لغو)
              </span>
            ) : (
              <kbd
                className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
                dir="ltr"
              >
                {map[a.id] || "تعریف نشده"}
              </kbd>
            )}
            <button
              type="button"
              onClick={() => {
                setMsg("");
                setCapturing(a.id);
              }}
              className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 transition-all hover:bg-blue-500/20"
            >
              ✏️ تغییر
            </button>
            {map[a.id] && capturing !== a.id && (
              <button
                type="button"
                onClick={() => clearOne(a.id)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition-all hover:bg-red-500/20"
              >
                🗑 حذف
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setMap(resetShortcuts());
              setMsg("میانبرها به پیش‌فرض برگشتند");
            }}
            className="rounded-lg border border-slate-600 bg-slate-700/40 px-3 py-1.5 text-xs text-slate-200 transition-all hover:bg-slate-700/70"
          >
            ↩️ بازنشانی همه به پیش‌فرض
          </button>
          {msg && <span className="text-xs text-slate-300">{msg}</span>}
        </div>
      </div>
    </Section>
  );
};

const Settings = () => {
  const isSuperuser = useSelector(
    (state: any) => state.auth.currentUser?.is_superuser,
  );
  const isManager = useSelector(
    (state: any) =>
      !!(
        state.auth.currentUser?.is_staff || state.auth.currentUser?.is_superuser
      ),
  );
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    subtitle: "",
    phone: "",
    mobile: "",
    address: "",
    website: "",
    footer_text: "",
    tax_id: "",
    customer_documents_path: "",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Backup config state
  const [backupCfg, setBackupCfg] = useState<BackupCfg>({
    backup_path: "",
    auto_backup: false,
    backup_frequency: "daily",
    backup_hour: 13,
    last_backup_at: null,
    last_backup_path: "",
    cloud_enabled: false,
    cloud_endpoint: "https://s3.ir-thr-at1.arvanstorage.ir",
    cloud_bucket: "",
    cloud_access_key: "",
    cloud_retention: 30,
    last_cloud_backup_at: null,
    last_cloud_backup_key: "",
    last_cloud_error: "",
  });
  const [cloudSecret, setCloudSecret] = useState("");
  const [cloudPassphrase, setCloudPassphrase] = useState("");
  const [cloudMsg, setCloudMsg] = useState("");
  const [cloudBackups, setCloudBackups] = useState<CloudBackupItem[]>([]);
  const [cloudRestoreKey, setCloudRestoreKey] = useState("");
  const [cloudRestorePassphrase, setCloudRestorePassphrase] = useState("");
  const [cloudRestoreCounts, setCloudRestoreCounts] = useState<Record<
    string,
    number
  > | null>(null);
  const [cloudRestorePhrase, setCloudRestorePhrase] = useState("");
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [activeTab, setActiveTab] = useState("brand");
  const settingsTabs = [
    { id: "brand", label: "برند و تماس", icon: "🎨", visible: true },
    { id: "invoice", label: "تنظیمات فاکتور", icon: "🧾", visible: isManager },
    { id: "packages", label: "پکیج‌های خدمات", icon: "📦", visible: true },
    {
      id: "shortcuts",
      label: "میانبرهای صفحه‌کلید",
      icon: "⌨️",
      visible: true,
    },
    {
      id: "welcome",
      label: "خوش‌آمدگویی روزانه",
      icon: "🎉",
      visible: isManager,
    },
    {
      id: "storage",
      label: "مدارک و مسیرها",
      icon: "📁",
      visible: isSuperuser,
    },
    { id: "backup", label: "پشتیبان‌گیری", icon: "💾", visible: isSuperuser },
  ].filter((t) => t.visible);
  const [invoiceCfg, setInvoiceCfg] = useState<InvoiceCfg>({
    office_card_fee_threshold: 0,
    show_discount_field: true,
    show_tax_field: true,
    show_seller_signature: true,
    show_buyer_signature: true,
    enable_invoice_clone: true,
  });
  const [invoiceCfgSaving, setInvoiceCfgSaving] = useState(false);
  const [invoiceCfgMsg, setInvoiceCfgMsg] = useState("");
  const [welcomeCfg, setWelcomeCfg] = useState<WelcomeCfg>({
    enabled: false,
    global_message: "",
  });
  const [welcomeUsers, setWelcomeUsers] = useState<WelcomeUser[]>([]);
  const [personalGreetings, setPersonalGreetings] = useState<
    PersonalGreeting[]
  >([]);
  const [personalUserId, setPersonalUserId] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [personalSaving, setPersonalSaving] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialForm, setSocialForm] = useState<SocialForm>({
    id: null,
    name: "",
    url: "",
    logo: null,
  });
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialError, setSocialError] = useState("");
  const socialLogoInputRef = useRef<HTMLInputElement>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerTarget, setFolderPickerTarget] = useState("backup");
  const [folderPickerData, setFolderPickerData] =
    useState<FolderPickerData | null>(null);
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);
  const [folderPickerError, setFolderPickerError] = useState("");
  const [restoreBackup, setRestoreBackup] = useState<string | null>(null);
  const [restoreCounts, setRestoreCounts] = useState<Record<
    string,
    number
  > | null>(null);
  const [restorePhrase, setRestorePhrase] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const isRestoreConfirmed =
    restorePhrase.trim() === RESTORE_CONFIRMATION_PHRASE;

  useEffect(() => {
    Promise.all([
      profileAPI.get(),
      isSuperuser
        ? backupConfigAPI.get().catch(() => ({ data: {} }))
        : Promise.resolve({ data: {} }),
      invoiceSettingsAPI.get().catch(() => ({ data: {} })),
      isManager
        ? welcomeAPI.getConfig().catch(() => ({ data: {} }))
        : Promise.resolve({ data: {} }),
      isManager
        ? welcomeAPI.users().catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
      isManager
        ? welcomeAPI.personal().catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ])
      .then(([pRes, bRes, iRes, wRes, wuRes, wpRes]) => {
        const profile = Array.isArray(pRes.data) ? pRes.data[0] : pRes.data;
        if (profile) {
          setForm({
            name: profile.name || "",
            subtitle: profile.subtitle || "",
            phone: profile.phone || "",
            mobile: profile.mobile || "",
            address: profile.address || "",
            website: profile.website || "",
            footer_text: profile.footer_text || "",
            tax_id: profile.tax_id || "",
            customer_documents_path: profile.customer_documents_path || "",
          });
          setSocialLinks(profile.social_links || []);
          if (profile.logo_url) setLogoPreview(profile.logo_url);
        }
        if (bRes.data && Object.keys(bRes.data).length) {
          setBackupCfg((prev) => ({ ...prev, ...bRes.data }));
        }
        if (iRes.data && Object.keys(iRes.data).length)
          setInvoiceCfg((prev) => ({ ...prev, ...iRes.data }));
        setWelcomeCfg((prev) => ({ ...prev, ...wRes.data }));
        setWelcomeUsers(wuRes.data || []);
        setPersonalGreetings(wpRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isManager, isSuperuser]);

  const set = (k: keyof ProfileForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setBcfg = (k: keyof BackupCfg, v: string | number | boolean) =>
    setBackupCfg((f) => ({ ...f, [k]: v }) as BackupCfg);

  const loadServerFolders = async (path: string = "") => {
    setFolderPickerLoading(true);
    setFolderPickerError("");
    try {
      const { data } = await backupConfigAPI.browseFolders(path);
      setFolderPickerData(data);
    } catch (error) {
      setFolderPickerError(
        error.response?.data?.detail ||
          "امکان دریافت پوشه‌های سرور وجود ندارد.",
      );
    } finally {
      setFolderPickerLoading(false);
    }
  };

  const openServerFolderPicker = (target: string) => {
    setFolderPickerTarget(target);
    setFolderPickerOpen(true);
    loadServerFolders("");
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSocialSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!socialForm.name.trim() || !socialForm.url.trim()) return;
    setSocialSaving(true);
    setSocialError("");
    const body = new FormData();
    body.append("name", socialForm.name.trim());
    body.append("url", socialForm.url.trim());
    if (socialForm.logo) body.append("logo", socialForm.logo);
    try {
      const { data } = socialForm.id
        ? await socialNetworksAPI.update(socialForm.id, body)
        : await socialNetworksAPI.create(body);
      setSocialLinks((previous) =>
        socialForm.id
          ? previous.map((item) => (item.id === data.id ? data : item))
          : [...previous, data],
      );
      setSocialForm({ id: null, name: "", url: "", logo: null });
      if (socialLogoInputRef.current) socialLogoInputRef.current.value = "";
    } catch (error) {
      setSocialError(
        error.response?.data?.url?.[0] ||
          error.response?.data?.name?.[0] ||
          error.response?.data?.logo?.[0] ||
          "ذخیره شبکهٔ اجتماعی انجام نشد.",
      );
    } finally {
      setSocialSaving(false);
    }
  };

  const handleSocialEdit = (item: SocialLink) => {
    setSocialForm({ id: item.id, name: item.name, url: item.url, logo: null });
    if (socialLogoInputRef.current) socialLogoInputRef.current.value = "";
  };
  const handleSocialDelete = async (id: number) => {
    try {
      await socialNetworksAPI.delete(id);
      setSocialLinks((previous) => previous.filter((item) => item.id !== id));
      if (socialForm.id === id) {
        setSocialForm({ id: null, name: "", url: "", logo: null });
        if (socialLogoInputRef.current) socialLogoInputRef.current.value = "";
      }
    } catch {
      setSocialError("حذف شبکهٔ اجتماعی انجام نشد.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k !== "customer_documents_path" || isSuperuser) fd.append(k, v);
    });
    if (logoFile) fd.append("logo", logoFile);
    try {
      await profileAPI.update(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert("خطا در ذخیره: " + JSON.stringify(e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBackupConfig = async () => {
    setBackupSaving(true);
    try {
      const payload: Record<string, string | number | boolean> = {
        backup_path: backupCfg.backup_path,
        auto_backup: backupCfg.auto_backup,
        backup_frequency: backupCfg.backup_frequency,
        backup_hour: Number(backupCfg.backup_hour),
        cloud_enabled: backupCfg.cloud_enabled,
        cloud_endpoint: backupCfg.cloud_endpoint,
        cloud_bucket: backupCfg.cloud_bucket,
        cloud_access_key: backupCfg.cloud_access_key,
        cloud_retention: Number(backupCfg.cloud_retention),
      };
      // Secrets are write-only: only send them when the user typed a new one.
      if (cloudSecret) payload.cloud_secret_key = cloudSecret;
      if (cloudPassphrase) payload.cloud_passphrase = cloudPassphrase;
      const { data } = await backupConfigAPI.update(payload);
      setBackupCfg((prev) => ({ ...prev, ...data }));
      setBackupMsg("✅ تنظیمات بکاپ ذخیره شد");
      setTimeout(() => setBackupMsg(""), 3000);
    } catch (e) {
      setBackupMsg("❌ خطا در ذخیره تنظیمات بکاپ");
      setTimeout(() => setBackupMsg(""), 4000);
    } finally {
      setBackupSaving(false);
    }
  };

  const handleSaveInvoiceConfig = async () => {
    setInvoiceCfgSaving(true);
    try {
      const { data } = await invoiceSettingsAPI.update({
        office_card_fee_threshold:
          Number(invoiceCfg.office_card_fee_threshold) || 0,
        show_discount_field: Boolean(invoiceCfg.show_discount_field),
        show_tax_field: Boolean(invoiceCfg.show_tax_field),
        show_seller_signature: Boolean(invoiceCfg.show_seller_signature),
        show_buyer_signature: Boolean(invoiceCfg.show_buyer_signature),
        enable_invoice_clone: invoiceCfg.enable_invoice_clone !== false,
      });
      setInvoiceCfg((prev) => ({ ...prev, ...data }));
      setInvoiceCfgMsg("✅ تنظیمات واریزی ذخیره شد");
    } catch (error) {
      setInvoiceCfgMsg(
        error.response?.data?.detail || "❌ ذخیره تنظیمات واریزی انجام نشد",
      );
    } finally {
      setInvoiceCfgSaving(false);
      setTimeout(() => setInvoiceCfgMsg(""), 4000);
    }
  };

  const handleSaveWelcomeConfig = async () => {
    setWelcomeSaving(true);
    try {
      const { data } = await welcomeAPI.updateConfig(welcomeCfg);
      setWelcomeCfg(data);
      setWelcomeMsg("تنظیمات پیام خوش‌آمدگویی ذخیره شد.");
    } catch (error) {
      setWelcomeMsg(error.response?.data?.detail || "ذخیره تنظیمات انجام نشد.");
    } finally {
      setWelcomeSaving(false);
      window.setTimeout(() => setWelcomeMsg(""), 4000);
    }
  };

  const handleSavePersonalGreeting = async () => {
    if (!personalUserId || !personalMessage.trim()) return;
    setPersonalSaving(true);
    try {
      await welcomeAPI.savePersonal({
        user_id: Number(personalUserId),
        message: personalMessage.trim(),
      });
      const { data } = await welcomeAPI.personal();
      setPersonalGreetings(data);
      setPersonalMessage("");
      setWelcomeMsg("پیام شخصی ذخیره شد.");
    } catch (error) {
      setWelcomeMsg(
        error.response?.data?.message?.[0] || "ذخیره پیام شخصی انجام نشد.",
      );
    } finally {
      setPersonalSaving(false);
      window.setTimeout(() => setWelcomeMsg(""), 4000);
    }
  };

  const handleRemovePersonalGreeting = async (userId: number) => {
    try {
      await welcomeAPI.removePersonal(userId);
      setPersonalGreetings((previous) =>
        previous.filter((item) => item.user_id !== userId),
      );
    } catch {
      setWelcomeMsg("حذف پیام شخصی انجام نشد.");
    }
  };

  const handleRunBackup = async (saveToPath: boolean) => {
    setBackupRunning(true);
    setBackupMsg("");
    showWaiting("در حال تهیهٔ نسخهٔ پشتیبان…");
    try {
      if (saveToPath && backupCfg.backup_path) {
        // Save to disk
        const { data } = await backupConfigAPI.runBackup({
          path: backupCfg.backup_path,
          passphrase: backupPassphrase || undefined,
        });
        if (data.saved) {
          setBackupCfg((prev) => ({
            ...prev,
            last_backup_path: data.path,
            last_backup_at: new Date().toISOString(),
          }));
          let msg = `✅ بکاپ در مسیر ذخیره شد: ${data.path}`;
          if (data.cloud) {
            msg += data.cloud.uploaded
              ? " — ☁️ کپی ابری هم آپلود شد"
              : ` — ⚠️ آپلود ابری ناموفق بود: ${data.cloud.reason || ""}`;
          }
          setBackupMsg(msg);
        }
      } else {
        // Let the user choose a local filename and destination when supported.
        let saveHandle: any = null;
        const showSaveFilePicker = (window as any).showSaveFilePicker as
          undefined | ((options: unknown) => Promise<any>);
        if (showSaveFilePicker) {
          try {
            saveHandle = await showSaveFilePicker({
              suggestedName: `mohaseb_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
              types: [
                {
                  description: "فایل پشتیبان محاسب پرو",
                  accept: { "application/json": [".json"] },
                },
              ],
            });
          } catch (error) {
            if (error.name === "AbortError") {
              return;
            }
            // Fall back to the browser download when the native picker is unavailable.
          }
        }

        const response = await backupConfigAPI.runBackupDownload({
          passphrase: backupPassphrase || undefined,
        });
        const blob = new Blob([response.data]);
        const cd = response.headers?.["content-disposition"] || "";
        const fnMatch = cd.match(/filename="?([^"]+)"?/);
        const filename = fnMatch
          ? fnMatch[1]
          : `mohaseb_backup_${new Date().toISOString().slice(0, 10)}.json`;
        if (saveHandle) {
          const writable = await saveHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          setBackupMsg("✅ فایل بکاپ در محل انتخاب‌شده ذخیره شد");
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          setBackupMsg(
            "✅ دانلود بکاپ آغاز شد؛ محل ذخیره طبق تنظیمات مرورگر است",
          );
        }
      }
      setTimeout(() => setBackupMsg(""), 5000);
    } catch (e) {
      let errorData = e.response?.data;
      if (errorData instanceof Blob) {
        try {
          errorData = JSON.parse(await errorData.text());
        } catch {
          /* Keep the generic message. */
        }
      }
      const detail = errorData?.detail;
      setBackupMsg(`❌ ${detail || "خطا در اجرای بکاپ"}`);
      setTimeout(() => setBackupMsg(""), 4000);
    } finally {
      setBackupRunning(false);
      hideWaiting();
    }
  };

  const handleTestCloud = async () => {
    setCloudMsg("در حال بررسی اتصال ابری…");
    try {
      const { data } = await backupConfigAPI.testCloud({
        cloud_endpoint: backupCfg.cloud_endpoint,
        cloud_bucket: backupCfg.cloud_bucket,
        cloud_access_key: backupCfg.cloud_access_key,
        ...(cloudSecret ? { cloud_secret_key: cloudSecret } : {}),
      });
      if (data.ok) setCloudMsg("✅ اتصال ابری برقرار است");
    } catch (e) {
      setCloudMsg(
        `❌ ${e.response?.data?.detail || "بررسی اتصال ابری ناموفق بود"}`,
      );
    }
  };

  const handleListCloud = async () => {
    setCloudMsg("در حال خواندن فهرست ابری…");
    try {
      const { data } = await backupConfigAPI.listCloud();
      setCloudBackups(data.backups || []);
      setCloudMsg(
        data.backups?.length
          ? `☁️ ${data.backups.length} نسخه در ابر پیدا شد`
          : "☁️ باکتی خالی است؛ هنوز نسخه‌ای آپلود نشده",
      );
    } catch (e) {
      setCloudMsg(
        `❌ ${e.response?.data?.detail || "خواندن فهرست ابری ناموفق بود"}`,
      );
    }
  };

  const handleUploadLatest = async () => {
    setCloudMsg("در حال آپلود آخرین بکاپ…");
    showWaiting("در حال آپلود بکاپ به فضای ابری…");
    try {
      const { data } = await backupConfigAPI.uploadLatest();
      if (data.uploaded) {
        setCloudMsg(`✅ آخرین بکاپ به ابر آپلود شد: ${data.key}`);
        const { data: cfg } = await backupConfigAPI.get();
        setBackupCfg((prev) => ({ ...prev, ...cfg }));
      }
    } catch (e) {
      setCloudMsg(`❌ ${e.response?.data?.detail || "آپلود ابری ناموفق بود"}`);
    } finally {
      hideWaiting();
    }
  };

  const handleCloudRestoreValidate = async () => {
    setCloudMsg("");
    setCloudRestoreCounts(null);
    showWaiting("در حال بررسی فایل پشتیبان ابری…");
    try {
      const { data } = await backupConfigAPI.restoreCloud({
        key: cloudRestoreKey,
        passphrase: cloudRestorePassphrase || undefined,
      });
      if (data.valid) {
        setCloudRestoreCounts(data.counts);
        setCloudMsg("✅ فایل ابری سالم است؛ برای بازیابی، «تایید» را بنویسید");
      }
    } catch (e) {
      setCloudMsg(
        `❌ ${e.response?.data?.detail || "بررسی فایل ابری ناموفق بود"}`,
      );
    } finally {
      hideWaiting();
    }
  };

  const handleCloudRestoreConfirm = async () => {
    showWaiting("در حال بازیابی از بکاپ ابری…");
    try {
      const { data } = await backupConfigAPI.restoreCloud({
        key: cloudRestoreKey,
        passphrase: cloudRestorePassphrase || undefined,
        confirm_replace: true,
      });
      if (data.restored) {
        setCloudMsg("✅ بازیابی از بکاپ ابری انجام شد");
        setCloudRestoreCounts(null);
        setCloudRestorePhrase("");
      }
    } catch (e) {
      setCloudMsg(
        `❌ ${e.response?.data?.detail || "بازیابی از بکاپ ابری ناموفق بود"}`,
      );
    } finally {
      hideWaiting();
    }
  };

  const handleSelectRestoreFile = async (file: File | null | undefined) => {
    if (!file) return;
    setBackupMsg("");
    setRestoreBackup(null);
    setRestoreCounts(null);
    setRestorePhrase("");
    showWaiting("در حال بررسی فایل پشتیبان…");
    try {
      const rawBackup = await file.text();
      const { data } = await backupAPI.restore({
        backup_json: rawBackup,
        confirm_replace: false,
        passphrase: restorePassphrase || undefined,
      });
      setRestoreBackup(rawBackup);
      setRestoreCounts(data.counts);
      setBackupMsg("✅ فایل پشتیبان سالم است و برای بازیابی آماده است.");
    } catch (error) {
      setBackupMsg(
        `❌ ${error.response?.data?.detail || "فایل انتخاب‌شده معتبر نیست."}`,
      );
    } finally {
      hideWaiting();
    }
  };

  const handleRestore = async () => {
    if (!restoreBackup || !isRestoreConfirmed) return;
    setRestoreBusy(true);
    showWaiting("در حال بازیابی اطلاعات…");
    try {
      await backupAPI.restore({
        backup_json: restoreBackup,
        confirm_replace: true,
        passphrase: restorePassphrase || undefined,
      });
      setBackupMsg("✅ بازیابی انجام شد؛ برنامه در حال بارگذاری مجدد است.");
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setBackupMsg(
        `❌ ${error.response?.data?.detail || "بازیابی انجام نشد."}`,
      );
    } finally {
      setRestoreBusy(false);
      hideWaiting();
    }
  };

  const persianDate = (d: string | null | undefined): string => {
    if (!d) return "---";
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(d));
    } catch {
      return d;
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">⚙️ تنظیمات</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            شخصی‌سازی برند، لوگو و اطلاعات فروشگاه
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm transition-all flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "✅"
          )}
          ذخیره تنظیمات
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          ✅ تنظیمات با موفقیت ذخیره شد
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Vertical tab sidebar */}
        <aside className="w-full md:w-56 shrink-0 md:sticky md:top-6">
          <nav
            className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0"
            aria-label="بخش‌های تنظیمات"
          >
            {settingsTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                aria-current={activeTab === t.id ? "page" : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap text-right transition-all border ${
                  activeTab === t.id
                    ? "bg-blue-600/15 border-blue-500/40 text-blue-300 font-medium"
                    : "bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/40"
                }`}
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 w-full space-y-6">
          {activeTab === "brand" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Branding */}
              <Section title="برند و لوگو" icon="🎨">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-slate-700/50 border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <span className="text-3xl">💎</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1.5">
                        لوگو (PNG/JPG)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="block w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer file:transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <F label="نام مجموعه">
                      <input
                        className={inp}
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="نام فروشگاه"
                      />
                    </F>
                    <F label="زیرعنوان">
                      <input
                        className={inp}
                        value={form.subtitle}
                        onChange={(e) => set("subtitle", e.target.value)}
                        placeholder="سیستم مدیریت مالی"
                      />
                    </F>
                  </div>
                  <F label="شناسه مالیاتی">
                    <input
                      className={inp}
                      value={form.tax_id}
                      onChange={(e) => set("tax_id", e.target.value)}
                      placeholder="شناسه مالیاتی (اختیاری)"
                    />
                  </F>
                </div>
              </Section>

              {/* Contact */}
              <Section title="اطلاعات تماس" icon="📞">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <F label="تلفن ثابت">
                      <input
                        className={inp}
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder="021-12345678"
                      />
                    </F>
                    <F label="موبایل">
                      <input
                        className={inp}
                        value={form.mobile}
                        onChange={(e) => set("mobile", e.target.value)}
                        placeholder="09121234567"
                      />
                    </F>
                  </div>
                  <F label="آدرس">
                    <textarea
                      className={inp}
                      rows={2}
                      value={form.address}
                      onChange={(e) => set("address", e.target.value)}
                      placeholder="آدرس مجموعه"
                    />
                  </F>
                  <F label="وب‌سایت">
                    <input
                      className={inp}
                      value={form.website}
                      onChange={(e) => set("website", e.target.value)}
                      placeholder="https://example.com"
                    />
                  </F>
                  <div className="space-y-3 border-t border-slate-700/50 pt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">
                        شبکه‌های اجتماعی
                      </h4>
                      <p className="mt-1 text-xs text-slate-400">
                        نام، نشانی و لوگوی دلخواهتان را اضافه کنید؛ این موارد در
                        نسخهٔ چاپی فاکتور نیز نمایش داده می‌شوند.
                      </p>
                    </div>
                    {socialLinks.length > 0 && (
                      <div className="space-y-2">
                        {socialLinks.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-700/15 p-3"
                          >
                            {item.logo_url ? (
                              <img
                                src={item.logo_url}
                                alt={`لوگوی ${item.name}`}
                                className="h-9 w-9 shrink-0 rounded-lg border border-slate-600/50 bg-white object-contain p-1"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-lg">
                                🌐
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-200">
                                {item.name}
                              </p>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                dir="ltr"
                                className="block truncate text-left text-xs text-blue-400 hover:underline"
                              >
                                {item.url}
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSocialEdit(item)}
                              className="rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10"
                            >
                              ویرایش
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSocialDelete(item.id)}
                              className="rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
                            >
                              حذف
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <form
                      onSubmit={handleSocialSubmit}
                      className="grid gap-3 rounded-xl border border-dashed border-slate-600/60 p-3 sm:grid-cols-2"
                    >
                      <F
                        label={
                          socialForm.id
                            ? "ویرایش نام شبکه"
                            : "نام شبکهٔ اجتماعی"
                        }
                      >
                        <input
                          className={inp}
                          maxLength={80}
                          required
                          value={socialForm.name}
                          onChange={(event) =>
                            setSocialForm((previous) => ({
                              ...previous,
                              name: event.target.value,
                            }))
                          }
                          placeholder="مثلاً لینکدین یا وبلاگ"
                        />
                      </F>
                      <F label="نشانی کامل">
                        <input
                          className={`${inp} text-left`}
                          dir="ltr"
                          type="url"
                          maxLength={500}
                          required
                          value={socialForm.url}
                          onChange={(event) =>
                            setSocialForm((previous) => ({
                              ...previous,
                              url: event.target.value,
                            }))
                          }
                          placeholder="https://example.com/your-page"
                        />
                      </F>
                      <F label="لوگو (تصویر اختیاری)">
                        <input
                          ref={socialLogoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            setSocialForm((previous) => ({
                              ...previous,
                              logo: event.target.files?.[0] || null,
                            }))
                          }
                          className="block w-full text-xs text-slate-400 file:ml-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-200"
                        />
                        <span className="text-[11px] text-slate-500">
                          در ویرایش، خالی گذاشتن این مورد لوگوی فعلی را نگه
                          می‌دارد.
                        </span>
                      </F>
                      <div className="flex items-end gap-2">
                        <button
                          type="submit"
                          disabled={
                            socialSaving ||
                            !socialForm.name.trim() ||
                            !socialForm.url.trim()
                          }
                          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {socialSaving
                            ? "در حال ذخیره…"
                            : socialForm.id
                              ? "ذخیره تغییرات"
                              : "افزودن شبکه"}
                        </button>
                        {socialForm.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setSocialForm({
                                id: null,
                                name: "",
                                url: "",
                                logo: null,
                              });
                              if (socialLogoInputRef.current)
                                socialLogoInputRef.current.value = "";
                            }}
                            className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50"
                          >
                            انصراف
                          </button>
                        )}
                      </div>
                      {socialError && (
                        <p
                          role="alert"
                          className="text-xs text-rose-400 sm:col-span-2"
                        >
                          {socialError}
                        </p>
                      )}
                    </form>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {activeTab === "invoice" && isManager && (
            <Section title="تنظیمات فاکتور" icon="🧾">
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-200">
                  نمایش فیلدهای خلاصه مالی
                </p>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={invoiceCfg.show_discount_field}
                    onChange={(e) =>
                      setInvoiceCfg((prev) => ({
                        ...prev,
                        show_discount_field: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-500"
                  />{" "}
                  نمایش فیلد تخفیف
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={invoiceCfg.show_tax_field}
                    onChange={(e) =>
                      setInvoiceCfg((prev) => ({
                        ...prev,
                        show_tax_field: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-500"
                  />{" "}
                  نمایش فیلد مالیات
                </label>
                <p className="border-t border-slate-700/50 pt-3 text-sm font-medium text-slate-200">
                  بخش مهر و امضا در فاکتور
                </p>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={invoiceCfg.show_seller_signature}
                    onChange={(e) =>
                      setInvoiceCfg((prev) => ({
                        ...prev,
                        show_seller_signature: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-500"
                  />{" "}
                  نمایش مهر و امضای فروشنده
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={invoiceCfg.show_buyer_signature}
                    onChange={(e) =>
                      setInvoiceCfg((prev) => ({
                        ...prev,
                        show_buyer_signature: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-500"
                  />{" "}
                  نمایش امضای خریدار
                </label>
                <p className="border-t border-slate-700/50 pt-3 text-sm font-medium text-slate-200">
                  قابلیت‌های صدور فاکتور
                </p>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={invoiceCfg.enable_invoice_clone !== false}
                    onChange={(e) =>
                      setInvoiceCfg((prev) => ({
                        ...prev,
                        enable_invoice_clone: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-500"
                  />{" "}
                  فعال بودن «صدور مشابه» فاکتور
                </label>
                <p className="text-[11px] text-slate-500 -mt-1">
                  با خاموش کردن، دکمهٔ صدور مشابه از صفحهٔ فاکتور و لیست
                  فاکتورها حذف می‌شود و بارگذاری فاکتور مشابه انجام نمی‌شود.
                </p>
                <F label="حداقل مبلغ فاکتور برای محاسبهٔ واریزی (تومان)">
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    className={inp}
                    value={invoiceCfg.office_card_fee_threshold}
                    onChange={(event) =>
                      setInvoiceCfg((prev) => ({
                        ...prev,
                        office_card_fee_threshold: event.target.value,
                      }))
                    }
                  />
                </F>
                <p className="text-xs text-slate-400">
                  اگر کارت پرداخت «کارت دفتر» باشد و جمع خدمات از این مبلغ بیشتر
                  شود، ردیف واریزی با نرخ ۱۰٬۰۰۰ تومان به‌ازای هر یک‌میلیون
                  تومان (۱٪) خودکار ثبت می‌شود. صفر یعنی غیرفعال.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveInvoiceConfig}
                    disabled={invoiceCfgSaving}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
                  >
                    {invoiceCfgSaving
                      ? "در حال ذخیره..."
                      : "ذخیره تنظیمات فاکتور"}
                  </button>
                  {invoiceCfgMsg && (
                    <span role="status" className="text-xs text-slate-300">
                      {invoiceCfgMsg}
                    </span>
                  )}
                </div>
              </div>
            </Section>
          )}

          {activeTab === "packages" && <ServicePackagesSection />}

          {activeTab === "shortcuts" && <ShortcutsSection />}

          {activeTab === "welcome" && isManager && (
            <Section title="پیام خوش‌آمدگویی روزانه" icon="🎉">
              <div className="space-y-5">
                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-700/20 p-4">
                  <span>
                    <span className="block text-sm font-medium text-slate-100">
                      نمایش پیام در اولین ورود روزانه
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      پس از نمایش، پیام تا روز بعد دوباره به همان کاربر نشان
                      داده نمی‌شود.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={welcomeCfg.enabled}
                    onChange={(event) =>
                      setWelcomeCfg((previous) => ({
                        ...previous,
                        enabled: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-blue-600"
                  />
                </label>
                <F label="پیام عمومی برای همهٔ کاربران">
                  <textarea
                    className={inp}
                    rows={3}
                    maxLength={5000}
                    value={welcomeCfg.global_message}
                    onChange={(event) =>
                      setWelcomeCfg((previous) => ({
                        ...previous,
                        global_message: event.target.value,
                      }))
                    }
                    placeholder="مثلاً: روز خوبی داشته باشید و پرانرژی شروع کنید!"
                  />
                </F>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveWelcomeConfig}
                    disabled={welcomeSaving}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {welcomeSaving ? "در حال ذخیره…" : "ذخیره پیام عمومی"}
                  </button>
                  <span role="status" className="text-xs text-slate-500">
                    پیام شخصی کاربر، در صورت ثبت، جایگزین پیام عمومی او می‌شود.
                  </span>
                </div>

                <div className="border-t border-slate-700/50 pt-5">
                  <h4 className="mb-3 text-sm font-semibold text-slate-100">
                    پیام شخصی برای یک کاربر
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_2fr_auto] sm:items-end">
                    <F label="کاربر">
                      <select
                        className={inp}
                        value={personalUserId}
                        onChange={(event) =>
                          setPersonalUserId(event.target.value)
                        }
                      >
                        <option value="">انتخاب کاربر…</option>
                        {welcomeUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </F>
                    <F label="متن پیام شخصی">
                      <textarea
                        className={inp}
                        rows={2}
                        maxLength={5000}
                        value={personalMessage}
                        onChange={(event) =>
                          setPersonalMessage(event.target.value)
                        }
                        placeholder="پیام مخصوص این کاربر"
                      />
                    </F>
                    <button
                      type="button"
                      onClick={handleSavePersonalGreeting}
                      disabled={
                        personalSaving ||
                        !personalUserId ||
                        !personalMessage.trim()
                      }
                      className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {personalSaving ? "در حال ذخیره…" : "ذخیره پیام شخصی"}
                    </button>
                  </div>
                  {personalGreetings.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {personalGreetings.map((item) => (
                        <li
                          key={item.user_id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-700/15 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200">
                              {item.name}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">
                              {item.message}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemovePersonalGreeting(item.user_id)
                            }
                            className="shrink-0 rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10"
                          >
                            حذف
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {welcomeMsg && (
                  <p role="status" className="text-sm text-emerald-600">
                    {welcomeMsg}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Invoice Footer */}
          {activeTab === "invoice" && (
            <Section title="متن پاورقی فاکتور" icon="📄">
              <F label="این متن در پایین فاکتورهای چاپی نمایش داده می‌شود">
                <textarea
                  className={inp}
                  rows={3}
                  value={form.footer_text}
                  onChange={(e) => set("footer_text", e.target.value)}
                  placeholder="مثال: از اعتماد شما سپاسگزاریم. برای پیگیری سفارش با شماره زیر تماس بگیرید."
                />
              </F>
            </Section>
          )}

          {/* Customer Documents Path */}
          {activeTab === "storage" && isSuperuser && (
            <Section title="مسیر ذخیره مدارک مشتریان" icon="📁">
              <div className="space-y-3">
                <F label="مسیر پوشه اصلی مدارک (روی سرور)">
                  <div className="flex gap-2">
                    <input
                      className={`${inp} min-w-0 flex-1`}
                      value={form.customer_documents_path}
                      readOnly
                      placeholder="پوشه‌ای از سیستم سرور انتخاب کنید"
                      dir="ltr"
                    />
                    {isSuperuser && (
                      <button
                        type="button"
                        onClick={() => openServerFolderPicker("documents")}
                        className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm text-blue-200 hover:bg-blue-600/30"
                      >
                        انتخاب پوشه
                      </button>
                    )}
                  </div>
                  {!isSuperuser && (
                    <p className="text-slate-600 text-xs">
                      برای تغییر این مسیر، از حساب مدیر ارشد وارد شوید.
                    </p>
                  )}
                </F>
                <p className="text-slate-500 text-xs leading-relaxed">
                  📌 برای هر مشتری یک پوشه با فرمت{" "}
                  <span className="font-mono text-slate-400 bg-slate-700/50 px-1 rounded">
                    [ID]_[نام]
                  </span>{" "}
                  ایجاد می‌شود. اگر این مسیر تنظیم شود، فایل‌های آپلود شده
                  به‌صورت خودکار در این پوشه‌ها کپی می‌شوند.
                </p>
              </div>
            </Section>
          )}

          {/* ── Backup Section ── */}
          {activeTab === "backup" && isSuperuser && (
            <Section title="پشتیبان‌گیری (بکاپ)" icon="💾">
              <div className="space-y-5">
                {/* Last backup info */}
                {backupCfg.last_backup_at && (
                  <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <span className="text-emerald-400 text-lg">✅</span>
                    <div>
                      <p className="text-emerald-400 text-sm font-medium">
                        آخرین بکاپ موفق
                      </p>
                      <p className="text-slate-400 text-xs">
                        {persianDate(backupCfg.last_backup_at)}
                      </p>
                      {backupCfg.last_backup_path && (
                        <p className="text-slate-500 text-[10px] font-mono mt-0.5 break-all">
                          {backupCfg.last_backup_path}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Backup path */}
                <F label="📂 مسیر بکاپ روی رایانهٔ سرور">
                  <div className="flex gap-2">
                    <input
                      className={`${inp} min-w-0 flex-1`}
                      value={backupCfg.backup_path}
                      readOnly
                      placeholder="پوشه‌ای از سیستم سرور انتخاب کنید"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => openServerFolderPicker("backup")}
                      className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm text-blue-200 hover:bg-blue-600/30"
                    >
                      انتخاب پوشه
                    </button>
                  </div>
                  <p className="text-slate-600 text-xs mt-1">
                    این پوشه باید از قبل روی رایانه‌ای که برنامهٔ سرور روی آن
                    اجرا می‌شود وجود داشته باشد و سرور اجازهٔ نوشتن در آن را
                    داشته باشد. برای ذخیره روی رایانهٔ خودتان از دکمهٔ «انتخاب
                    محل و ذخیره فایل» استفاده کنید.
                  </p>
                </F>

                {folderPickerOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="انتخاب پوشهٔ سرور"
                  >
                    <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                        <h3 className="font-semibold text-white">
                          انتخاب پوشهٔ{" "}
                          {folderPickerTarget === "documents"
                            ? "مدارک مشتریان"
                            : "بکاپ"}{" "}
                          از سیستم سرور
                        </h3>
                        <button
                          type="button"
                          onClick={() => setFolderPickerOpen(false)}
                          className="text-slate-400 hover:text-white"
                          aria-label="بستن"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-3 p-5">
                        <p
                          className="break-all rounded-lg bg-slate-800 px-3 py-2 text-left font-mono text-xs text-slate-300"
                          dir="ltr"
                        >
                          {folderPickerData?.path || "درایوها"}
                        </p>
                        {folderPickerData?.roots?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {folderPickerData.roots.map((root) => (
                              <button
                                type="button"
                                key={root}
                                onClick={() => loadServerFolders(root)}
                                className="rounded-lg bg-slate-700 px-3 py-1.5 font-mono text-xs text-slate-200 hover:bg-slate-600"
                                dir="ltr"
                              >
                                {root}
                              </button>
                            ))}
                          </div>
                        )}
                        {folderPickerData?.parent && (
                          <button
                            type="button"
                            onClick={() =>
                              loadServerFolders(folderPickerData.parent)
                            }
                            className="w-full rounded-lg border border-slate-700 px-3 py-2 text-right text-sm text-blue-300 hover:bg-slate-800"
                          >
                            ⬆️ پوشهٔ بالاتر
                          </button>
                        )}
                        {folderPickerError && (
                          <p className="text-sm text-red-400">
                            {folderPickerError}
                          </p>
                        )}
                        <div className="max-h-64 space-y-1 overflow-y-auto">
                          {folderPickerLoading ? (
                            <p className="py-6 text-center text-sm text-slate-400">
                              در حال خواندن پوشه‌ها…
                            </p>
                          ) : folderPickerData?.folders?.length ? (
                            folderPickerData.folders.map((folder) => (
                              <button
                                type="button"
                                key={folder.path}
                                onClick={() => loadServerFolders(folder.path)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-slate-200 hover:bg-slate-800"
                              >
                                <span>📁</span>
                                <span className="truncate">{folder.name}</span>
                              </button>
                            ))
                          ) : (
                            <p className="py-6 text-center text-sm text-slate-500">
                              پوشه‌ای در این مسیر وجود ندارد.
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-slate-700 pt-3">
                          <button
                            type="button"
                            onClick={() => setFolderPickerOpen(false)}
                            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                          >
                            لغو
                          </button>
                          <button
                            type="button"
                            disabled={
                              !folderPickerData?.path || folderPickerLoading
                            }
                            onClick={() => {
                              if (folderPickerTarget === "documents")
                                set(
                                  "customer_documents_path",
                                  folderPickerData.path,
                                );
                              else
                                setBcfg("backup_path", folderPickerData.path);
                              setFolderPickerOpen(false);
                            }}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                          >
                            انتخاب این پوشه
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto backup toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-700/20 rounded-xl border border-slate-700/30">
                  <div>
                    <p className="text-white text-sm font-medium">
                      ⏰ بکاپ خودکار
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      بکاپ در ساعت مشخص هر روز به‌صورت خودکار اجرا می‌شود
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setBcfg("auto_backup", !backupCfg.auto_backup)
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${backupCfg.auto_backup ? "bg-blue-600" : "bg-slate-600"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${backupCfg.auto_backup ? "left-7" : "left-1"}`}
                    />
                  </button>
                </div>

                {/* Auto backup settings */}
                {backupCfg.auto_backup && (
                  <div className="grid grid-cols-2 gap-3">
                    <F label="فرکانس بکاپ">
                      <select
                        className={inp}
                        value={backupCfg.backup_frequency}
                        onChange={(e) =>
                          setBcfg("backup_frequency", e.target.value)
                        }
                      >
                        <option value="daily">روزانه</option>
                        <option value="weekly">هفتگی</option>
                      </select>
                    </F>
                    <F label="ساعت اجرا">
                      <select
                        className={inp}
                        value={backupCfg.backup_hour}
                        onChange={(e) => setBcfg("backup_hour", e.target.value)}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {String(i).padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                    </F>
                  </div>
                )}

                {backupMsg && (
                  <div
                    className={`text-sm px-4 py-3 rounded-xl border ${backupMsg.startsWith("✅") ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}
                  >
                    {backupMsg}
                  </div>
                )}

                {/* Optional backup encryption */}
                <F label="🔐 گذرواژهٔ رمزنگاری بکاپ (اختیاری)">
                  <PasswordInput
                    className={inp}
                    value={backupPassphrase}
                    onChange={(e) => setBackupPassphrase(e.target.value)}
                    placeholder="خالی = بکاپ بدون رمزنگاری؛ دست‌کم ۸ نویسه"
                    autoComplete="new-password"
                    dir="ltr"
                  />
                  <p className="text-slate-600 text-xs mt-1">
                    اگر گذرواژه بگذارید، فایل بکاپ با AES-256 رمزنگاری می‌شود و
                    هنگام بازیابی همین گذرواژه لازم است. گذرواژه هیچ‌جا ذخیره
                    نمی‌شود؛ اگر فراموش شود، بکاپ قابل بازیابی نیست.
                  </p>
                </F>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSaveBackupConfig}
                    disabled={backupSaving}
                    className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600 transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {backupSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "⚙️"
                    )}
                    ذخیره تنظیمات بکاپ
                  </button>

                  {backupCfg.backup_path && (
                    <button
                      onClick={() => handleRunBackup(true)}
                      disabled={backupRunning}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-700 text-white text-sm border border-indigo-500/50 transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                      {backupRunning ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        "💾"
                      )}
                      ذخیره بکاپ روی سرور
                    </button>
                  )}

                  <button
                    onClick={() => handleRunBackup(false)}
                    disabled={backupRunning}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-700 text-white text-sm border border-emerald-500/50 transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {backupRunning ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "⬇️"
                    )}
                    انتخاب محل و ذخیره فایل
                  </button>
                </div>

                {isSuperuser && (
                  <div className="space-y-4 border-t border-slate-700/30 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">
                          ☁️ بکاپ ابری (S3)
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          پس از هر بکاپ محلی، یک نسخهٔ رمزنگاری‌شده هم به باکت
                          ابری فرستاده می‌شود؛ بکاپ محلی حتی اگر آپلود ابری
                          ناموفق باشد سر جایش می‌ماند
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setBcfg("cloud_enabled", !backupCfg.cloud_enabled)
                        }
                        className={`relative w-12 h-6 rounded-full transition-colors ${backupCfg.cloud_enabled ? "bg-blue-600" : "bg-slate-600"}`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${backupCfg.cloud_enabled ? "left-7" : "left-1"}`}
                        />
                      </button>
                    </div>

                    {backupCfg.cloud_enabled && (
                      <div className="space-y-3">
                        <F label="نقطهٔ پایانی S3">
                          <input
                            className={inp}
                            value={backupCfg.cloud_endpoint}
                            onChange={(e) =>
                              setBcfg("cloud_endpoint", e.target.value)
                            }
                            placeholder="https://s3.ir-thr-at1.arvanstorage.ir"
                            dir="ltr"
                          />
                        </F>
                        <div className="grid grid-cols-2 gap-3">
                          <F label="نام باکت">
                            <input
                              className={inp}
                              value={backupCfg.cloud_bucket}
                              onChange={(e) =>
                                setBcfg("cloud_bucket", e.target.value)
                              }
                              placeholder="mohaseb-backups"
                              dir="ltr"
                            />
                          </F>
                          <F label="کلید دسترسی">
                            <input
                              className={inp}
                              value={backupCfg.cloud_access_key}
                              onChange={(e) =>
                                setBcfg("cloud_access_key", e.target.value)
                              }
                              dir="ltr"
                            />
                          </F>
                        </div>
                        <F label="کلید محرمانه (فقط برای تغییر وارد کنید)">
                          <PasswordInput
                            className={inp}
                            value={cloudSecret}
                            onChange={(e) => setCloudSecret(e.target.value)}
                            placeholder="بدون تغییر"
                            autoComplete="new-password"
                            dir="ltr"
                          />
                        </F>
                        <F label="🔐 گذرواژهٔ رمزنگاری کپی ابری">
                          <PasswordInput
                            className={inp}
                            value={cloudPassphrase}
                            onChange={(e) => setCloudPassphrase(e.target.value)}
                            placeholder="فقط برای تغییر وارد کنید؛ دست‌کم ۸ نویسه"
                            autoComplete="new-password"
                            dir="ltr"
                          />
                          <p className="text-slate-600 text-xs mt-1">
                            کپی ابری همیشه رمزنگاری‌شده آپلود می‌شود: اگر فایل
                            محلی رمز داشته باشد همان فایل بالا می‌رود، وگرنه با
                            این گذرواژه رمز می‌شود. این گذرواژه برای بازیابی از
                            ابر لازم است؛ اگر فراموش شود، نسخه‌های ابری قابل
                            بازیابی نیستند.
                          </p>
                        </F>
                        <F label="نگهداری نسخه‌های ابری (تعداد)">
                          <input
                            type="number"
                            min={1}
                            className={inp}
                            value={backupCfg.cloud_retention}
                            onChange={(e) =>
                              setBcfg("cloud_retention", e.target.value)
                            }
                            dir="ltr"
                          />
                        </F>

                        {(backupCfg.last_cloud_backup_at ||
                          backupCfg.last_cloud_error) && (
                          <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-3 text-xs text-slate-400">
                            {backupCfg.last_cloud_backup_at && (
                              <p>
                                آخرین آپلود ابری:{" "}
                                {persianDate(backupCfg.last_cloud_backup_at)}
                                {backupCfg.last_cloud_backup_key
                                  ? ` — ${backupCfg.last_cloud_backup_key}`
                                  : ""}
                              </p>
                            )}
                            {backupCfg.last_cloud_error && (
                              <p className="text-red-400 mt-1">
                                آخرین خطای ابری: {backupCfg.last_cloud_error}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={handleTestCloud}
                            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600"
                          >
                            بررسی اتصال ابری
                          </button>
                          <button
                            type="button"
                            onClick={handleListCloud}
                            className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600"
                          >
                            فهرست نسخه‌های ابری
                          </button>
                          {backupCfg.last_backup_path && (
                            <button
                              type="button"
                              onClick={handleUploadLatest}
                              className="px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-700 text-white text-sm border border-indigo-500/50"
                            >
                              آپلود آخرین بکاپ
                            </button>
                          )}
                        </div>

                        {cloudMsg && (
                          <div className="text-sm px-4 py-3 rounded-xl border border-slate-700/50 bg-slate-900/30 text-slate-300">
                            {cloudMsg}
                          </div>
                        )}

                        {cloudBackups.length > 0 && (
                          <div className="space-y-2">
                            {cloudBackups.map((item) => (
                              <div
                                key={item.key}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/30 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p
                                    className="truncate font-mono text-xs text-slate-200"
                                    dir="ltr"
                                  >
                                    {item.key}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    {persianDate(item.last_modified)} —{" "}
                                    {new Intl.NumberFormat("fa-IR").format(
                                      item.size,
                                    )}{" "}
                                    بایت
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCloudRestoreKey(item.key);
                                    setCloudRestoreCounts(null);
                                    setCloudRestorePhrase("");
                                  }}
                                  className="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
                                >
                                  بازیابی
                                </button>
                              </div>
                            ))}
                            {cloudRestoreKey && (
                              <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                                <p
                                  className="font-mono text-xs text-slate-300"
                                  dir="ltr"
                                >
                                  {cloudRestoreKey}
                                </p>
                                <PasswordInput
                                  className={inp}
                                  value={cloudRestorePassphrase}
                                  onChange={(e) =>
                                    setCloudRestorePassphrase(e.target.value)
                                  }
                                  placeholder="گذرواژهٔ بکاپ ابری"
                                  autoComplete="off"
                                  dir="ltr"
                                />
                                {!cloudRestoreCounts ? (
                                  <button
                                    type="button"
                                    onClick={handleCloudRestoreValidate}
                                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
                                  >
                                    بررسی فایل ابری
                                  </button>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-xs text-slate-400">
                                      فایل سالم است:{" "}
                                      {new Intl.NumberFormat("fa-IR").format(
                                        Object.values(
                                          cloudRestoreCounts,
                                        ).reduce(
                                          (sum, count) => sum + count,
                                          0,
                                        ),
                                      )}{" "}
                                      رکورد برای بازیابی.
                                    </p>
                                    <div className="flex gap-2">
                                      <input
                                        value={cloudRestorePhrase}
                                        onChange={(e) =>
                                          setCloudRestorePhrase(e.target.value)
                                        }
                                        placeholder="برای فعال‌شدن دکمه بنویسید: تایید"
                                        className={`${inp} flex-1`}
                                      />
                                      <button
                                        type="button"
                                        disabled={
                                          cloudRestorePhrase !== "تایید"
                                        }
                                        onClick={handleCloudRestoreConfirm}
                                        className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                                      >
                                        تایید بازیابی
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <p className="text-slate-600 text-xs border-t border-slate-700/30 pt-3">
                  💡 بکاپ شامل کاربران و هش رمزهایشان نیز هست؛ فایل را محرمانه
                  نگه دارید. امضای SHA-256 خرابی یا تغییر فایل را پیش از بازیابی
                  شناسایی می‌کند. برای بکاپ زمان‌بندی‌شده، برنامه باید باز و
                  مدیر ارشد وارد شده باشد.
                </p>

                {isSuperuser && (
                  <div className="space-y-3 border-t border-slate-700/30 pt-4">
                    <h4 className="font-medium text-white">
                      بازیابی از نسخهٔ پشتیبان
                    </h4>
                    <p className="text-xs leading-relaxed text-amber-600">
                      بازیابی اطلاعات فعلی را با اطلاعات نسخهٔ پشتیبان جایگزین
                      می‌کند. فایل ابتدا از نظر ساختار و صحت بررسی می‌شود؛
                      فایل‌های فیزیکی مدارک مشتریان باید در مسیر ذخیره‌سازی
                      موجود باشند.
                    </p>
                    <PasswordInput
                      className={inp}
                      value={restorePassphrase}
                      onChange={(e) => setRestorePassphrase(e.target.value)}
                      placeholder="گذرواژهٔ بکاپ (فقط اگر فایل رمزنگاری شده است)"
                      autoComplete="off"
                      dir="ltr"
                    />
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) =>
                        handleSelectRestoreFile(e.target.files?.[0])
                      }
                      className="block w-full text-sm text-slate-400 file:ml-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-200"
                    />
                    {restoreCounts && (
                      <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-3 text-xs text-slate-400">
                        فایل سالم است:{" "}
                        {new Intl.NumberFormat("fa-IR").format(
                          Object.values(restoreCounts).reduce(
                            (sum, count) => sum + count,
                            0,
                          ),
                        )}{" "}
                        رکورد برای بازیابی.
                      </div>
                    )}
                    {restoreBackup && (
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <input
                          value={restorePhrase}
                          onChange={(e) => setRestorePhrase(e.target.value)}
                          placeholder="برای فعال‌شدن دکمه بنویسید: تایید"
                          className={inp}
                        />
                        <button
                          type="button"
                          onClick={handleRestore}
                          disabled={restoreBusy || !isRestoreConfirmed}
                          className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {restoreBusy ? "در حال بازیابی..." : "بازیابی کردن"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
