/**
 * Amount-entry expressions.
 *
 * While typing an amount, the user may enter a sum such as "230+320"
 * instead of a single number. The expression itself is never stored:
 * when the field is committed (Enter or blur) only the evaluated total
 * replaces it, so neither the input nor the saved invoice shows any
 * trace of the parts. Parts may use Persian/Arabic digits and thousand
 * separators; the result is in the same unit the user typed in.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Latin digits, "+" kept, spaces and thousand separators removed. */
export function normalizeAmountText(text) {
  return String(text ?? "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/＋/g, "+")
    .replace(/[,\s٬،]/g, "");
}

/** True when the text is being typed as a sum (contains "+"). */
export function isAmountExpression(text) {
  return normalizeAmountText(text).includes("+");
}

/**
 * Evaluate a sum expression to a single number.
 * Returns null when the text is not an expression or any part is not a
 * valid non-negative number (empty part, trailing "+", stray letters).
 */
export function evaluateAmountExpression(text) {
  const normalized = normalizeAmountText(text);
  if (!normalized.includes("+")) return null;
  let total = 0;
  for (const part of normalized.split("+")) {
    if (!/^\d+(\.\d+)?$/.test(part)) return null;
    total += Number(part);
  }
  return total;
}
