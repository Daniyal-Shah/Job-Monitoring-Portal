import { Router } from 'express';
import { Application, Event, Job } from '../models/index.js';
import { isAdmin, scopedMember } from '../middleware/auth.js';
import { badRequest } from '../utils/http.js';
import { CLOSED_STATUSES } from '../utils/constants.js';

const router = Router();

/**
 * Unified list of dated items: application deadlines, challan payment due
 * dates and recruitment events, between `from` and `to`.
 */
export async function calendarItems(req, from, to, memberFilter) {
  const member = scopedMember(req) || (isAdmin(req) ? memberFilter : null) || null;
  const appScope = member ? { member } : {};

  const jobFilter = { archived: false, lastDate: { $gte: from, $lte: to } };
  if (member) jobFilter._id = { $in: await Application.distinct('job', { member }) };

  const [jobs, unpaid, events] = await Promise.all([
    Job.find(jobFilter).select('title department organization lastDate').lean(),
    Application.find({ ...appScope, 'fee.status': 'unpaid', 'fee.dueDate': { $gte: from, $lte: to }, status: { $nin: CLOSED_STATUSES } })
      .select('job member fee status')
      .populate({ path: 'job', select: 'title department archived' })
      .populate('member', 'name color')
      .lean(),
    Event.find({ ...appScope, date: { $gte: from, $lte: to } })
      .populate('job', 'title department')
      .populate('member', 'name color')
      .lean(),
  ]);

  const jobApps = await Application.find({ ...appScope, job: { $in: jobs.map((j) => j._id) } })
    .select('job member status')
    .populate('member', 'name color')
    .lean();

  const items = [
    ...jobs.map((j) => ({
      id: `deadline:${j._id}`,
      kind: 'deadline',
      title: `Last date: ${j.title}`,
      subtitle: j.department,
      date: j.lastDate,
      dateOnly: true,
      link: `/jobs/${j._id}`,
      job: { _id: j._id, title: j.title, department: j.department },
      members: jobApps.filter((a) => String(a.job) === String(j._id)).map((a) => ({ ...a.member, status: a.status })),
    })),
    ...unpaid
      .filter((a) => a.job && !a.job.archived)
      .map((a) => ({
        id: `challan:${a._id}`,
        kind: 'challan',
        title: `Challan due: ${a.job.title}`,
        subtitle: a.fee.amount ? `Rs. ${a.fee.amount.toLocaleString('en-PK')}` : a.job.department,
        date: a.fee.dueDate,
        dateOnly: true,
        link: `/applications/${a._id}`,
        job: a.job,
        members: [a.member],
      })),
    ...events
      .filter((e) => e.job)
      .map((e) => ({
        id: `event:${e._id}`,
        kind: 'event',
        type: e.type,
        status: e.status,
        title: e.title || e.type,
        subtitle: e.job.title,
        location: e.location,
        date: e.date,
        dateOnly: false,
        link: `/applications/${e.application}`,
        eventId: e._id,
        job: e.job,
        members: [e.member],
      })),
  ];
  return items.sort((a, b) => new Date(a.date) - new Date(b.date));
}

router.get('/', async (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (Number.isNaN(+from) || Number.isNaN(+to)) throw badRequest('from and to dates are required');
  if (to - from > 400 * 86_400_000) throw badRequest('Date range too large');
  res.json({ items: await calendarItems(req, from, to, req.query.member) });
});

export default router;
