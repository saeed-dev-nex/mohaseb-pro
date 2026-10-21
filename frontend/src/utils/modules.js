// Stage 6: per-module access vocabulary, mirroring backend api.module_access.
// A user's effective modules come from /api/users/me/ (`modules` field).
// Restriction rows can only remove modules below the role ceiling — the
// backend enforces this; the helpers here only drive UI visibility.

export const ALL_MODULES = [
  'invoices', 'customers', 'services', 'expenses', 'cheques', 'reports',
  'chat', 'staff', 'settings', 'users', 'backup',
];

export const MODULE_LABELS = {
  invoices: 'فاکتورها',
  customers: 'مشتریان',
  services: 'خدمات',
  expenses: 'هزینه‌ها',
  cheques: 'چک‌ها',
  reports: 'گزارشات',
  chat: 'گفتگو',
  staff: 'پرسنل',
  settings: 'تنظیمات',
  users: 'مدیریت کاربران',
  backup: 'بکاپ',
};

const RESOURCE_MODULES = [
  'invoices', 'customers', 'services', 'expenses', 'cheques', 'reports',
  'chat', 'staff',
];

// The most a role can ever reach; a restriction row can only go below this.
export function ceilingFor(role) {
  if (role === 'admin') return ALL_MODULES;
  if (role === 'manager') return [...RESOURCE_MODULES, 'settings', 'users'];
  return RESOURCE_MODULES;
}

// UI visibility check. When the session payload predates stage 6 (no
// `modules` array yet), don't hide anything here — the backend still
// enforces the real rules and the next /me refresh fills the field in.
export function hasModule(user, module) {
  if (!module) return true;
  const mods = user?.modules;
  if (!Array.isArray(mods)) return true;
  return mods.includes(module);
}
