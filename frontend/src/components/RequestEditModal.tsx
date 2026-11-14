import React, { useEffect, useState } from "react";

/**
 * RequestEditModal — درخواست ویرایش فاکتور پرداخت‌شده از مدیر، همراه با دلیل.
 *
 * The reason is optional: the requester can explain what needs fixing so
 * the reviewing manager decides with context. Empty reason submits as a
 * plain request, exactly like before this dialog existed.
 */

type RequestEditModalProps = {
  open: boolean;
  invoiceNumber?: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
};

const RequestEditModal = ({
  open,
  invoiceNumber,
  submitting = false,
  onClose,
  onSubmit,
}: RequestEditModalProps) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="درخواست ویرایش فاکتور"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">
                درخواست ویرایش از مدیر
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {invoiceNumber
                  ? `فاکتور ${invoiceNumber} پرداخت شده است و ویرایش آن نیاز به تأیید مدیر دارد.`
                  : "این فاکتور پرداخت شده است و ویرایش آن نیاز به تأیید مدیر دارد."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="text-slate-400 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div>
            <label
              htmlFor="edit-request-reason"
              className="block text-sm text-slate-300 mb-1.5"
            >
              دلیل ویرایش{" "}
              <span className="text-slate-500 text-xs">(اختیاری)</span>
            </label>
            <textarea
              id="edit-request-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="مثلاً: مبلغ پرداختی ردیف دوم اشتباه ثبت شده است"
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              مدیر هنگام بررسی درخواست، این دلیل را می‌بیند.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSubmit(reason.trim())}
              disabled={submitting}
              className="flex-1 rounded-xl bg-amber-500/90 hover:bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              {submitting ? "در حال ارسال..." : "ثبت درخواست"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/60 disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestEditModal;
