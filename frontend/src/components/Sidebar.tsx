import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../features/authSlice";
import { invoicesAPI, chatAPI, authAPI } from "../services/api";
import { hasModule } from "../utils/modules";
import type { ModuleName } from "../utils/modules";
import {
  BarChartIcon,
  ChatIcon,
  CogIcon,
  CrownIcon,
  DashboardIcon,
  FileTextIcon,
  GemIcon,
  HardHatIcon,
  KeyIcon,
  LogoutIcon,
  PlusIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ShieldCheckIcon,
  SlidersIcon,
  TicketIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "./icons";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  module?: ModuleName;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: "اصلی",
    items: [
      { to: "/", label: "داشبورد", icon: <DashboardIcon />, exact: true },
    ],
  },
  {
    label: "فاکتور",
    items: [
      {
        to: "/invoices",
        label: "فاکتورها",
        icon: <FileTextIcon />,
        module: "invoices",
      },
      {
        to: "/invoices/new",
        label: "فاکتور جدید",
        icon: <PlusIcon />,
        module: "invoices",
      },
      {
        to: "/reports",
        label: "گزارشات",
        icon: <BarChartIcon />,
        module: "reports",
      },
    ],
  },
  {
    label: "مالی",
    items: [
      {
        to: "/expenses",
        label: "هزینه‌ها",
        icon: <WalletIcon />,
        module: "expenses",
      },
      {
        to: "/cheques",
        label: "مدیریت چک‌ها",
        icon: <TicketIcon />,
        module: "cheques",
      },
    ],
  },
  {
    label: "ارتباطات",
    items: [
      { to: "/chat", label: "گفتگوی کاربران", icon: <ChatIcon />, module: "chat" },
    ],
  },
  {
    label: "مدیریت",
    items: [
      {
        to: "/customers",
        label: "مشتریان",
        icon: <UsersIcon />,
        module: "customers",
      },
      {
        to: "/services",
        label: "خدمات",
        icon: <CogIcon />,
        module: "services",
      },
      {
        to: "/staff",
        label: "پرسنل",
        icon: <HardHatIcon />,
        module: "staff",
      },
    ],
  },
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

