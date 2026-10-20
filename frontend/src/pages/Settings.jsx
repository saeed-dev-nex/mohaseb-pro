import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { profileAPI, socialNetworksAPI, backupConfigAPI, backupAPI, invoiceSettingsAPI, welcomeAPI } from '../services/api';

const inp = 'w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';
const RESTORE_CONFIRMATION_PHRASE = 'تایید';

const Section = ({ title, icon, children }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
    <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-700/50 bg-slate-700/20">
      <span className="text-lg">{icon}</span>
      <h3 className="text-white font-semibold text-sm">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const F = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-slate-400">{label}</label>
    {children}
  </div>
);

const Settings = () => {
  const isSuperuser = useSelector((state) => state.auth.currentUser?.is_superuser);
  const isManager = useSelector((state) => !!(state.auth.currentUser?.is_staff || state.auth.currentUser?.is_superuser));
  const [form, setForm] = useState({
    name: '', subtitle: '', phone: '', mobile: '', address: '',
    website: '', footer_text: '', tax_id: '',
    customer_documents_path: '',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Backup config state
  const [backupCfg, setBackupCfg] = useState({
    backup_path: '',
    auto_backup: false,
    backup_frequency: 'daily',
    backup_hour: 13,
    last_backup_at: null,
    last_backup_path: '',
  });
  const [backupSaving, setBackupSaving] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [invoiceCfg, setInvoiceCfg] = useState({ office_card_fee_threshold: 0, show_discount_field: true, show_tax_field: true, show_seller_signature: true, show_buyer_signature: true });
  const [invoiceCfgSaving, setInvoiceCfgSaving] = useState(false);
  const [invoiceCfgMsg, setInvoiceCfgMsg] = useState('');
  const [welcomeCfg, setWelcomeCfg] = useState({ enabled: false, global_message: '' });
  const [welcomeUsers, setWelcomeUsers] = useState([]);
  const [personalGreetings, setPersonalGreetings] = useState([]);
  const [personalUserId, setPersonalUserId] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [personalSaving, setPersonalSaving] = useState(false);
  const [socialLinks, setSocialLinks] = useState([]);
  const [socialForm, setSocialForm] = useState({ id: null, name: '', url: '', logo: null });
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialError, setSocialError] = useState('');
  const socialLogoInputRef = useRef(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderPickerTarget, setFolderPickerTarget] = useState('backup');
  const [folderPickerData, setFolderPickerData] = useState(null);
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);
  const [folderPickerError, setFolderPickerError] = useState('');
  const [restoreBackup, setRestoreBackup] = useState(null);
  const [restoreCounts, setRestoreCounts] = useState(null);
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const isRestoreConfirmed = restorePhrase.trim() === RESTORE_CONFIRMATION_PHRASE;

  useEffect(() => {
    Promise.all([
      profileAPI.get(),
      backupConfigAPI.get().catch(() => ({ data: {} })),
      invoiceSettingsAPI.get().catch(() => ({ data: {} })),
      isManager ? welcomeAPI.getConfig().catch(() => ({ data: {} })) : Promise.resolve({ data: {} }),
      isManager ? welcomeAPI.users().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      isManager ? welcomeAPI.personal().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]).then(([pRes, bRes, iRes, wRes, wuRes, wpRes]) => {
      const profile = Array.isArray(pRes.data) ? pRes.data[0] : pRes.data;
      if (profile) {
        setForm({
          name: profile.name || '', subtitle: profile.subtitle || '',
          phone: profile.phone || '', mobile: profile.mobile || '',
          address: profile.address || '', website: profile.website || '',
          footer_text: profile.footer_text || '', tax_id: profile.tax_id || '',
          customer_documents_path: profile.customer_documents_path || '',
        });
        setSocialLinks(profile.social_links || []);
        if (profile.logo_url) setLogoPreview(profile.logo_url);
      }
      if (bRes.data && Object.keys(bRes.data).length) {
        setBackupCfg((prev) => ({ ...prev, ...bRes.data }));
      }
      if (iRes.data && Object.keys(iRes.data).length) setInvoiceCfg((prev) => ({ ...prev, ...iRes.data }));
      setWelcomeCfg((prev) => ({ ...prev, ...wRes.data }));
      setWelcomeUsers(wuRes.data || []);
      setPersonalGreetings(wpRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isManager]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setBcfg = (k, v) => setBackupCfg((f) => ({ ...f, [k]: v }));

  const loadServerFolders = async (path = '') => {
    setFolderPickerLoading(true);
    setFolderPickerError('');
    try {
      const { data } = await backupConfigAPI.browseFolders(path);
      setFolderPickerData(data);
    } catch (error) {
      setFolderPickerError(error.response?.data?.detail || 'امکان دریافت پوشه‌های سرور وجود ندارد.');
    } finally {
      setFolderPickerLoading(false);
    }
  };

  const openServerFolderPicker = (target) => {
    setFolderPickerTarget(target);
    setFolderPickerOpen(true);
    loadServerFolders('');
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
  };

  const handleSocialSubmit = async (event) => {
    event.preventDefault();
    if (!socialForm.name.trim() || !socialForm.url.trim()) return;
    setSocialSaving(true);
    setSocialError('');
    const body = new FormData();
    body.append('name', socialForm.name.trim());
    body.append('url', socialForm.url.trim());
    if (socialForm.logo) body.append('logo', socialForm.logo);
    try {
      const { data } = socialForm.id
        ? await socialNetworksAPI.update(socialForm.id, body)
        : await socialNetworksAPI.create(body);
      setSocialLinks((previous) => socialForm.id
        ? previous.map((item) => item.id === data.id ? data : item)
        : [...previous, data]);
      setSocialForm({ id: null, name: '', url: '', logo: null });
      if (socialLogoInputRef.current) socialLogoInputRef.current.value = '';
    } catch (error) {
      setSocialError(error.response?.data?.url?.[0] || error.response?.data?.name?.[0] || error.response?.data?.logo?.[0] || 'ذخیره شبکهٔ اجتماعی انجام نشد.');
    } finally {
      setSocialSaving(false);
    }
  };

  const handleSocialEdit = (item) => {
    setSocialForm({ id: item.id, name: item.name, url: item.url, logo: null });
    if (socialLogoInputRef.current) socialLogoInputRef.current.value = '';
  };
  const handleSocialDelete = async (id) => {
    try {
      await socialNetworksAPI.delete(id);
      setSocialLinks((previous) => previous.filter((item) => item.id !== id));
      if (socialForm.id === id) {
        setSocialForm({ id: null, name: '', url: '', logo: null });
        if (socialLogoInputRef.current) socialLogoInputRef.current.value = '';
      }
    } catch {
      setSocialError('حذف شبکهٔ اجتماعی انجام نشد.');
    }
  };

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (logoFile) fd.append('logo', logoFile);
    try {
      await profileAPI.update(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('خطا در ذخیره: ' + JSON.stringify(e.response?.data || e.message));
    } finally { setSaving(false); }
  };

  const handleSaveBackupConfig = async () => {
    setBackupSaving(true);
    try {
      const { data } = await backupConfigAPI.update({
        backup_path: backupCfg.backup_path,
        auto_backup: backupCfg.auto_backup,
        backup_frequency: backupCfg.backup_frequency,
        backup_hour: Number(backupCfg.backup_hour),
      });
      setBackupCfg((prev) => ({ ...prev, ...data }));
      setBackupMsg('✅ تنظیمات بکاپ ذخیره شد');
      setTimeout(() => setBackupMsg(''), 3000);
    } catch (e) {
      setBackupMsg('❌ خطا در ذخیره تنظیمات بکاپ');
      setTimeout(() => setBackupMsg(''), 4000);
    } finally { setBackupSaving(false); }
  };

  const handleSaveInvoiceConfig = async () => {
    setInvoiceCfgSaving(true);
    try {
      const { data } = await invoiceSettingsAPI.update({
        office_card_fee_threshold: Number(invoiceCfg.office_card_fee_threshold) || 0,
        show_discount_field: Boolean(invoiceCfg.show_discount_field),
        show_tax_field: Boolean(invoiceCfg.show_tax_field),
        show_seller_signature: Boolean(invoiceCfg.show_seller_signature),
        show_buyer_signature: Boolean(invoiceCfg.show_buyer_signature),
      });
      setInvoiceCfg((prev) => ({ ...prev, ...data }));
      setInvoiceCfgMsg('✅ تنظیمات واریزی ذخیره شد');
    } catch (error) {
      setInvoiceCfgMsg(error.response?.data?.detail || '❌ ذخیره تنظیمات واریزی انجام نشد');
    } finally {
      setInvoiceCfgSaving(false);
      setTimeout(() => setInvoiceCfgMsg(''), 4000);
    }
  };

  const handleSaveWelcomeConfig = async () => {
    setWelcomeSaving(true);
    try {
      const { data } = await welcomeAPI.updateConfig(welcomeCfg);
      setWelcomeCfg(data);
      setWelcomeMsg('تنظیمات پیام خوش‌آمدگویی ذخیره شد.');
    } catch (error) {
      setWelcomeMsg(error.response?.data?.detail || 'ذخیره تنظیمات انجام نشد.');
    } finally {
      setWelcomeSaving(false);
      window.setTimeout(() => setWelcomeMsg(''), 4000);
    }
  };

  const handleSavePersonalGreeting = async () => {
    if (!personalUserId || !personalMessage.trim()) return;
    setPersonalSaving(true);
    try {
      await welcomeAPI.savePersonal({ user_id: Number(personalUserId), message: personalMessage.trim() });
      const { data } = await welcomeAPI.personal();
      setPersonalGreetings(data);
      setPersonalMessage('');
      setWelcomeMsg('پیام شخصی ذخیره شد.');
    } catch (error) {
      setWelcomeMsg(error.response?.data?.message?.[0] || 'ذخیره پیام شخصی انجام نشد.');
    } finally {
      setPersonalSaving(false);
      window.setTimeout(() => setWelcomeMsg(''), 4000);
    }
  };

  const handleRemovePersonalGreeting = async (userId) => {
    try {
      await welcomeAPI.removePersonal(userId);
      setPersonalGreetings((previous) => previous.filter((item) => item.user_id !== userId));
    } catch {
      setWelcomeMsg('حذف پیام شخصی انجام نشد.');
    }
  };

  const handleRunBackup = async (saveToPath) => {
    setBackupRunning(true);
    setBackupMsg('');
    try {
      if (saveToPath && backupCfg.backup_path) {
        // Save to disk
        const { data } = await backupConfigAPI.runBackup({ path: backupCfg.backup_path });
        if (data.saved) {
          setBackupCfg((prev) => ({ ...prev, last_backup_path: data.path, last_backup_at: new Date().toISOString() }));
          setBackupMsg(`✅ بکاپ در مسیر ذخیره شد: ${data.path}`);
        }
      } else {
        // Let the user choose a local filename and destination when supported.
        let saveHandle = null;
        if (window.showSaveFilePicker) {
          try {
            saveHandle = await window.showSaveFilePicker({
              suggestedName: `mohaseb_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
              types: [{
                description: 'فایل پشتیبان محاسب پرو',
                accept: { 'application/json': ['.json'] },
              }],
            });
          } catch (error) {
            if (error.name === 'AbortError') {
              return;
            }
            // Fall back to the browser download when the native picker is unavailable.
          }
        }

        const response = await backupConfigAPI.runBackupDownload({});
        const blob = new Blob([response.data]);
        const cd = response.headers?.['content-disposition'] || '';
        const fnMatch = cd.match(/filename="?([^"]+)"?/);
        const filename = fnMatch ? fnMatch[1] : `mohaseb_backup_${new Date().toISOString().slice(0, 10)}.json`;
        if (saveHandle) {
          const writable = await saveHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          setBackupMsg('✅ فایل بکاپ در محل انتخاب‌شده ذخیره شد');
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          setBackupMsg('✅ دانلود بکاپ آغاز شد؛ محل ذخیره طبق تنظیمات مرورگر است');
        }
      }
      setTimeout(() => setBackupMsg(''), 5000);
    } catch (e) {
      let errorData = e.response?.data;
      if (errorData instanceof Blob) {
        try { errorData = JSON.parse(await errorData.text()); } catch { /* Keep the generic message. */ }
      }
      const detail = errorData?.detail;
      setBackupMsg(`❌ ${detail || 'خطا در اجرای بکاپ'}`);
      setTimeout(() => setBackupMsg(''), 4000);
    } finally { setBackupRunning(false); }
  };

  const handleSelectRestoreFile = async (file) => {
    if (!file) return;
    setBackupMsg('');
    setRestoreBackup(null);
    setRestoreCounts(null);
    setRestorePhrase('');
    try {
      const rawBackup = await file.text();
      const { data } = await backupAPI.restore({ backup_json: rawBackup, confirm_replace: false });
      setRestoreBackup(rawBackup);
      setRestoreCounts(data.counts);
      setBackupMsg('✅ فایل پشتیبان سالم است و برای بازیابی آماده است.');
    } catch (error) {
      setBackupMsg(`❌ ${error.response?.data?.detail || 'فایل انتخاب‌شده معتبر نیست.'}`);
    }
  };

  const handleRestore = async () => {
    if (!restoreBackup || !isRestoreConfirmed) return;
    setRestoreBusy(true);
    try {
      await backupAPI.restore({ backup_json: restoreBackup, confirm_replace: true });
      setBackupMsg('✅ بازیابی انجام شد؛ برنامه در حال بارگذاری مجدد است.');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setBackupMsg(`❌ ${error.response?.data?.detail || 'بازیابی انجام نشد.'}`);
    } finally { setRestoreBusy(false); }
  };

  const persianDate = (d) => {
    if (!d) return '---';
    try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); }
    catch { return d; }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">⚙️ تنظیمات</h2>
          <p className="text-slate-400 text-sm mt-0.5">شخصی‌سازی برند، لوگو و اطلاعات فروشگاه</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm transition-all flex items-center gap-2 disabled:opacity-60">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✅'}
          ذخیره تنظیمات
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          ✅ تنظیمات با موفقیت ذخیره شد
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branding */}
        <Section title="برند و لوگو" icon="🎨">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-700/50 border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                ) : <span className="text-3xl">💎</span>}
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1.5">لوگو (PNG/JPG)</label>
                <input type="file" accept="image/*" onChange={handleLogoChange}
                  className="block w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer file:transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="نام مجموعه"><input className={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="نام فروشگاه" /></F>
              <F label="زیرعنوان"><input className={inp} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="سیستم مدیریت مالی" /></F>
            </div>
            <F label="شناسه مالیاتی"><input className={inp} value={form.tax_id} onChange={(e) => set('tax_id', e.target.value)} placeholder="شناسه مالیاتی (اختیاری)" /></F>
          </div>
        </Section>

        {/* Contact */}
        <Section title="اطلاعات تماس" icon="📞">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="تلفن ثابت"><input className={inp} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="021-12345678" /></F>
              <F label="موبایل"><input className={inp} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="09121234567" /></F>
            </div>
            <F label="آدرس"><textarea className={inp} rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="آدرس مجموعه" /></F>
            <F label="وب‌سایت"><input className={inp} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://example.com" /></F>
            <div className="space-y-3 border-t border-slate-700/50 pt-4">
              <div><h4 className="text-sm font-semibold text-slate-200">شبکه‌های اجتماعی</h4><p className="mt-1 text-xs text-slate-400">نام، نشانی و لوگوی دلخواهتان را اضافه کنید؛ این موارد در نسخهٔ چاپی فاکتور نیز نمایش داده می‌شوند.</p></div>
              {socialLinks.length > 0 && <div className="space-y-2">
                {socialLinks.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-700/15 p-3">
                  {item.logo_url ? <img src={item.logo_url} alt={`لوگوی ${item.name}`} className="h-9 w-9 shrink-0 rounded-lg border border-slate-600/50 bg-white object-contain p-1" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-lg">🌐</span>}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{item.name}</p><a href={item.url} target="_blank" rel="noreferrer" dir="ltr" className="block truncate text-left text-xs text-blue-400 hover:underline">{item.url}</a></div>
                  <button type="button" onClick={() => handleSocialEdit(item)} className="rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10">ویرایش</button>
                  <button type="button" onClick={() => handleSocialDelete(item.id)} className="rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10">حذف</button>
                </div>)}
              </div>}
              <form onSubmit={handleSocialSubmit} className="grid gap-3 rounded-xl border border-dashed border-slate-600/60 p-3 sm:grid-cols-2">
                <F label={socialForm.id ? 'ویرایش نام شبکه' : 'نام شبکهٔ اجتماعی'}><input className={inp} maxLength={80} required value={socialForm.name} onChange={(event) => setSocialForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="مثلاً لینکدین یا وبلاگ" /></F>
                <F label="نشانی کامل"><input className={`${inp} text-left`} dir="ltr" type="url" maxLength={500} required value={socialForm.url} onChange={(event) => setSocialForm((previous) => ({ ...previous, url: event.target.value }))} placeholder="https://example.com/your-page" /></F>
                <F label="لوگو (تصویر اختیاری)"><input ref={socialLogoInputRef} type="file" accept="image/*" onChange={(event) => setSocialForm((previous) => ({ ...previous, logo: event.target.files?.[0] || null }))} className="block w-full text-xs text-slate-400 file:ml-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-200" /><span className="text-[11px] text-slate-500">در ویرایش، خالی گذاشتن این مورد لوگوی فعلی را نگه می‌دارد.</span></F>
                <div className="flex items-end gap-2">
                  <button type="submit" disabled={socialSaving || !socialForm.name.trim() || !socialForm.url.trim()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{socialSaving ? 'در حال ذخیره…' : socialForm.id ? 'ذخیره تغییرات' : 'افزودن شبکه'}</button>
                  {socialForm.id && <button type="button" onClick={() => { setSocialForm({ id: null, name: '', url: '', logo: null }); if (socialLogoInputRef.current) socialLogoInputRef.current.value = ''; }} className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50">انصراف</button>}
                </div>
                {socialError && <p role="alert" className="text-xs text-rose-400 sm:col-span-2">{socialError}</p>}
              </form>
            </div>
          </div>
        </Section>
      </div>

      {isManager && <Section title="تنظیمات فاکتور" icon="🧾">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200">نمایش فیلدهای خلاصه مالی</p>
          <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={invoiceCfg.show_discount_field} onChange={e => setInvoiceCfg(prev => ({ ...prev, show_discount_field: e.target.checked }))} className="h-4 w-4 accent-blue-500" /> نمایش فیلد تخفیف</label>
          <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={invoiceCfg.show_tax_field} onChange={e => setInvoiceCfg(prev => ({ ...prev, show_tax_field: e.target.checked }))} className="h-4 w-4 accent-blue-500" /> نمایش فیلد مالیات</label>
          <p className="border-t border-slate-700/50 pt-3 text-sm font-medium text-slate-200">بخش مهر و امضا در فاکتور</p>
          <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={invoiceCfg.show_seller_signature} onChange={e => setInvoiceCfg(prev => ({ ...prev, show_seller_signature: e.target.checked }))} className="h-4 w-4 accent-blue-500" /> نمایش مهر و امضای فروشنده</label>
          <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={invoiceCfg.show_buyer_signature} onChange={e => setInvoiceCfg(prev => ({ ...prev, show_buyer_signature: e.target.checked }))} className="h-4 w-4 accent-blue-500" /> نمایش امضای خریدار</label>
          <F label="حداقل مبلغ فاکتور برای محاسبهٔ واریزی (تومان)">
            <input type="number" min="0" step="100000" className={inp}
              value={invoiceCfg.office_card_fee_threshold}
              onChange={(event) => setInvoiceCfg((prev) => ({ ...prev, office_card_fee_threshold: event.target.value }))} />
          </F>
          <p className="text-xs text-slate-400">اگر کارت پرداخت «کارت دفتر» باشد و جمع خدمات از این مبلغ بیشتر شود، ردیف واریزی با نرخ ۱۰٬۰۰۰ تومان به‌ازای هر یک‌میلیون تومان (۱٪) خودکار ثبت می‌شود. صفر یعنی غیرفعال.</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSaveInvoiceConfig} disabled={invoiceCfgSaving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">{invoiceCfgSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات فاکتور'}</button>
            {invoiceCfgMsg && <span role="status" className="text-xs text-slate-300">{invoiceCfgMsg}</span>}
          </div>
        </div>
      </Section>}

      {isManager && <Section title="پیام خوش‌آمدگویی روزانه" icon="🎉">
        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-700/20 p-4">
            <span><span className="block text-sm font-medium text-slate-100">نمایش پیام در اولین ورود روزانه</span><span className="mt-1 block text-xs text-slate-400">پس از نمایش، پیام تا روز بعد دوباره به همان کاربر نشان داده نمی‌شود.</span></span>
            <input type="checkbox" checked={welcomeCfg.enabled} onChange={(event) => setWelcomeCfg((previous) => ({ ...previous, enabled: event.target.checked }))} className="h-5 w-5 accent-blue-600" />
          </label>
          <F label="پیام عمومی برای همهٔ کاربران">
            <textarea className={inp} rows={3} maxLength={5000} value={welcomeCfg.global_message} onChange={(event) => setWelcomeCfg((previous) => ({ ...previous, global_message: event.target.value }))} placeholder="مثلاً: روز خوبی داشته باشید و پرانرژی شروع کنید!" />
          </F>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleSaveWelcomeConfig} disabled={welcomeSaving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{welcomeSaving ? 'در حال ذخیره…' : 'ذخیره پیام عمومی'}</button>
            <span role="status" className="text-xs text-slate-500">پیام شخصی کاربر، در صورت ثبت، جایگزین پیام عمومی او می‌شود.</span>
          </div>

          <div className="border-t border-slate-700/50 pt-5">
            <h4 className="mb-3 text-sm font-semibold text-slate-100">پیام شخصی برای یک کاربر</h4>
            <div className="grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_2fr_auto] sm:items-end">
              <F label="کاربر">
                <select className={inp} value={personalUserId} onChange={(event) => setPersonalUserId(event.target.value)}>
                  <option value="">انتخاب کاربر…</option>
                  {welcomeUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </F>
              <F label="متن پیام شخصی"><textarea className={inp} rows={2} maxLength={5000} value={personalMessage} onChange={(event) => setPersonalMessage(event.target.value)} placeholder="پیام مخصوص این کاربر" /></F>
              <button type="button" onClick={handleSavePersonalGreeting} disabled={personalSaving || !personalUserId || !personalMessage.trim()} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{personalSaving ? 'در حال ذخیره…' : 'ذخیره پیام شخصی'}</button>
            </div>
            {personalGreetings.length > 0 && <ul className="mt-4 space-y-2">
              {personalGreetings.map((item) => <li key={item.user_id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-700/15 px-3 py-2.5">
                <div className="min-w-0"><p className="text-sm font-medium text-slate-200">{item.name}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">{item.message}</p></div>
                <button type="button" onClick={() => handleRemovePersonalGreeting(item.user_id)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10">حذف</button>
              </li>)}
            </ul>}
          </div>
          {welcomeMsg && <p role="status" className="text-sm text-emerald-600">{welcomeMsg}</p>}
        </div>
      </Section>}

      {/* Invoice Footer */}
      <Section title="متن پاورقی فاکتور" icon="📄">
        <F label="این متن در پایین فاکتورهای چاپی نمایش داده می‌شود">
          <textarea className={inp} rows={3} value={form.footer_text} onChange={(e) => set('footer_text', e.target.value)}
            placeholder="مثال: از اعتماد شما سپاسگزاریم. برای پیگیری سفارش با شماره زیر تماس بگیرید." />
        </F>
      </Section>

      {/* Customer Documents Path */}
      <Section title="مسیر ذخیره مدارک مشتریان" icon="📁">
        <div className="space-y-3">
          <F label="مسیر پوشه اصلی مدارک (روی سرور)">
            <div className="flex gap-2">
              <input className={`${inp} min-w-0 flex-1`} value={form.customer_documents_path}
                readOnly
                placeholder="پوشه‌ای از سیستم سرور انتخاب کنید"
                dir="ltr" />
              {isSuperuser && (
                <button type="button" onClick={() => openServerFolderPicker('documents')}
                  className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm text-blue-200 hover:bg-blue-600/30">
                  انتخاب پوشه
                </button>
              )}
            </div>
            {!isSuperuser && <p className="text-slate-600 text-xs">برای تغییر این مسیر، از حساب مدیر ارشد وارد شوید.</p>}
          </F>
          <p className="text-slate-500 text-xs leading-relaxed">
            📌 برای هر مشتری یک پوشه با فرمت <span className="font-mono text-slate-400 bg-slate-700/50 px-1 rounded">[ID]_[نام]</span> ایجاد می‌شود.
            اگر این مسیر تنظیم شود، فایل‌های آپلود شده به‌صورت خودکار در این پوشه‌ها کپی می‌شوند.
          </p>
        </div>
      </Section>

      {/* ── Backup Section ── */}
      {isSuperuser && (
      <Section title="پشتیبان‌گیری (بکاپ)" icon="💾">
        <div className="space-y-5">

          {/* Last backup info */}
          {backupCfg.last_backup_at && (
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
              <span className="text-emerald-400 text-lg">✅</span>
              <div>
                <p className="text-emerald-400 text-sm font-medium">آخرین بکاپ موفق</p>
                <p className="text-slate-400 text-xs">{persianDate(backupCfg.last_backup_at)}</p>
                {backupCfg.last_backup_path && (
                  <p className="text-slate-500 text-[10px] font-mono mt-0.5 break-all">{backupCfg.last_backup_path}</p>
                )}
              </div>
            </div>
          )}

          {/* Backup path */}
          <F label="📂 مسیر بکاپ روی رایانهٔ سرور">
            <div className="flex gap-2">
              <input className={`${inp} min-w-0 flex-1`}
                value={backupCfg.backup_path}
                readOnly
                placeholder="پوشه‌ای از سیستم سرور انتخاب کنید"
                dir="ltr" />
              <button type="button" onClick={() => openServerFolderPicker('backup')}
                className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm text-blue-200 hover:bg-blue-600/30">
                انتخاب پوشه
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-1">این پوشه باید از قبل روی رایانه‌ای که برنامهٔ سرور روی آن اجرا می‌شود وجود داشته باشد و سرور اجازهٔ نوشتن در آن را داشته باشد. برای ذخیره روی رایانهٔ خودتان از دکمهٔ «انتخاب محل و ذخیره فایل» استفاده کنید.</p>
          </F>

          {folderPickerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="انتخاب پوشهٔ سرور">
              <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
                  <h3 className="font-semibold text-white">انتخاب پوشهٔ {folderPickerTarget === 'documents' ? 'مدارک مشتریان' : 'بکاپ'} از سیستم سرور</h3>
                  <button type="button" onClick={() => setFolderPickerOpen(false)} className="text-slate-400 hover:text-white" aria-label="بستن">✕</button>
                </div>
                <div className="space-y-3 p-5">
                  <p className="break-all rounded-lg bg-slate-800 px-3 py-2 text-left font-mono text-xs text-slate-300" dir="ltr">{folderPickerData?.path || 'درایوها'}</p>
                  {folderPickerData?.roots?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {folderPickerData.roots.map((root) => (
                        <button type="button" key={root} onClick={() => loadServerFolders(root)} className="rounded-lg bg-slate-700 px-3 py-1.5 font-mono text-xs text-slate-200 hover:bg-slate-600" dir="ltr">{root}</button>
                      ))}
                    </div>
                  )}
                  {folderPickerData?.parent && (
                    <button type="button" onClick={() => loadServerFolders(folderPickerData.parent)} className="w-full rounded-lg border border-slate-700 px-3 py-2 text-right text-sm text-blue-300 hover:bg-slate-800">⬆️ پوشهٔ بالاتر</button>
                  )}
                  {folderPickerError && <p className="text-sm text-red-400">{folderPickerError}</p>}
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {folderPickerLoading ? <p className="py-6 text-center text-sm text-slate-400">در حال خواندن پوشه‌ها…</p> : (
                      folderPickerData?.folders?.length ? folderPickerData.folders.map((folder) => (
                        <button type="button" key={folder.path} onClick={() => loadServerFolders(folder.path)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm text-slate-200 hover:bg-slate-800">
                          <span>📁</span><span className="truncate">{folder.name}</span>
                        </button>
                      )) : <p className="py-6 text-center text-sm text-slate-500">پوشه‌ای در این مسیر وجود ندارد.</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-700 pt-3">
                    <button type="button" onClick={() => setFolderPickerOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">لغو</button>
                    <button type="button" disabled={!folderPickerData?.path || folderPickerLoading} onClick={() => { if (folderPickerTarget === 'documents') set('customer_documents_path', folderPickerData.path); else setBcfg('backup_path', folderPickerData.path); setFolderPickerOpen(false); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">انتخاب این پوشه</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Auto backup toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-700/20 rounded-xl border border-slate-700/30">
            <div>
              <p className="text-white text-sm font-medium">⏰ بکاپ خودکار</p>
              <p className="text-slate-500 text-xs mt-0.5">بکاپ در ساعت مشخص هر روز به‌صورت خودکار اجرا می‌شود</p>
            </div>
            <button
              onClick={() => setBcfg('auto_backup', !backupCfg.auto_backup)}
              className={`relative w-12 h-6 rounded-full transition-colors ${backupCfg.auto_backup ? 'bg-blue-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${backupCfg.auto_backup ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Auto backup settings */}
          {backupCfg.auto_backup && (
            <div className="grid grid-cols-2 gap-3">
              <F label="فرکانس بکاپ">
                <select className={inp} value={backupCfg.backup_frequency} onChange={(e) => setBcfg('backup_frequency', e.target.value)}>
                  <option value="daily">روزانه</option>
                  <option value="weekly">هفتگی</option>
                </select>
              </F>
              <F label="ساعت اجرا">
                <select className={inp} value={backupCfg.backup_hour} onChange={(e) => setBcfg('backup_hour', e.target.value)}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </F>
            </div>
          )}

          {backupMsg && (
            <div className={`text-sm px-4 py-3 rounded-xl border ${backupMsg.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {backupMsg}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSaveBackupConfig}
              disabled={backupSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {backupSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '⚙️'}
              ذخیره تنظیمات بکاپ
            </button>

            {backupCfg.backup_path && (
              <button
                onClick={() => handleRunBackup(true)}
                disabled={backupRunning}
                className="px-4 py-2.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-700 text-white text-sm border border-indigo-500/50 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {backupRunning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '💾'}
                ذخیره بکاپ روی سرور
              </button>
            )}

            <button
              onClick={() => handleRunBackup(false)}
              disabled={backupRunning}
              className="px-4 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-700 text-white text-sm border border-emerald-500/50 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {backupRunning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '⬇️'}
              انتخاب محل و ذخیره فایل
            </button>
          </div>

          <p className="text-slate-600 text-xs border-t border-slate-700/30 pt-3">
            💡 بکاپ شامل کاربران و هش رمزهایشان نیز هست؛ فایل را محرمانه نگه دارید. امضای SHA-256 خرابی یا تغییر فایل را پیش از بازیابی شناسایی می‌کند. برای بکاپ زمان‌بندی‌شده، برنامه باید باز و مدیر ارشد وارد شده باشد.
          </p>

          {isSuperuser && (
            <div className="space-y-3 border-t border-slate-700/30 pt-4">
              <h4 className="font-medium text-white">بازیابی از نسخهٔ پشتیبان</h4>
              <p className="text-xs leading-relaxed text-amber-600">بازیابی اطلاعات فعلی را با اطلاعات نسخهٔ پشتیبان جایگزین می‌کند. فایل ابتدا از نظر ساختار و صحت بررسی می‌شود؛ فایل‌های فیزیکی مدارک مشتریان باید در مسیر ذخیره‌سازی موجود باشند.</p>
              <input type="file" accept=".json,application/json" onChange={(e) => handleSelectRestoreFile(e.target.files?.[0])} className="block w-full text-sm text-slate-400 file:ml-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-200" />
              {restoreCounts && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-3 text-xs text-slate-400">
                  فایل سالم است: {new Intl.NumberFormat('fa-IR').format(Object.values(restoreCounts).reduce((sum, count) => sum + count, 0))} رکورد برای بازیابی.
                </div>
              )}
              {restoreBackup && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  <input value={restorePhrase} onChange={(e) => setRestorePhrase(e.target.value)} placeholder="برای فعال‌شدن دکمه بنویسید: تایید" className={inp} />
                  <button type="button" onClick={handleRestore} disabled={restoreBusy || !isRestoreConfirmed} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{restoreBusy ? 'در حال بازیابی...' : 'بازیابی کردن'}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
      )}
    </div>
  );
};

export default Settings;
