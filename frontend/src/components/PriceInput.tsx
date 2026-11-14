import React, { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { numberToWords } from "../utils/persian";
import {
  evaluateAmountExpression,
  isAmountExpression,
  normalizeAmountText,
} from "../utils/amountExpression";

/**
 * PriceInput — ورود قیمت به هزار تومان
 *
 * کاربر عدد را به واحد «هزار تومان» وارد می‌کند (مثلاً 200)
 * و مقدار واقعی به تومان ذخیره می‌شود (200 × 1000 = 200,000)
 *
 * بهبود: صفرها به جای لیبل مجزا، دقیقاً در کنار خود عدد و چسبیده به آن نمایش داده می‌شوند.
 *
 * جمع چند مبلغ: کاربر می‌تواند مبلغ را به صورت «230+320» وارد کند؛ با
 * زدن Enter یا خروج از اینپوت فقط حاصل جمع (550) ثبت و نمایش داده
 * می‌شود و هیچ اثری از مبالغ جزء در اینپوت یا فاکتور نهایی نمی‌ماند.
 *
 * Props:
 *   value     — مقدار واقعی به تومان (مثلاً 200000)
 *   onChange  — callback با مقدار واقعی جدید
 *   placeholder, className, ...rest
 */

const fmt = (n: number | string) =>
  new Intl.NumberFormat("fa-IR").format(Number(n) || 0);

type PriceInputProps = {
  value?: number | string | null;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  borderColor?: string;
  blankWhenZero?: boolean;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "placeholder" | "className"
>;

const PriceInput = ({
  value,
  onChange,
  placeholder = "0",
  className = "",
  borderColor = "",
  blankWhenZero = false,
  onBlur,
  onFocus,
  onKeyDown,
  ...rest
}: PriceInputProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);

  // While the user is typing, the field shows their raw text (which may
  // be an in-progress sum like "230+32"); null means "not editing" and
  // the display derives from the committed value, so a committed sum
  // instantly replaces the expression with the plain total.
  const [draft, setDraft] = useState<string | null>(null);

  // Display value (thousands)
  const displayValue =
    value && !(blankWhenZero && Number(value) === 0)
      ? Math.floor(Number(value) / 1000)
      : "";
  const shownText = draft ?? (displayValue === "" ? "" : String(displayValue));

  // If the value is reset from outside (form reset, another record)
  // while this field is not being edited, drop any stale draft.
  useEffect(() => {
    if (!focusedRef.current) setDraft(null);
  }, [value]);

  // Live preview: while a valid sum is being typed, preview its total.
  const draftSum =
    draft != null && isAmountExpression(draft)
      ? evaluateAmountExpression(draft)
      : null;
  const realAmount =
    draftSum != null ? Math.round(draftSum * 1000) : Number(value) || 0;

  const commitDraft = () => {
    if (draft == null) return;
    if (isAmountExpression(draft)) {
      const sum = evaluateAmountExpression(draft);
      if (sum != null) onChange(Math.round(sum * 1000));
      // A broken expression simply reverts to the committed value.
    }
    setDraft(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = normalizeAmountText(e.target.value);
    setDraft(text);
    if (isAmountExpression(text)) return; // committed on Enter/blur
    if (text === "" || text === "0") {
      onChange(0);
    } else if (/^\d+(\.\d*)?$/.test(text)) {
      onChange(Math.round(Number(text) * 1000));
    }
    // Anything else (stray letters) stays as an uncommitted draft.
  };

  const baseCls =
    "flex items-center justify-end w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus-within:ring-2 focus-within:ring-blue-500/40 transition-all";

  return (
    <div className="space-y-1">
      {/* Container simulating the input, forcing LTR for numbers so we get "number" followed by ",000" */}
      <div
        ref={containerRef}
        className={`${baseCls} ${borderColor} ${className} cursor-text`}
        onClick={() => inputRef.current?.focus()}
        dir="ltr"
      >
        <div className="flex items-center select-none mr-1">
          <span className="text-slate-500 font-mono text-sm leading-none">
            ,000
          </span>
          <span className="text-slate-400 text-xs ml-1.5 font-medium leading-none">
            تومان
          </span>
        </div>

        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={shownText}
          onChange={handleChange}
          onFocus={(e) => {
            focusedRef.current = true;
            if (draft == null) {
              setDraft(displayValue === "" ? "" : String(displayValue));
            }
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focusedRef.current = false;
            commitDraft();
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              draft != null &&
              isAmountExpression(draft)
            ) {
              e.preventDefault();
              commitDraft();
            }
            onKeyDown?.(e);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent border-none outline-none text-right text-white text-sm p-0 focus:ring-0 focus:outline-none"
          {...rest}
        />
      </div>

      {/* Persian text preview of full amount, digits and words. The slot
          always exists with a fixed height and never wraps, so typing an
          amount never changes the component's height or shifts the form
          layout; long words are clipped with an ellipsis and the full
          text stays available via the title tooltip. */}
      <p
        className="h-4 overflow-hidden whitespace-nowrap text-ellipsis text-[10px] leading-4 text-emerald-400/70 pr-1 text-right"
        dir="rtl"
        title={
          realAmount > 0
            ? `= ${fmt(realAmount)} تومان (${numberToWords(realAmount)})`
            : undefined
        }
      >
        {realAmount > 0 && (
          <>
            ={" "}
            <span className="font-semibold text-emerald-400">
              {fmt(realAmount)} تومان
            </span>{" "}
            <span className="text-emerald-400/60">
              ({numberToWords(realAmount)})
            </span>
          </>
        )}
      </p>
    </div>
  );
};

export default PriceInput;
