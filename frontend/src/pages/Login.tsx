import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { setTokens, setCurrentUser } from "../features/authSlice";
import api, { API_BASE_URL } from "../services/api";
import { queryClient } from "../lib/queryClient";
import PasswordInput from "../components/PasswordInput";
import {
  AlertCircleIcon,
  BarChartIcon,
  BoltIcon,
  FileTextIcon,
  GemIcon,
  TicketIcon,
} from "../components/icons";

const inputCls =
  "w-full rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30";

const FEATURES = [
  {
    icon: <BoltIcon />,
    title: "فاکتور سریع",
    text: "صدور فاکتور در چند ثانیه، حتی بدون اینترنت",
  },
  {
    icon: <TicketIcon />,
    title: "پیگیری چک",
    text: "سررسید دریافتی و پرداختی را قبل از موعد بدانید",
  },
  {
    icon: <BarChartIcon />,
    title: "گزارش شمسی",
    text: "درآمد، هزینه و سود بر اساس ماه‌های ایرانی",
  },
];

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_BASE_URL}token/`,
        {
          username,
          password,
        },
        { withCredentials: true, headers: { "X-Client-Type": "web" } },
      );

      // For the web client the backend returns no refresh token in the body;
      // it is stored in an httpOnly cookie instead.
      queryClient.clear();
      dispatch(setCurrentUser(null));
      dispatch(
        setTokens({
          access: response.data.access,
        }),
      );

      // Fetch current user info (role, etc.)
      try {
        const meRes = await api.get("users/me/", {
          headers: { Authorization: `Bearer ${response.data.access}` },
        });
        dispatch(setCurrentUser(meRes.data));
      } catch (_) {}

      navigate("/");
    } catch (err) {
      setError("نام کاربری یا رمز عبور اشتباه است.");
    } finally {
      setLoading(false);
    }
  };

  const brand = (
    <div className="flex items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 [&>svg]:h-6 [&>svg]:w-6">
        <GemIcon />
      </span>
      <div>
        <p className="text-lg font-bold leading-tight text-white">محاسب پرو</p>
        <p className="text-xs text-slate-400">سیستم یکپارچهٔ مالی</p>
      </div>
    </div>
  );

  return (
    <div
      data-theme={localStorage.getItem("app-theme") || "dark"}
      className="login-page relative min-h-screen overflow-hidden bg-slate-950"
      dir="rtl"
    >
      {/* Soft ambient colour instead of the old spinning blobs. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-[-10%] h-[30rem] w-[30rem] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute -bottom-48 left-[-8%] h-[32rem] w-[32rem] rounded-full bg-indigo-600/15 blur-[130px]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Brand story — desktop only; the card carries the logo on phones. */}
        <section className="hidden lg:block">
          <div className="mb-10">{brand}</div>
          <h1 className="text-4xl font-bold leading-[1.3] tracking-tight text-white xl:text-5xl">
            مالی کسب‌وکار،
            <span className="text-gradient"> در یک نگاه</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-8 text-slate-300">
            صدور فاکتور، پیگیری چک و گزارش شمسی — همه در یک سیستم، بدون
            کاغذبازی.
          </p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700/40 text-blue-300 [&>svg]:h-5 [&>svg]:w-5">
                  {feature.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {feature.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-slate-400">
                    {feature.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Form card */}
        <section
          aria-labelledby="login-title"
          className="login-card mx-auto w-full max-w-md rounded-3xl border border-slate-700/60 bg-slate-900/70 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9"
        >
          <div className="mb-8 lg:hidden">{brand}</div>

          <h2
            id="login-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            ورود به حساب
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-400">
            برای ادامه، نام کاربری و رمز عبور خود را وارد کنید
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
            >
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="login-username"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                نام کاربری
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputCls}
                placeholder="نام کاربری خود را وارد کنید"
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                رمز عبور
              </label>
              <PasswordInput
                id="login-password"
                value={password}
                dir="ltr"
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <svg
                    className="ml-2 h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  در حال ورود…
                </>
              ) : (
                "ورود به حساب"
              )}
            </button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <FileTextIcon className="h-3.5 w-3.5" />
            محاسب پرو · نسخهٔ {__APP_VERSION__}
          </p>
        </section>
      </div>
    </div>
  );
};

export default Login;
