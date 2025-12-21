import type { PreferredLanguage } from '@/store/profileStore';

export type PackageRow = {
  price_amount?: number | null;
  price_currency?: string | null;
  price_type?: 'fixed' | 'starting_from' | null;
};

function getPricePrefix(priceType: PackageRow['price_type'], lang: PreferredLanguage): string {
  if (priceType !== 'starting_from') return '';
  if (lang === 'ar') return 'ابتداءً من ';
  if (lang === 'de') return 'Ab ';
  return 'Starting from ';
}

function getLocale(lang: PreferredLanguage): string {
  if (lang === 'ar') return 'ar';
  if (lang === 'de') return 'de-DE';
  return 'en';
}

export function formatPrice(row: PackageRow, lang: PreferredLanguage): string | null {
  const amount = row.price_amount;
  const currency = row.price_currency;

  if (amount == null || !currency) {
    if (__DEV__) console.log('[formatPrice] missing amount/currency', { amount, currency });
    return null;
  }

  const prefix = getPricePrefix(row.price_type ?? null, lang);

  try {
    const formatted = new Intl.NumberFormat(getLocale(lang), {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);

    return `${prefix}${formatted}`;
  } catch (e) {
    console.warn('[formatPrice] Intl.NumberFormat failed, falling back', {
      lang,
      amount,
      currency,
      error: e instanceof Error ? e.message : String(e),
    });

    return `${prefix}${amount} ${currency}`;
  }
}
