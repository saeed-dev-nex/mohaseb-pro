import React, { useState } from "react";
import { useSelector } from "react-redux";
import { MoonIcon, SunIcon } from "./icons";

type NavbarProps = { onMenuToggle: () => void };

const Navbar = ({ onMenuToggle }: NavbarProps) => {
  const currentUser = useSelector((s: any) => s.auth.currentUser);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("app-theme") || "dark",
  );
  // Real connection status: the old badge was always green even offline.
  const [online, setOnline] = useState(() => navigator.onLine);
  React.useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("app-theme", next);
    document.querySelector("[data-theme]")?.setAttribute("data-theme", next);
  };
  // Build channel badge: "بتا" for beta builds, "مین" for main builds, the
  // raw branch name for anything else, nothing when the build could not
  // tell (e.g. a detached HEAD without VITE_APP_CHANNEL).
  const channelLabel =
    __APP_CHANNEL__ === "beta"
      ? "بتا"
      : __APP_CHANNEL__ === "main"
        ? "مین"
        : __APP_CHANNEL__;
  const channelClass =
    __APP_CHANNEL__ === "beta"
      ? "bg-amber-500/15 text-amber-300"
      : __APP_CHANNEL__ === "main"
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-slate-700/70 text-slate-300";
  const now = new Date();
  const persianDate = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        aria-label="باز کردن منو"
        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Right side - Date */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-700/50 hover:text-white border border-slate-700/50 transition-all"
          aria-label={theme === "dark" ? "روشن کردن حالت روشن" : "روشن کردن حالت تیره"}
          title={theme === "dark" ? "حالت روشن" : "حالت تیره"}
        >
          {theme === "dark" ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </button>
        <span className="hidden sm:inline text-slate-400 text-sm">
          {persianDate}
        </span>
        <div className="w-px h-5 bg-slate-700 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-2" title={online ? "اتصال برقرار است" : "اینترنت قطع است — فاکتورها ذخیره و بعداً ارسال می‌شوند"}>
          <div
            className={`w-2 h-2 rounded-full ${online ? "bg-green-400 animate-pulse" : "bg-amber-500"}`}
          />
          <span className="text-slate-400 text-xs">
            {online ? "آنلاین" : "آفلاین"}
          </span>
        </div>
      </div>

      {/* Left side - User */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-white text-sm font-medium leading-none">
            {currentUser?.first_name || currentUser?.username || "کاربر"}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {currentUser?.username || ""}{" "}
            <span className="text-slate-500">· نسخه {__APP_VERSION__}</span>
            {channelLabel && (
              <span
                className={`mr-1.5 rounded-full px-2 py-px text-xs ${channelClass}`}
              >
                {channelLabel}
              </span>
            )}
          </p>
        </div>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/30">
          {(currentUser?.first_name || currentUser?.username || "م").slice(
            0,
            1,
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
