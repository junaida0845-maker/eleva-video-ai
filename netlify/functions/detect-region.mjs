// Detect user's region and return localized pricing.
// Reads Netlify edge header x-nf-country (2-letter ISO country).
// Falls back to Accept-Language header if country is unavailable.

// Monthly pricing per plan in the country's native currency.
// To add a country: add an entry here. Unknown countries fall back to US pricing.
// For Stripe integration: each currency needs a matching Stripe Price ID
// (display price is informational until Stripe products are configured).
const PRICING = {
  JP: { currency: 'JPY', symbol: '¥', locale: 'ja-JP',
        plans: { free: 0, starter: 1980, growth: 2980, scale: 9800 } },
  US: { currency: 'USD', symbol: '$', locale: 'en-US',
        plans: { free: 0, starter: 12.99, growth: 19.99, scale: 64.99 } },
  GB: { currency: 'GBP', symbol: '£', locale: 'en-GB',
        plans: { free: 0, starter: 9.99, growth: 15.99, scale: 49.99 } },
  DE: { currency: 'EUR', symbol: '€', locale: 'de-DE',
        plans: { free: 0, starter: 11.99, growth: 18.99, scale: 59.99 } },
  FR: { currency: 'EUR', symbol: '€', locale: 'fr-FR',
        plans: { free: 0, starter: 11.99, growth: 18.99, scale: 59.99 } },
  ES: { currency: 'EUR', symbol: '€', locale: 'es-ES',
        plans: { free: 0, starter: 11.99, growth: 18.99, scale: 59.99 } },
  IT: { currency: 'EUR', symbol: '€', locale: 'it-IT',
        plans: { free: 0, starter: 11.99, growth: 18.99, scale: 59.99 } },
  KR: { currency: 'KRW', symbol: '₩', locale: 'ko-KR',
        plans: { free: 0, starter: 17900, growth: 27900, scale: 94900 } },
  TW: { currency: 'TWD', symbol: 'NT$', locale: 'zh-TW',
        plans: { free: 0, starter: 399, growth: 599, scale: 1999 } },
  CN: { currency: 'CNY', symbol: '¥', locale: 'zh-CN',
        plans: { free: 0, starter: 99, growth: 149, scale: 499 } },
  TH: { currency: 'THB', symbol: '฿', locale: 'th-TH',
        plans: { free: 0, starter: 459, growth: 699, scale: 2299 } },
  VN: { currency: 'VND', symbol: '₫', locale: 'vi-VN',
        plans: { free: 0, starter: 299000, growth: 499000, scale: 1590000 } },
  ID: { currency: 'IDR', symbol: 'Rp', locale: 'id-ID',
        plans: { free: 0, starter: 199000, growth: 299000, scale: 990000 } },
  BR: { currency: 'BRL', symbol: 'R$', locale: 'pt-BR',
        plans: { free: 0, starter: 59, growth: 99, scale: 329 } },
  NG: { currency: 'NGN', symbol: '₦', locale: 'en-NG',
        plans: { free: 0, starter: 9999, growth: 14999, scale: 49999 } },
  ZA: { currency: 'ZAR', symbol: 'R', locale: 'en-ZA',
        plans: { free: 0, starter: 199, growth: 299, scale: 999 } },
  IN: { currency: 'INR', symbol: '₹', locale: 'en-IN',
        plans: { free: 0, starter: 999, growth: 1599, scale: 4999 } },
  AU: { currency: 'AUD', symbol: 'A$', locale: 'en-AU',
        plans: { free: 0, starter: 18.99, growth: 29.99, scale: 99.99 } },
  CA: { currency: 'CAD', symbol: 'C$', locale: 'en-CA',
        plans: { free: 0, starter: 16.99, growth: 26.99, scale: 89.99 } },
};

const LANG_TO_COUNTRY = {
  ja: 'JP', ko: 'KR', 'zh-tw': 'TW', 'zh-cn': 'CN', th: 'TH',
  vi: 'VN', id: 'ID', de: 'DE', fr: 'FR', es: 'ES', 'pt-br': 'BR',
  it: 'IT', en: 'US', 'en-us': 'US', 'en-gb': 'GB',
};

function pickCountryFromAcceptLang(header) {
  if (!header) return null;
  const primary = header.split(',')[0].trim().toLowerCase();
  const base = primary.split('-')[0];
  return LANG_TO_COUNTRY[primary] || LANG_TO_COUNTRY[base] || null;
}

function formatPrice(amount, symbol, locale) {
  if (amount === 0) return symbol + '0';
  try {
    const isInteger = Number.isInteger(amount);
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2,
    });
    return symbol + formatter.format(amount);
  } catch {
    return symbol + amount;
  }
}

export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const countryHeader = req.headers.get('x-nf-country') || req.headers.get('x-country') || '';
  const acceptLang = req.headers.get('accept-language') || '';

  let country = countryHeader.toUpperCase();
  let source = 'geoip';

  if (!country || !PRICING[country]) {
    const fromLang = pickCountryFromAcceptLang(acceptLang);
    if (fromLang) {
      country = fromLang;
      source = 'accept-language';
    } else {
      country = 'US';
      source = 'default';
    }
  }

  const cfg = PRICING[country] || PRICING.US;
  const plans = {};
  for (const [plan, amount] of Object.entries(cfg.plans)) {
    plans[plan] = {
      amount,
      formatted: formatPrice(amount, cfg.symbol, cfg.locale),
    };
  }

  return new Response(
    JSON.stringify({
      country,
      currency: cfg.currency,
      symbol: cfg.symbol,
      locale: cfg.locale,
      plans,
      source,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        ...cors,
      },
    }
  );
};

export const config = { path: '/api/detect-region' };
