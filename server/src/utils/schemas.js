import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const str = (max = 2000) => z.string().trim().max(max);
// Empty strings clear a field; `null` clears dates/numbers.
export const optDate = z.union([z.null(), z.literal(''), z.coerce.date()]).transform((v) => (v === '' ? null : v)).optional();
export const optNum = (min = 0, max = 1e9) =>
  z.union([z.null(), z.literal(''), z.coerce.number().min(min).max(max)]).transform((v) => (v === '' ? null : v)).optional();
export const optUrl = z.union([z.literal(''), z.string().trim().url('Must be a valid URL (include https://)')]).optional();
export const email = z.string().trim().toLowerCase().email('Invalid email address');
export const password = z.string().min(8, 'Password must be at least 8 characters').max(200);
