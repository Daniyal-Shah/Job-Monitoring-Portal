import { Router } from 'express';
import { Notification } from '../models/index.js';
import { requireAdmin, scopedMember } from '../middleware/auth.js';
import { paging } from '../utils/http.js';
import { runReminders } from '../services/reminders.js';
import { emailEnabled } from '../services/email.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/', async (req, res) => {
  const filter = {};
  const scope = scopedMember(req);
  if (scope) filter.member = scope;
  else if (req.query.member) filter.member = req.query.member;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.kind) filter.kind = req.query.kind;
  const { page, limit, skip } = paging(req.query, { defaultLimit: 50 });
  const [notifications, total, counts] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('member', 'name color').populate('job', 'title').lean(),
    Notification.countDocuments(filter),
    Notification.aggregate([{ $match: scope ? { member: scope } : {} }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({
    notifications,
    total,
    page,
    pages: Math.ceil(total / limit),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    config: { emailEnabled: emailEnabled(), schedulerEnabled: env.ENABLE_SCHEDULER, cron: env.REMINDER_CRON, timezone: env.APP_TIMEZONE },
  });
});

router.post('/run-reminders', requireAdmin, async (_req, res) => {
  res.json({ result: await runReminders() });
});

export default router;
