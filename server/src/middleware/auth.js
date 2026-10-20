import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { HttpError, forbidden } from '../utils/http.js';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Session expired, please sign in again');
  }
  const user = await User.findById(payload.sub).lean();
  if (!user || !user.active) throw new HttpError(401, 'Account disabled or not found');
  if (user.role === 'member' && !user.member) throw new HttpError(403, 'Login is not linked to a family member');

  req.user = { id: user._id, name: user.name, email: user.email, role: user.role, member: user.member || null };
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') throw forbidden('Only the portal administrator can do this');
  next();
}

export const isAdmin = (req) => req.user?.role === 'admin';

/** Member id the request is restricted to, or null for admins (unrestricted). */
export const scopedMember = (req) => (isAdmin(req) ? null : req.user.member);

/** Throws 403 unless the record's member belongs to the requesting user (or user is admin). */
export function assertMemberAccess(req, memberId) {
  if (isAdmin(req)) return;
  const id = memberId?._id ?? memberId;
  if (!id || String(id) !== String(req.user.member)) throw forbidden();
}
