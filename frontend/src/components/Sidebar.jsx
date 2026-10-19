import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../features/authSlice';
import { invoicesAPI } from '../services/api';

const BASE_NAV_GROUPS = [
  {
    label: 'اصلی',
    items: [
      { to: '/', label: 'داشبورد', icon: '📊', exact: true },
    ],
  },
  {
    label: 'فاکتور',
    items: [
      { to: '/invoices', label: 'فاکتورها', icon: '🧾' },
      { to: '/invoices/new', label: 'فاکتور جدید', icon: '➕' },
      { to: '/reports', label: 'گزارشات', icon: '📈' },
    ],
  },
  {
    label: 'مالی',
    items: [
      { to: '/expenses', label: 'هزینه‌ها', icon: '💰' },
      { to: '/cheques', label: 'مدیریت چک‌ها', icon: '🎫' },
    ],
  },
  {
    label: 'مدیریت',
    items: [
      { to: '/customers', label: 'مشتریان', icon: '👥' },
      { to: '/services', label: 'خدمات', icon: '⚙️' },
      { to: '/staff', label: 'پرسنل', icon: '👷' },
    ],
  },
];

const Sidebar = ({ isOpen, onClose, isCollapsed = false, onToggleCollapse }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector((s) => s.auth.currentUser);
  const isAdmin = currentUser?.is_superuser;
  const isManager = Boolean(currentUser?.is_staff || currentUser?.is_superuser);
  const [editRequestCount, setEditRequestCount] = useState(0);

  useEffect(() => {
    if (!isManager) { setEditRequestCount(0); return; }
    let active = true;
    const refresh = () => invoicesAPI.editRequests().then(({ data }) => {
      if (active) setEditRequestCount(data.length);
    }).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isManager]);

  const systemGroup = {
    label: 'سیستم',
    items: [
      ...(isAdmin ? [{ to: '/users', label: 'مدیریت کاربران', icon: '🔐' }] : []),
      { to: '/settings', label: 'تنظیمات و برند', icon: '🎨' },
    ],
  };

  const navGroups = [...BASE_NAV_GROUPS, systemGroup];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full ${isCollapsed ? 'lg:w-20' : 'w-64'} w-64 z-30 flex flex-col
          bg-gradient-to-b from-slate-900 to-slate-800
          border-l border-slate-700/50 shadow-2xl
          transform transition-transform duration-300
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo + current user */}
        <div className="p-6 border-b border-slate-700/50">
          <div className={`flex items-center ${isCollapsed ? 'lg:justify-center' : ''} gap-3`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg shadow-lg shadow-blue-500/30">
              💎
            </div>
            <div className={isCollapsed ? 'lg:hidden' : ''}>
              <h1 className="text-white font-bold text-lg leading-tight">محاسب پرو</h1>
              <p className="text-slate-400 text-xs">سیستم مدیریت مالی</p>
            </div>
          </div>
          <button type="button" onClick={onToggleCollapse} title={isCollapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'} aria-label={isCollapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'} className="hidden lg:flex absolute top-4 left-3 h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white">{isCollapsed ? '⇤' : '⇥'}</button>
          {currentUser && (
            <div className={`mt-3 p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center gap-2.5 ${isCollapsed ? 'lg:justify-center lg:px-1' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-500
                flex items-center justify-center text-white text-xs font-bold border border-slate-500 shrink-0">
                {(currentUser.first_name?.[0] || currentUser.username?.[0] || '?').toUpperCase()}
              </div>
              <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                <p className="text-white text-xs font-medium truncate">
                  {currentUser.first_name
                    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim()
                    : currentUser.username}
                </p>
                <p className="text-slate-500 text-[10px]">
                  {isAdmin ? '👑 مدیر ارشد' : currentUser.is_staff ? '🔑 مدیر' : '👤 اپراتور'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${isCollapsed ? 'lg:p-2' : 'p-4'} space-y-4 overflow-y-auto`}>
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className={`text-slate-500 text-[10px] font-bold uppercase tracking-widest px-4 mb-1.5 ${isCollapsed ? 'lg:hidden' : ''}`}>{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center ${isCollapsed ? 'lg:justify-center lg:px-2' : ''} gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-l from-blue-600/30 to-indigo-600/20 text-blue-300 border border-blue-500/30 shadow-lg shadow-blue-500/10'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`
                    }
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className={isCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                    {isManager && item.to === '/invoices' && editRequestCount > 0 && <span className="mr-auto min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{editRequestCount}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className={`p-4 border-t border-slate-700/50 ${isCollapsed ? 'lg:p-2' : ''}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${isCollapsed ? 'lg:justify-center lg:px-2' : ''} gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200`}
          >
            <span>🚪</span>
            <span className={isCollapsed ? 'lg:hidden' : ''}>خروج از سیستم</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
