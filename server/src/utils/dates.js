import { env } from '../config/env.js';

const dayFormatter = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: env.APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// Date-only fields (deadlines, challan due dates) are stored as UTC midnight of
// the chosen day, so they are keyed by their UTC date. Timed events are keyed by
// the app timezone.
export function dayKey(date, { dateOnly = false } = {}) {
  const d = new Date(date);
  return dateOnly ? d.toISOString().slice(0, 10) : dayFormatter().format(d);
}

const keyToUTC = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole calendar days from today (in the app timezone) until `date`. */
export function daysUntil(date, { dateOnly = false, now = new Date() } = {}) {
  return Math.round((keyToUTC(dayKey(date, { dateOnly })) - keyToUTC(dayKey(now))) / 86_400_000);
}

export const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86_400_000);

/** UTC midnight of today's date in the app timezone — comparable to date-only fields. */
export const todayStart = (now = new Date()) => new Date(`${dayKey(now)}T00:00:00.000Z`);

export function formatDate(date, { dateOnly = false, withTime = false } = {}) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: dateOnly ? 'UTC' : env.APP_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime && !dateOnly ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(date));
}