const Sidebar = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector((s: any) => s.auth.currentUser);
  const isAdmin = currentUser?.is_superuser;
  const isManager = Boolean(currentUser?.is_staff || currentUser?.is_superuser);
  const [editRequestCount, setEditRequestCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const canChat = hasModule(currentUser, "chat");

  useEffect(() => {
    if (!currentUser || !canChat) {
      setChatUnreadCount(0);
      return undefined;
    }
    chatAPI
      .unread()
      .then(({ data }) => {
        setChatUnreadCount(data.count || 0);
        window.dispatchEvent(
          new CustomEvent("mohaseb:chat-unread", {
            detail: { count: data.count || 0 },
          }),
        );
      })
      .catch(() => {});
    const syncCount = (event: CustomEvent) =>
      setChatUnreadCount(event.detail?.count || 0);
    window.addEventListener("mohaseb:chat-unread", syncCount);
    return () => window.removeEventListener("mohaseb:chat-unread", syncCount);
  }, [currentUser?.id, canChat]);

  useEffect(() => {
    if (!isManager) {
      setEditRequestCount(0);
      return;
    }
    let active = true;
    const refresh = () =>
      invoicesAPI
        .editRequests()
        .then(({ data }) => {
          if (active) setEditRequestCount(data.length);
        })
        .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isManager]);

  const systemGroup: NavGroup = {
    label: "سیستم",
    items: [
      ...(isAdmin
        ? [
            {
              to: "/users",
              label: "مدیریت کاربران",
              icon: <ShieldCheckIcon />,
              module: "users" as ModuleName,
            },
          ]
        : []),
      {
        to: "/settings",
        label: "تنظیمات و برند",
        icon: <SlidersIcon />,
        module: "settings",
      },
    ],
  };

  // Stage 6: hide nav items for modules the user cannot access
  // (the backend enforces the same rules on the API itself).
  const navGroups = [...BASE_NAV_GROUPS, systemGroup]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasModule(currentUser, item.module)),
    }))
    .filter((group) => group.items.length > 0);

  const handleLogout = async () => {
    // Blacklist the refresh token server-side and clear its httpOnly cookie;
    // local cleanup happens either way so the user is never stuck logged in.
    try {
      await authAPI.logout();
    } catch {
      /* Offline or expired session. */
    }
    dispatch(logout());
    navigate("/login");
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
        className={`app-sidebar fixed top-0 right-0 h-full ${isCollapsed ? "lg:w-20" : "w-64"} w-64 z-30 flex flex-col
          bg-gradient-to-b from-slate-900 to-slate-800
          border-l border-slate-700/50 shadow-2xl
          transform transition-transform duration-300
          ${
            isOpen
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0 pointer-events-none lg:pointer-events-auto"
          }`}
      >
        {/* Logo + current user */}
        <div className="p-6 border-b border-slate-700/50">
          <div
            className={`flex items-center ${isCollapsed ? "lg:justify-center" : ""} gap-3`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 [&>svg]:h-5 [&>svg]:w-5">
              <GemIcon />
            </div>
            <div className={isCollapsed ? "lg:hidden" : ""}>
              <h1 className="text-white font-bold text-lg leading-tight">
                محاسب پرو
              </h1>
              <p className="text-slate-400 text-xs">سیستم مدیریت مالی</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
            aria-label={
              isCollapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"
            }
            className="hidden lg:flex absolute top-4 left-3 h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white [&>svg]:h-4 [&>svg]:w-4"
          >
            {isCollapsed ? <ChevronsLeftIcon /> : <ChevronsRightIcon />}
          </button>
          {currentUser && (
            <div
              className={`mt-3 p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center gap-2.5 ${isCollapsed ? "lg:justify-center lg:px-1" : ""}`}
            >
              <div
                className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-500
                flex items-center justify-center text-white text-xs font-bold border border-slate-500 shrink-0"
              >
                {(
                  currentUser.first_name?.[0] ||
                  currentUser.username?.[0] ||
                  "?"
                ).toUpperCase()}
              </div>
              <div className={`min-w-0 ${isCollapsed ? "lg:hidden" : ""}`}>
                <p className="text-white text-xs font-medium truncate">
                  {currentUser.first_name
                    ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim()
                    : currentUser.username}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-slate-500 text-[10px]">
                  {isAdmin ? (
                    <CrownIcon className="h-3 w-3 text-amber-400/80" />
                  ) : currentUser.is_staff ? (
                    <KeyIcon className="h-3 w-3 text-sky-400/80" />
                  ) : (
                    <UserIcon className="h-3 w-3 text-slate-400/80" />
                  )}
                  <span>
                    {isAdmin
                      ? "مدیر ارشد"
                      : currentUser.is_staff
                        ? "مدیر"
                        : "اپراتور"}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          className={`flex-1 ${isCollapsed ? "lg:p-2" : "p-4"} space-y-4 overflow-y-auto`}
        >
          {navGroups.map((group) => (
            <div key={group.label}>
              <p
                className={`text-slate-500 text-[10px] font-bold uppercase tracking-widest px-4 mb-1.5 ${isCollapsed ? "lg:hidden" : ""}`}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={onClose}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `relative flex items-center ${isCollapsed ? "lg:justify-center lg:px-2" : ""} gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 border border-transparent
                      ${
                        isActive
                          ? "bg-blue-500/10 text-blue-200 border-blue-400/15"
                          : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute right-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-l-full bg-blue-400"
                          />
                        )}
                        <span className="shrink-0 text-base [&>svg]:h-[18px] [&>svg]:w-[18px]">
                          {item.icon}
                        </span>
                        <span className={isCollapsed ? "lg:hidden" : ""}>
                          {item.label}
                        </span>
                        {isManager &&
                          item.to === "/invoices" &&
                          editRequestCount > 0 && (
                            <span className="mr-auto min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                              {editRequestCount}
                            </span>
                          )}
                        {item.to === "/chat" && chatUnreadCount > 0 && (
                          <span
                            className="mr-auto min-w-5 rounded-full bg-blue-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white"
                            title={`${chatUnreadCount} پیام خوانده‌نشده`}
                          >
                            {chatUnreadCount > 99 ? "۹۹+" : chatUnreadCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div
          className={`p-4 border-t border-slate-700/50 ${isCollapsed ? "lg:p-2" : ""}`}
        >
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${isCollapsed ? "lg:justify-center lg:px-2" : ""} gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 [&>svg]:h-[18px] [&>svg]:w-[18px]`}
          >
            <LogoutIcon />
            <span className={isCollapsed ? "lg:hidden" : ""}>
              خروج از سیستم
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
