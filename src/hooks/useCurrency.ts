import { useState, useEffect } from 'react';

const TIMEZONE_CURRENCY_MAP: Record<string, string> = {
  'Asia/Kolkata': 'INR',
  'Asia/Calcutta': 'INR',
  'Asia/Colombo': 'LKR',
  'Asia/Singapore': 'SGD',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Tokyo': 'JPY',
  'Asia/Shanghai': 'CNY',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Seoul': 'KRW',
  'Asia/Dubai': 'AED',
  'Asia/Riyadh': 'SAR',
  'Asia/Bangkok': 'THB',
  'Asia/Jakarta': 'IDR',
  'Asia/Manila': 'PHP',
  'Asia/Karachi': 'PKR',
  'Asia/Dhaka': 'BDT',
  'Asia/Kathmandu': 'NPR',
  'Asia/Yangon': 'MMR',
  'Asia/Almaty': 'KZT',
  'Asia/Tashkent': 'UZS',
  'Europe/London': 'GBP',
  'Europe/Dublin': 'EUR',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Vienna': 'EUR',
  'Europe/Zurich': 'CHF',
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK',
  'Europe/Warsaw': 'PLN',
  'Europe/Prague': 'CZK',
  'Europe/Budapest': 'HUF',
  'Europe/Bucharest': 'RON',
  'Europe/Moscow': 'RUB',
  'Europe/Istanbul': 'TRY',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Phoenix': 'USD',
  'America/Anchorage': 'USD',
  'America/Honolulu': 'USD',
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Montreal': 'CAD',
  'America/Calgary': 'CAD',
  'America/Halifax': 'CAD',
  'America/Mexico_City': 'MXN',
  'America/Bogota': 'COP',
  'America/Lima': 'PEN',
  'America/Santiago': 'CLP',
  'America/Buenos_Aires': 'ARS',
  'America/Sao_Paulo': 'BRL',
  'America/Caracas': 'VES',
  'Pacific/Auckland': 'NZD',
  'Pacific/Fiji': 'FJD',
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Perth': 'AUD',
  'Australia/Adelaide': 'AUD',
  'Africa/Johannesburg': 'ZAR',
  'Africa/Cairo': 'EGP',
  'Africa/Lagos': 'NGN',
  'Africa/Nairobi': 'KES',
  'Africa/Accra': 'GHS',
  'Africa/Casablanca': 'MAD',
};

function getCurrencyFromTimezone(tz: string): string {
  if (TIMEZONE_CURRENCY_MAP[tz]) return TIMEZONE_CURRENCY_MAP[tz];
  if (tz.startsWith('Europe/')) return 'EUR';
  if (tz.startsWith('America/')) return 'USD';
  if (tz.startsWith('Australia/')) return 'AUD';
  if (tz.startsWith('Pacific/')) return 'USD';
  if (tz.startsWith('Africa/')) return 'USD';
  return 'USD';
}

export interface CurrencyState {
  currency: string;
  rate: number;
  loading: boolean;
  formatPrice: (amountUsd: number) => string;
  formatPriceFrom: (amount: number, fromCurrency: string, toCurrency?: string) => string;
}

let rateCache: Record<string, number> | null = null;
let rateCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

export { getCurrencyFromTimezone };

export function useCurrency(): CurrencyState {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const detectedCurrency = getCurrencyFromTimezone(tz);

  const [rate, setRate] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = Date.now();
    const isCached = rateCache && (now - rateCacheTime < CACHE_TTL);
    if (isCached) {
      setRate(rateCache![detectedCurrency] ?? 1);
      return;
    }

    setLoading(true);
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data?.rates) {
          rateCache = data.rates;
          rateCacheTime = Date.now();
          setRate(data.rates[detectedCurrency] ?? 1);
        }
      })
      .catch(() => {
        rateCache = { USD: 1 };
        rateCacheTime = Date.now();
        setRate(1);
      })
      .finally(() => setLoading(false));
  }, [detectedCurrency]);

  function convert(from: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return from;
    if (!rateCache || !rateCache[fromCurrency] || !rateCache[toCurrency]) return NaN;
    const fromRate = rateCache[fromCurrency];
    const toRate = rateCache[toCurrency];
    if (fromRate === 0) return NaN;
    return (from / fromRate) * toRate;
  }

  function formatPrice(amountUsd: number): string {
    if (amountUsd === 0) return 'Free';
    const converted = amountUsd * rate;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: detectedCurrency,
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(Math.round(converted));
    } catch {
      return `$${amountUsd}`;
    }
  }

  function formatPriceFrom(amount: number, fromCurrency: string, toCurrency?: string): string {
    if (amount === 0) return 'Free';
    const target = toCurrency || detectedCurrency;
    const rawConverted = convert(amount, fromCurrency, target);
    if (Number.isNaN(rawConverted)) {
      return `${fromCurrency === 'USD' ? '$' : fromCurrency}${amount}`;
    }
    const rounded = Math.round(rawConverted);
    const display = rounded === 0 ? 1 : rounded;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: target,
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(display);
    } catch {
      return `${fromCurrency === 'USD' ? '$' : fromCurrency}${amount}`;
    }
  }

  return { currency: detectedCurrency, rate, loading, formatPrice, formatPriceFrom };
}
