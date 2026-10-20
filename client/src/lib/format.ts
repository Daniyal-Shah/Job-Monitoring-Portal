import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * Date-only values (deadlines, challan dates) are stored as UTC midnight; we
 * render them from their UTC components so the day never shifts by timezone.
 */
export function asLocalDay(value: string | Date) {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function fmtDate(value?: string | null, pattern = 'd MMM yyyy') {
  if (!value) return '—';
  return format(asLocalDay(value), pattern);
}

export function fmtDateTime(value?: string | null, pattern = 'd MMM yyyy, h:mm a') {
  if (!value) return '—';
  return format(parseISO(value), pattern);
}

/** Days from today until a date-only or timed value. */
export function daysUntil(value: string, dateOnly = true) {
  return differenceInCalendarDays(dateOnly ? asLocalDay(value) : parseISO(value), new Date());
}

export function relativeDays(days: number) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export const money = (n?: number | null) => `Rs. ${(n || 0).toLocaleString('en-PK')}`;

export function fileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Value for <input type="date"> from a stored date-only value. */
export const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

/** Value for <input type="datetime-local"> from an ISO instant, in local time. */
export function toDateTimeInput(value?: string | null) {
  if (!value) return '';
  return format(parseISO(value), "yyyy-MM-dd'T'HH:mm");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
