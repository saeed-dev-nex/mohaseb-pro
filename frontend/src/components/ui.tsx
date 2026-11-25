import React from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangleIcon, InboxIcon, RotateCwIcon } from "./icons";

// ---- Page Header ----
// One header pattern for every page: a single visual anchor (h1), a quiet
// description line, and the page's primary action on the trailing edge.
type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export const PageHeader = ({
  title,
  description,
  actions,
}: PageHeaderProps) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      )}
    </div>
    {actions && (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions}
      </div>
    )}
  </div>
);

// ---- Card ----
// The app's single panel surface. Keeping one radius, border and padding
// scale is what stops the layout from reading as a pile of look-alike boxes.
type CardProps = {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export const Card = ({
  title,
  icon,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: CardProps) => (
  <section
    className={`rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 sm:p-6 ${className}`}
  >
    {(title || actions) && (
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white sm:text-base">
          {icon && (
            <span className="shrink-0 text-slate-400 [&>svg]:h-[18px] [&>svg]:w-[18px]">
              {icon}
            </span>
          )}
          <span className="truncate">{title}</span>
        </h2>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </header>
    )}
    <div className={bodyClassName}>{children}</div>
  </section>
);

// ---- Skeleton ----
// Layout-shaped placeholder instead of a centered spinner, so the page does
// not jump when data lands.
export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-lg bg-slate-700/40 ${className}`}
  />
);

// ---- Error State ----
// Load failures used to end in a console.error and a permanently empty page;
// give the user the reason and a way forward.
type ErrorStateProps = {
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
  retryLabel?: ReactNode;
};

export const ErrorState = ({
  title = "دریافت اطلاعات انجام نشد",
  message = "اتصال به سرور برقرار نشد. اینترنت یا وضعیت سرور را بررسی کنید و دوباره تلاش کنید.",
  onRetry,
  retryLabel = "تلاش دوباره",
}: ErrorStateProps) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/5 px-6 py-12 text-center"
  >
    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-400 [&>svg]:h-6 [&>svg]:w-6">
      <AlertTriangleIcon />
    </span>
    <h3 className="mb-1 text-base font-semibold text-slate-200">{title}</h3>
    <p className="max-w-sm text-sm leading-6 text-slate-500">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-700/40 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/70"
      >
        <RotateCwIcon className="h-4 w-4" />
        {retryLabel}
      </button>
    )}
  </div>
);

// ---- Stat Card ----
type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  sub?: ReactNode;
};

export const StatCard = ({
  label,
  value,
  icon,
  color = "blue",
  sub,
}: StatCardProps) => {
  // Neutral surface + one colored icon chip keeps the dashboard calm and
  // professional; full-color cards read as dated "rainbow" dashboards.
  const chips: Record<string, string> = {
    blue: "bg-blue-500/15 text-blue-400",
    green: "bg-green-500/15 text-green-400",
    yellow: "bg-yellow-500/15 text-yellow-400",
    red: "bg-red-500/15 text-red-400",
    purple: "bg-purple-500/15 text-purple-400",
  };

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-slate-400 text-sm mb-1">{label}</p>
          <p className="num text-white text-2xl font-bold">{value}</p>
          {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        </div>
        {icon && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl [&>svg]:h-5 [&>svg]:w-5 ${chips[color]}`}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
};

// ---- Status Badge ----
export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    draft: {
      label: "پیش‌نویس",
      cls: "bg-slate-500/20 text-slate-400 border-slate-500/30",
      dot: "bg-slate-400",
    },
    pending: {
      label: "در انتظار",
      cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      dot: "bg-yellow-400",
    },
    paid: {
      label: "پرداخت شده",
      cls: "bg-green-500/20 text-green-400 border-green-500/30",
      dot: "bg-green-400",
    },
    commission_paid: {
      label: "کارمزد پرداخت شده",
      cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      dot: "bg-emerald-300",
    },
    cancelled: {
      label: "لغو شده",
      cls: "bg-red-500/20 text-red-400 border-red-500/30",
      dot: "bg-red-400",
    },
  };
  const { label, cls, dot } = map[status] || {
    label: status,
    cls: "",
    dot: "",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
};

