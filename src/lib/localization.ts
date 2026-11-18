// Location-to-currency and location-to-timezone resolution.
// Matching is done by scanning the location string for known country/city keywords.
// All IANA timezone IDs used here are valid per the ECMA-402 spec.

interface LocaleInfo {
  currency: string;   // ISO 4217
  timezone: string;   // IANA timezone ID
  label: string;      // Human-friendly display, e.g. "IST (GMT+5:30)"
}

// Order matters: more-specific entries first (city before country where ambiguous)
const LOCATION_RULES: Array<{ keywords: string[]; info: LocaleInfo }> = [
  // ── India ──────────────────────────────────────────────────────────────
  {
    keywords: ['chennai', 'madurai', 'coimbatore', 'trichy', 'tiruchirappalli',
               'salem', 'tirunelveli', 'vellore', 'erode', 'madras',
               'bangalore', 'bengaluru', 'hyderabad', 'mumbai', 'bombay',
               'delhi', 'new delhi', 'kolkata', 'calcutta', 'pune', 'ahmedabad',
               'india', ' in,', ', in'],
    info: { currency: 'INR', timezone: 'Asia/Kolkata', label: 'IST (GMT+5:30)' },
  },
  // ── Sri Lanka ───────────────────────────────────────────────────────────
  {
    keywords: ['jaffna', 'colombo', 'kandy', 'galle', 'sri lanka', 'srilanka', 'lk,', ', lk'],
    info: { currency: 'LKR', timezone: 'Asia/Colombo', label: 'SLST (GMT+5:30)' },
  },
  // ── Singapore ───────────────────────────────────────────────────────────
  {
    keywords: ['singapore', ' sg,', ', sg'],
    info: { currency: 'SGD', timezone: 'Asia/Singapore', label: 'SGT (GMT+8)' },
  },
  // ── Malaysia ────────────────────────────────────────────────────────────
  {
    keywords: ['kuala lumpur', 'kl,', 'malaysia', 'penang', 'johor', ' my,', ', my'],
    info: { currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', label: 'MYT (GMT+8)' },
  },
  // ── Canada ──────────────────────────────────────────────────────────────
  {
    keywords: ['toronto', 'ottawa', 'hamilton', 'mississauga', 'brampton'],
    info: { currency: 'CAD', timezone: 'America/Toronto', label: 'ET (GMT-5/-4)' },
  },
  {
    keywords: ['vancouver', 'victoria', 'surrey'],
    info: { currency: 'CAD', timezone: 'America/Vancouver', label: 'PT (GMT-8/-7)' },
  },
  {
    keywords: ['calgary', 'edmonton'],
    info: { currency: 'CAD', timezone: 'America/Edmonton', label: 'MT (GMT-7/-6)' },
  },
  {
    keywords: ['montreal', 'québec', 'quebec'],
    info: { currency: 'CAD', timezone: 'America/Toronto', label: 'ET (GMT-5/-4)' },
  },
  {
    keywords: ['canada', ' ca,', ', ca'],
    info: { currency: 'CAD', timezone: 'America/Toronto', label: 'ET (GMT-5/-4)' },
  },
  // ── United Kingdom ──────────────────────────────────────────────────────
  {
    keywords: ['london', 'manchester', 'birmingham', 'glasgow', 'edinburgh',
               'leeds', 'bristol', 'uk', 'united kingdom', 'england', 'scotland', 'wales', ' gb,', ', gb'],
    info: { currency: 'GBP', timezone: 'Europe/London', label: 'GMT/BST (GMT+0/+1)' },
  },
  // ── Australia ───────────────────────────────────────────────────────────
  {
    keywords: ['sydney', 'canberra', 'melbourne', 'brisbane', 'gold coast', 'newcastle'],
    info: { currency: 'AUD', timezone: 'Australia/Sydney', label: 'AEST/AEDT (GMT+10/+11)' },
  },
  {
    keywords: ['perth'],
    info: { currency: 'AUD', timezone: 'Australia/Perth', label: 'AWST (GMT+8)' },
  },
  {
    keywords: ['adelaide'],
    info: { currency: 'AUD', timezone: 'Australia/Adelaide', label: 'ACST/ACDT (GMT+9:30/+10:30)' },
  },
  {
    keywords: ['australia', ' au,', ', au'],
    info: { currency: 'AUD', timezone: 'Australia/Sydney', label: 'AEST/AEDT (GMT+10/+11)' },
  },
  // ── New Zealand ─────────────────────────────────────────────────────────
  {
    keywords: ['auckland', 'wellington', 'christchurch', 'new zealand', 'nz,', ', nz'],
    info: { currency: 'NZD', timezone: 'Pacific/Auckland', label: 'NZST/NZDT (GMT+12/+13)' },
  },
  // ── UAE ─────────────────────────────────────────────────────────────────
  {
    keywords: ['dubai', 'abu dhabi', 'sharjah', 'uae', 'united arab', ' ae,', ', ae'],
    info: { currency: 'AED', timezone: 'Asia/Dubai', label: 'GST (GMT+4)' },
  },
  // ── USA ─────────────────────────────────────────────────────────────────
  {
    keywords: ['new york', 'nyc', 'boston', 'miami', 'atlanta', 'washington', 'philadelphia'],
    info: { currency: 'USD', timezone: 'America/New_York', label: 'ET (GMT-5/-4)' },
  },
  {
    keywords: ['chicago', 'houston', 'dallas', 'san antonio', 'minneapolis', 'kansas city', 'nashville'],
    info: { currency: 'USD', timezone: 'America/Chicago', label: 'CT (GMT-6/-5)' },
  },
  {
    keywords: ['denver', 'salt lake', 'phoenix', 'albuquerque', 'tucson'],
    info: { currency: 'USD', timezone: 'America/Denver', label: 'MT (GMT-7/-6)' },
  },
  {
    keywords: ['san francisco', 'los angeles', 'seattle', 'portland', 'las vegas', 'san diego', 'san jose'],
    info: { currency: 'USD', timezone: 'America/Los_Angeles', label: 'PT (GMT-8/-7)' },
  },
  {
    keywords: ['usa', 'united states', 'america', ' us,', ', us'],
    info: { currency: 'USD', timezone: 'America/New_York', label: 'ET (GMT-5/-4)' },
  },
  // ── Germany ─────────────────────────────────────────────────────────────
  {
    keywords: ['berlin', 'munich', 'hamburg', 'frankfurt', 'germany', 'deutschland', ' de,', ', de'],
    info: { currency: 'EUR', timezone: 'Europe/Berlin', label: 'CET/CEST (GMT+1/+2)' },
  },
  // ── France ──────────────────────────────────────────────────────────────
  {
    keywords: ['paris', 'lyon', 'marseille', 'france', ' fr,', ', fr'],
    info: { currency: 'EUR', timezone: 'Europe/Paris', label: 'CET/CEST (GMT+1/+2)' },
  },
  // ── Japan ───────────────────────────────────────────────────────────────
  {
    keywords: ['tokyo', 'osaka', 'kyoto', 'japan', ' jp,', ', jp'],
    info: { currency: 'JPY', timezone: 'Asia/Tokyo', label: 'JST (GMT+9)' },
  },
  // ── South Africa ────────────────────────────────────────────────────────
  {
    keywords: ['johannesburg', 'cape town', 'durban', 'south africa', ' za,', ', za'],
    info: { currency: 'ZAR', timezone: 'Africa/Johannesburg', label: 'SAST (GMT+2)' },
  },
];

const FALLBACK: LocaleInfo = { currency: 'USD', timezone: 'UTC', label: 'UTC (GMT+0)' };

/**
 * Resolves currency and timezone from a freeform location string.
 * Returns null if the location string is empty/too short to match.
 * Returns the fallback (USD/UTC) if nothing matches.
 */
export function resolveLocaleFromLocation(location: string): LocaleInfo | null {
  const trimmed = location.trim();
  if (trimmed.length < 2) return null;

  const lower = trimmed.toLowerCase();

  for (const rule of LOCATION_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.info;
    }
  }

  return FALLBACK;
}

/**
 * Returns a human-friendly timezone label for display.
 * Falls back to the device timezone if no location is provided.
 */
export function getTimezoneLabel(ianaId: string): string {
  // Find a matching rule by timezone ID first
  for (const rule of LOCATION_RULES) {
    if (rule.info.timezone === ianaId) return rule.info.label;
  }
  // Generic fallback: derive offset from Intl
  try {
    const abbr = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaId,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? ianaId;
    return abbr;
  } catch {
    return ianaId;
  }
}
