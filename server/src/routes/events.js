import { Router } from 'express';
import { z } from 'zod';
import { Application, Event } from '../models/index.js';
import { assertMemberAccess, scopedMember } from '../middleware/auth.js';
import { notFound, parse } from '../utils/http.js';
import { EVENT_STATUSES, EVENT_TYPES } from '../utils/constants.js';
import { objectId, str } from '../utils/schemas.js';

const router = Router();

const eventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: str(200).optional(),
  date: z.coerce.date(),
  location: str(300).optional(),
  notes: str(2000).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
});

router.get('/', async (req, res) => {
  const filter = {};
  const scope = scopedMember(req);
  if (scope) filter.member = scope;
  else if (req.query.member) filter.member = req.query.member;
  if (req.query.application) filter.application = req.query.application;
  if (req.query.type) filter.type = { $in: String(req.query.type).split(',') };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  const events = await Event.find(filter)
    .sort({ date: 1 })
    .limit(500)
    .populate('job', 'title department')
    .populate('member', 'name color')
    .lean();
  res.json({ events });
});

router.post('/', async (req, res) => {
  const body = parse(eventSchema.extend({ application: objectId }), req.body);
  const app = await Application.findById(body.application);
  if (!app) throw notFound('Application');
  assertMemberAccess(req, app.member);
  const event = await Event.create({ ...body, job: app.job, member: app.member });
  res.status(201).json({ event });
});

async function loadEvent(req) {
  const event = await Event.findById(req.params.id);
  if (!event) throw notFound('Event');
  assertMemberAccess(req, event.member);
  return event;
}

router.patch('/:id', async (req, res) => {
  const body = parse(eventSchema.partial(), req.body);
  const event = await loadEvent(req);
  event.set(body);
  await event.save();
  res.json({ event });
});

router.delete('/:id', async (req, res) => {
  const event = await loadEvent(req);
  await event.deleteOne();
  res.json({ ok: true });
});

export default router;