// ---- Loading Spinner ----
export const Spinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes: Record<string, string> = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  return (
    <div className="flex items-center justify-center p-8">
      <svg
        className={`animate-spin text-blue-500 ${sizes[size]}`}
        fill="none"
        viewBox="0 0 24 24"
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
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

// ---- Empty State ----
type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-700/40 text-slate-400 [&>svg]:h-6 [&>svg]:w-6">
      {icon || <InboxIcon />}
    </span>
    <h3 className="text-slate-300 text-lg font-semibold mb-2">{title}</h3>
    {description && (
      <p className="text-slate-500 text-sm max-w-sm">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

// ---- Modal ----
export const ErrorNotice = ({ message }: { message?: string }) =>
  message ? (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      {message}
    </div>
  ) : null;

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  dismissible?: boolean;
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  dismissible = true,
}: ModalProps) => {
  const titleId = `modal-title-${React.useId()}`;
  const modalRootRef = React.useRef<HTMLDivElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const dismissibleRef = React.useRef(dismissible);

  React.useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  }, [onClose, dismissible]);

  React.useEffect(() => {
    if (!isOpen) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    previousFocusRef.current = previousFocus;

    const modalRoot = modalRootRef.current;
    if (!modalRoot) return;

    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== modalRoot,
    );
    const previousBackgroundState = backgroundElements.map((element) => ({
      element,
      inert: (element as HTMLElement & { inert?: boolean }).inert ?? false,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));

    backgroundElements.forEach((element) => {
      (element as HTMLElement & { inert?: boolean }).inert = true;
      element.setAttribute("aria-hidden", "true");
    });

    const focusable = modalRoot.querySelector<HTMLElement>(
      '[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (focusable || dialogRef.current)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        dismissibleRef.current
      ) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousBackgroundState.forEach(({ element, inert, ariaHidden }) => {
        (element as HTMLElement & { inert?: boolean }).inert = inert;
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
      });

      const previousFocusElement = previousFocusRef.current;
      if (previousFocusElement && document.contains(previousFocusElement)) {
        previousFocusElement.focus();
      }
      previousFocusRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;
  const sizes: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };
  return createPortal(
    <div
      ref={modalRootRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (dismissible) onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-panel relative w-full ${sizes[size]} bg-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 id={titleId} className="text-white text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="بستن"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

// ---- Input Field ----
type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: ReactNode;
};

export const InputField = ({ label, error, ...props }: InputFieldProps) => {
  const generatedId = `input-${React.useId()}`;
  const fieldId = props.id || generatedId;
  const errorId = `${fieldId}-error`;
  const describedBy = [props["aria-describedby"], error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-slate-300"
        >
          {label}
        </label>
      )}
      <input
        {...props}
        id={fieldId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy || undefined}
        className={`w-full px-4 py-2.5 bg-slate-700/50 border rounded-xl text-white placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all
          ${error ? "border-red-500/50" : "border-slate-600/50"} ${props.className || ""}`}
      />
      {error && (
        <p id={errorId} className="text-red-400 text-xs">
          {error}
        </p>
      )}
    </div>
  );
};

// ---- Select Field ----
type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  error?: ReactNode;
  children?: ReactNode;
};

export const SelectField = ({
  label,
  error,
  children,
  ...props
}: SelectFieldProps) => {
  const generatedId = `select-${React.useId()}`;
  const fieldId = props.id || generatedId;
  const errorId = `${fieldId}-error`;
  const describedBy = [props["aria-describedby"], error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-slate-300"
        >
          {label}
        </label>
      )}
      <select
        {...props}
        id={fieldId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy || undefined}
        className={`w-full px-4 py-2.5 bg-slate-700/50 border rounded-xl text-white
          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all
          ${error ? "border-red-500/50" : "border-slate-600/50"} ${props.className || ""}`}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-red-400 text-xs">
          {error}
        </p>
      )}
    </div>
  );
};

// ---- Button ----
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "success" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children?: ReactNode;
};

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading,
  ...props
}: ButtonProps) => {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25",
    success:
      "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25",
    danger:
      "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-500/25",
    ghost:
      "bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/50",
    outline:
      "border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      aria-busy={loading ? true : props["aria-busy"]}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200
        active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${props.className || ""}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
      )}
      {loading && (
        <span className="sr-only" role="status" aria-live="polite">
          در حال بارگذاری
        </span>
      )}
      {children}
    </button>
  );
};

// ---- Price formatter ----
export const formatPrice = (
  amount: number | string | null | undefined,
): string => {
  if (!amount && amount !== 0) return "---";
  return new Intl.NumberFormat("fa-IR").format(amount as number) + " تومان";
};

// ---- Confirm Dialog ----
type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  message: ReactNode;
  loading?: boolean;
  error?: string;
};

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  error,
}: ConfirmDialogProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="sm"
    dismissible={!loading}
  >
    <p className="text-slate-300 text-sm mb-6">{message}</p>
    <ErrorNotice message={error} />
    <div className="flex gap-3 justify-end">
      <Button variant="ghost" onClick={onClose} disabled={loading}>
        انصراف
      </Button>
      <Button variant="danger" onClick={onConfirm} loading={loading}>
        تأیید
      </Button>
    </div>
  </Modal>
);
