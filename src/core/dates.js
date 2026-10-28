// Calendar arithmetic on plain ISO dates (YYYY-MM-DD) in UTC, so results never depend on the server's time zone.
const DAY = 86400000;

export function toDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
}

export const iso = (d) => d.toISOString().slice(0, 10);

export const todayIso = (now = new Date()) => iso(now);

export function daysBetween(from, to) {
  return Math.round((toDate(to) - toDate(from)) / DAY);
}

export function addDays(date, days) {
  return iso(new Date(toDate(date).getTime() + days * DAY));
}

// Adding a month keeps the day of the month where it exists: 31 January + 1 month is 28 or 29 February.
export function addMonths(date, months) {
  const d = toDate(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay))));
}

export function shift(date, duration, sign = 1) {
  let out = date;
  if (duration.months) out = addMonths(out, sign * duration.months);
  if (duration.days) out = addDays(out, sign * duration.days);
  return out;
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, eighteen: 18, twenty: 20, thirty: 30, sixty: 60, ninety: 90,
};

// "60 days", "90 calendar days' notice", "3 months", "1 year", "six months" -> { months, days }; anything else -> null.
export function parseDuration(text) {
  const t = String(text || '').toLowerCase().replace(/[’']/g, '');
  const m = /(\d+|[a-z]+)\s*(?:\(\d+\)\s*)?(?:calendar\s+|business\s+)?(day|week|month|year)s?\b/.exec(t);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
  if (!n) return null;
  if (/business/.test(t)) return null; // business days need a holiday calendar; flag instead of guessing
  if (m[2] === 'day') return { months: 0, days: n };
  if (m[2] === 'week') return { months: 0, days: 7 * n };
  if (m[2] === 'month') return { months: n, days: 0 };
  return { months: 12 * n, days: 0 };
}

export function formatDuration(d) {
  if (!d) return '';
  if (d.days) return `${d.days} day${d.days === 1 ? '' : 's'}`;
  if (d.months % 12 === 0 && d.months > 12) return `${d.months / 12} years`;
  return `${d.months} month${d.months === 1 ? '' : 's'}`;
}

// Rough length in days, only for comparing a notice period with a term.
export const approxDays = (d) => (d ? d.months * 30.44 + d.days : 0);

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// ISO dates, "1 February 2025" and "February 1, 2025". Numeric day/month orders are ambiguous, so they are rejected.
export function parseDate(text) {
  const t = String(text || '').trim();
  const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(t);
  if (isoMatch) return toDate(isoMatch[1]) ? isoMatch[1] : null;
  const lower = t.toLowerCase();
  let m = /\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/.exec(lower);
  let day; let month; let year;
  if (m) { [, day, month, year] = m; } else {
    m = /\b([a-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/.exec(lower);
    if (!m) return null;
    [, month, day, year] = m;
  }
  const mi = MONTHS.findIndex((name) => name.startsWith(month.slice(0, 3)) && month.length >= 3);
  if (mi < 0) return null;
  const out = `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return toDate(out) ? out : null;
}

export function formatDate(date) {
  const d = toDate(date);
  if (!d) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 1).toUpperCase()}${MONTHS[d.getUTCMonth()].slice(1, 3)} ${d.getUTCFullYear()}`;
}
