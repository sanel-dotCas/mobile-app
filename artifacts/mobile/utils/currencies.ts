export const CURRENCY_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  KWD: 0.307,
  QAR: 3.64,
  OMR: 0.385,
  BHD: 0.376,
  EGP: 30.9,
  JPY: 149.5,
};

export const CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  KWD: "Kuwaiti Dinar",
  QAR: "Qatari Riyal",
  OMR: "Omani Rial",
  BHD: "Bahraini Dinar",
  EGP: "Egyptian Pound",
  JPY: "Japanese Yen",
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED",
  SAR: "SAR",
  KWD: "KD",
  QAR: "QR",
  OMR: "OMR",
  BHD: "BD",
  EGP: "E£",
  JPY: "¥",
};

export const CURRENCIES = Object.keys(CURRENCY_RATES);

export const LOCAL_CURRENCY = "AED";

export function getExchangeRate(from: string, to: string): number {
  const fromRate = CURRENCY_RATES[from] ?? 1;
  const toRate = CURRENCY_RATES[to] ?? 1;
  return toRate / fromRate;
}

export function convertCurrency(amount: number, from: string, to: string): number {
  return amount * getExchangeRate(from, to);
}

export function formatCurrency(amount: number, currency: string, decimals = 2): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym} ${amount.toFixed(decimals)}`;
}

export function calcLineAmounts(
  unitPrice: number,
  qty: number,
  discountPct: number,
  markupPct: number,
  vatPct: number
) {
  const base = unitPrice * qty;
  const afterDiscount = base * (1 - discountPct / 100);
  const afterMarkup = afterDiscount * (1 + markupPct / 100);
  const vatAmount = afterMarkup * (vatPct / 100);
  const lineTotal = afterMarkup + vatAmount;
  return { base, afterDiscount, afterMarkup, vatAmount, lineTotal };
}
