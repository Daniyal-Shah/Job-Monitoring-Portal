import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, Member } from '../models/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError, parse } from '../utils/http.js';
import { email, password, str } from '../utils/schemas.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts, try again later' } });

async function sessionFor(user) {
  const member = user.member ? await Member.findById(user.member).lean() : null;
  return { token: signToken(user), user: { ...user.toJSON(), member } };
}

router.get('/status', async (_req, res) => {
  res.json({ needsSetup: (await User.countDocuments()) === 0 });
});

// One-time creation of the first administrator account.
router.post('/setup', loginLimiter, async (req, res) => {
  const body = parse(z.object({ name: str(100).min(1), email, password }), req.body);
  if (await User.exists({})) throw new HttpError(409, 'Setup has already been completed');
  const user = new User({ name: body.name, email: body.email, role: 'admin' });
  await user.setPassword(body.password);
  await user.save();
  res.status(201).json(await sessionFor(user));
});

router.post('/login', loginLimiter, async (req, res) => {
  const body = parse(z.object({ email, password: z.string().min(1) }), req.body);
  const user = await User.findOne({ email: body.email }).select('+passwordHash');
  if (!user || !user.active || !(await user.checkPassword(body.password))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.json(await sessionFor(user));
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).populate('member');
  res.json({ user });
});

router.patch('/me', requireAuth, async (req, res) => {
  const body = parse(z.object({ name: str(100).min(1) }), req.body);
  const user = await User.findByIdAndUpdate(req.user.id, { name: body.name }, { new: true }).populate('member');
  res.json({ user });
});

router.post('/me/password', requireAuth, async (req, res) => {
  const body = parse(z.object({ currentPassword: z.string().min(1), newPassword: password }), req.body);
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!(await user.checkPassword(body.currentPassword))) throw new HttpError(400, 'Current password is incorrect');
  await user.setPassword(body.newPassword);
  await user.save();
  res.json({ ok: true });
});

export default router;
