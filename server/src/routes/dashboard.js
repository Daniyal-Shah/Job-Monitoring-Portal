import { Router } from 'express';
import { Application, Event, Job } from '../models/index.js';
import { scopedMember } from '../middleware/auth.js';
import { CLOSED_STATUSES } from '../utils/constants.js';
import { addDays, todayStart } from '../utils/dates.js';
import { calendarItems } from './calendar.js';
import { castMatch } from '../utils/mongo.js';

const router = Router();

router.get('/', async (req, res) => {
  const member = scopedMember(req) || req.query.member || null;
  const appMatch = member ? { member } : {};
  const today = todayStart();
  const activeJobIds = await Job.distinct('_id', { archived: false });
  const activeApps = { ...appMatch, job: { $in: activeJobIds } };
  const jobFilter = { archived: false, ...(member ? { _id: { $in: await Application.distinct('job', appMatch) } } : {}) };

  const [totalJobs, statusAgg, feeAgg, overdue, upcomingEvents, recent, upcoming] = await Promise.all([
    Job.countDocuments(jobFilter),
    Application.aggregate([{ $match: castMatch(activeApps) }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Application.aggregate([
      { $match: castMatch({ ...activeApps, 'fee.status': 'unpaid', status: { $nin: CLOSED_STATUSES } }) },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$fee.amount' } } },
    ]),
    Application.countDocuments({ ...activeApps, 'fee.status': 'unpaid', 'fee.dueDate': { $lt: today }, status: { $nin: CLOSED_STATUSES } }),
    Event.find({ ...appMatch, date: { $gte: today, $lte: addDays(today, 60) }, status: { $in: ['scheduled', 'postponed'] } }).select('type').lean(),
    Application.aggregate([
      { $match: castMatch(appMatch) },
      { $unwind: '$timeline' },
      { $sort: { 'timeline.date': -1 } },
      { $limit: 10 },
      { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'job', pipeline: [{ $project: { title: 1, department: 1 } }] } },
      { $lookup: { from: 'members', localField: 'member', foreignField: '_id', as: 'member', pipeline: [{ $project: { name: 1, color: 1 } }] } },
      { $project: { _id: '$timeline._id', application: '$_id', status: '$timeline.status', note: '$timeline.note', date: '$timeline.date', byName: '$timeline.byName', job: { $first: '$job' }, member: { $first: '$member' } } },
    ]),
    calendarItems(req, today, addDays(today, 30), member),
  ]);

  const byStatus = Object.fromEntries(statusAgg.map((s) => [s._id, s.count]));
  const totalApplications = statusAgg.reduce((n, s) => n + s.count, 0);
  const closed = CLOSED_STATUSES.reduce((n, s) => n + (byStatus[s] || 0), 0);

  res.json({
    stats: {
      totalJobs,
      totalApplications,
      notApplied: byStatus.discovered || 0,
      inProgress: totalApplications - closed - (byStatus.discovered || 0),
      selected: byStatus.selected || 0,
      upcomingDeadlines: upcoming.filter((i) => i.kind === 'deadline').length,
      unpaidChallans: feeAgg[0]?.count || 0,
      unpaidAmount: feeAgg[0]?.amount || 0,
      overdueChallans: overdue,
      scheduledTests: upcomingEvents.filter((e) => ['written_test', 'physical_test'].includes(e.type)).length,
      interviews: upcomingEvents.filter((e) => e.type === 'interview').length,
    },
    byStatus,
    upcoming: upcoming.slice(0, 12),
    recent,
  });
});
export default router;
