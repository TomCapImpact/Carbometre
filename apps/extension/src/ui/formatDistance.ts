const KM_PER_MILE = 1.609344;
const DISTANCE_FORMATTER = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 2 });

/**
 * The regional convention for distance (km vs. miles) is tied to the
 * browser's actual locale, not the fr/en interface language - e.g. an
 * English UI in the UK still shows km, only en-US switches to miles.
 */
export function usesMiles(locale: string = Intl.NumberFormat().resolvedOptions().locale): boolean {
  return locale === 'en-US';
}

export interface FormattedDistance {
  readonly amount: string;
  readonly unit: 'km' | 'mi';
}

/** Converts and formats a distance in kilometres to the caller's regional convention. */
export function formatDistance(km: number, locale?: string): FormattedDistance {
  const miles = usesMiles(locale);
  const amount = miles ? km / KM_PER_MILE : km;
  return {
    amount: DISTANCE_FORMATTER.format(amount),
    unit: miles ? 'mi' : 'km',
  };
}
