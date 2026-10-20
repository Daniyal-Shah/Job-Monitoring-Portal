import { Router } from 'express';
import { z } from 'zod';
import { Application, Member, User } from '../models/index.js';
import { assertMemberAccess, isAdmin, requireAdmin, scopedMember } from '../middleware/auth.js';
import { HttpError, notFound, parse } from '../utils/http.js';
import { email, optDate, password, str } from '../utils/schemas.js';
import { sendTestEmail } from '../services/notify.js';

const router = Router();

const prefsSchema = z
  .object({
    enabled: z.boolean(),
    newJobs: z.boolean(),
    allNewJobs: z.boolean(),
    deadlines: z.boolean(),
    challans: z.boolean(),
    events: z.boolean(),
    statusChanges: z.boolean(),
    reminderDays: z.array(z.coerce.number().int().min(0).max(60)).max(6),
  })
  .partial();

const memberSchema = z.object({
  name: str(100).min(1),
  email,
  phone: str(30).optional(),
  relation: str(50).optional(),
  dateOfBirth: optDate,
  qualification: str(200).optional(),
  domicile: str(100).optional(),
  notes: str(2000).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  active: z.boolean().optional(),
  notifications: prefsSchema.optional(),
});

async function withLogin(members) {
  const users = await User.find({ member: { $in: members.map((m) => m._id) } }).lean();
  const byMember = new Map(users.map((u) => [String(u.member), u]));
  return members.map((m) => {
    const u = byMember.get(String(m._id));
    return { ...m, login: u ? { email: u.email, active: u.active, lastLoginAt: u.lastLoginAt } : null };
  });
}

router.get('/', async (req, res) => {
  const scope = scopedMember(req);
  const filter = scope ? { _id: scope } : req.query.active === 'true' ? { active: true } : {};
  const members = await Member.find(filter).sort({ name: 1 }).lean();
  const counts = await Application.aggregate([
    { $match: { member: { $in: members.map((m) => m._id) } } },
    { $group: { _id: '$member', applications: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.applications]));
  const result = members.map((m) => ({ ...m, applicationCount: countMap.get(String(m._id)) || 0 }));
  res.json({ members: isAdmin(req) ? await withLogin(result) : result });
});

router.post('/', requireAdmin, async (req, res) => {
  const body = parse(memberSchema, req.body);
  const member = await Member.create(body);
  res.status(201).json({ member });
});

router.get('/:id', async (req, res) => {
  assertMemberAccess(req, req.params.id);
  const member = await Member.findById(req.params.id).lean();
  if (!member) throw notFound('Member');
  const [withLoginInfo] = isAdmin(req) ? await withLogin([member]) : [member];
  res.json({ member: withLoginInfo });
});

router.patch('/:id', async (req, res) => {
  assertMemberAccess(req, req.params.id);
  // Members may only change their own notification preferences.
  const schema = isAdmin(req) ? memberSchema.partial() : z.object({ notifications: prefsSchema });
  const body = parse(schema, req.body);
  const member = await Member.findById(req.params.id);
  if (!member) throw notFound('Member');
  const { notifications, ...rest } = body;
  member.set(rest);
  if (notifications) member.notifications = { ...member.notifications.toObject(), ...notifications };
  await member.save();
  if (rest.name || rest.active === false) {
    await User.updateOne({ member: member._id }, { $set: { ...(rest.name ? { name: rest.name } : {}), ...(rest.active === false ? { active: false } : {}) } });
  }
  res.json({ member });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  if (await Application.exists({ member: req.params.id })) {
    throw new HttpError(409, 'This member has applications. Deactivate them instead, or delete their applications first.');
  }
  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) throw notFound('Member');
  await User.deleteMany({ member: member._id });
  res.json({ ok: true });
});

// Create or update the login account for a member.
router.put('/:id/login', requireAdmin, async (req, res) => {
  const body = parse(z.object({ email, password: password.optional(), active: z.boolean().optional() }), req.body);
  const member = await Member.findById(req.params.id);
  if (!member) throw notFound('Member');
  let user = await User.findOne({ member: member._id }).select('+passwordHash');
  if (!user) {
    if (!body.password) throw new HttpError(400, 'A password is required to create a login');
    user = new User({ member: member._id, role: 'member', name: member.name });
  }
  user.email = body.email;
  if (body.active !== undefined) user.active = body.active;
  if (body.password) await user.setPassword(body.password);
  await user.save();
  res.json({ login: { email: user.email, active: user.active, lastLoginAt: user.lastLoginAt } });
});

router.delete('/:id/login', requireAdmin, async (req, res) => {
  await User.deleteOne({ member: req.params.id, role: 'member' });
  res.json({ ok: true });
});

router.post('/:id/test-email', requireAdmin, async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw notFound('Member');
  const result = await sendTestEmail(member);
  res.json({ status: result.status, simulated: result.notification?.simulated, error: result.notification?.error });
});

export default router;
