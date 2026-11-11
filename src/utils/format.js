/**
 * Format a number as money with 2 decimals, e.g. "₹ 1,234.50".
 * `locale` defaults to the browser locale; pass 'en-IN' for lakh/crore grouping.
 */
export const formatMoney = (val, symbol = '₹', locale = undefined) =>
  `${symbol} ${Number(val || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
