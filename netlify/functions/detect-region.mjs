// Detect user's region and return localized pricing.
// Reads Netlify edge header x-nf-country (2-letter ISO country).
// Falls back to Accept-Language header if country is unavailable.

// Monthly pricing per plan in the country's native currency.
// To add a country: add an entry here. Unknown countries fall back to US pricing.
// For Stripe integration: each currency needs a matching Stripe Price ID
// (display price is informational until Stripe products are configured).
// Plan tiers: free / pro / business / studio
const PRICING = {
  JP: { currency: 'JPY', symbol: '¥', locale: 'ja-JP',
        plans: { free: 0, pro: 2980, business: 9800, studio: 29800 } },
  US: { currency: 'USD', symbol: '$', locale: 'en-US',
        plans: { free: 0, pro: 19.99, business: 64.99, studio: 199 } },
  GB: { currency: 'GBP', symbol: '£', locale: 'en-GB',
        plans: { free: 0, pro: 15.99, business: 49.99, studio: 159 } },
  DE: { currency: 'EUR', symbol: '€', locale: 'de-DE',
        plans: { free: 0, pro: 18.99, business: 59.99, studio: 179 } },
  FR: { currency: 'EUR', symbol: '€', locale: 'fr-FR',
        plans: { free: 0, pro: 18.99, business: 59.99, studio: 179 } },
  ES: { currency: 'EUR', symbol: '€', locale: 'es-ES',
        plans: { free: 0, pro: 18.99, business: 59.99, studio: 179 } },
  IT: { currency: 'EUR', symbol: '€', locale: 'it-IT',
        plans: { free: 0, pro: 18.99, business: 59.99, studio: 179 } },
  KR: { currency: 'KRW', symbol: '₩', locale: 'ko-KR',
        plans: { free: 0, pro: 27900, business: 94900, studio: 289000 } },
  TW: { currency: 'TWD', symbol: 'NT$', locale: 'zh-TW',
        plans: { free: 0, pro: 599, business: 1999, studio: 5999 } },
  CN: { currency: 'CNY', symbol: '¥', locale: 'zh-CN',
        plans: { free: 0, pro: 149, business: 499, studio: 1499 } },
  TH: { currency: 'THB', symbol: '฿', locale: 'th-TH',
        plans: { free: 0, pro: 699, business: 2299, studio: 6999 } },
  VN: { currency: 'VND', symbol: '₫', locale: 'vi-VN',
        plans: { free: 0, pro: 499000, business: 1590000, studio: 4790000 } },
  ID: { currency: 'IDR', symbol: 'Rp', locale: 'id-ID',
        plans: { free: 0, pro: 299000, business: 990000, studio: 2990000 } },
  BR: { currency: 'BRL', symbol: 'R$', locale: 'pt-BR',
        plans: { free: 0, pro: 99, business: 329, studio: 989 } },
  NG: { currency: 'NGN', symbol: '₦', locale: 'en-NG',
        plans: { free: 0, pro: 14999, business: 49999, studio: 149999 } },
  ZA: { currency: 'ZAR', symbol: 'R', locale: 'en-ZA',
        plans: { free: 0, pro: 299, business: 999, studio: 2999 } },
  IN: { currency: 'INR', symbol: '₹', locale: 'en-IN',
        plans: { free: 0, pro: 1599, business: 4999, studio: 14999 } },
  AU: { currency: 'AUD', symbol: 'A$', locale: 'en-AU',
        plans: { free: 0, pro: 29.99, business: 99.99, studio: 299 } },
  CA: { currency: 'CAD', symbol: 'C$', locale: 'en-CA',
        plans: { free: 0, pro: 26.99, business: 89.99, studio: 269 } },
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
