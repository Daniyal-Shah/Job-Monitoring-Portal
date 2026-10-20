import { Router } from 'express';
import { Application, Member } from '../models/index.js';
import { CLOSED_STATUSES } from '../utils/constants.js';
import { addDays, todayStart } from '../utils/dates.js';
import { castMatch } from '../utils/mongo.js';
import { applicationFilter } from './applications.js';
import { calendarItems } from './calendar.js';

const router = Router();

const sumIf = (cond, field = '$fee.amount') => ({ $sum: { $cond: [cond, field, 0] } });

router.get('/', async (req, res) => {
  const match = castMatch(await applicationFilter(req, { ...req.query, includeArchived: 'true' }));
  const today = todayStart();
  const isUnpaid = { $eq: ['$fee.status', 'unpaid'] };
  const isPaid = { $eq: ['$fee.status', 'paid'] };
  const isOverdue = { $and: [isUnpaid, { $lt: ['$fee.dueDate', today] }, { $ne: [{ $ifNull: ['$fee.dueDate', null] }, null] }] };

  const [byStatus, byMember, byDepartment, expenses, monthly, payments] = await Promise.all([
    Application.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$member',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $in: ['$status', CLOSED_STATUSES] }, 0, 1] } },
          selected: { $sum: { $cond: [{ $eq: ['$status', 'selected'] }, 1, 0] } },
          paid: sumIf(isPaid),
          unpaid: sumIf(isUnpaid),
        },
      },
    ]),
    Application.aggregate([
      { $match: match },
      { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'job', pipeline: [{ $project: { department: 1 } }] } },
      { $group: { _id: { $first: '$job.department' }, count: { $sum: 1 }, paid: sumIf(isPaid) } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          paid: sumIf(isPaid),
          unpaid: sumIf(isUnpaid),
          overdue: sumIf(isOverdue),
          paidCount: { $sum: { $cond: [isPaid, 1, 0] } },
          unpaidCount: { $sum: { $cond: [isUnpaid, 1, 0] } },
          overdueCount: { $sum: { $cond: [isOverdue, 1, 0] } },
        },
      },
    ]),
    Application.aggregate([
      { $match: { ...match, 'fee.status': 'paid', 'fee.paidDate': { $gte: addDays(today, -365) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$fee.paidDate' } }, amount: { $sum: '$fee.amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Application.find({ ...match, 'fee.status': { $in: ['paid', 'unpaid'] } })
      .select('job member fee status')
      .populate('job', 'title department')
      .populate('member', 'name color')
      .sort({ 'fee.paidDate': -1, 'fee.dueDate': 1 })
      .lean(),
  ]);

  const members = await Member.find({ _id: { $in: byMember.map((m) => m._id) } }).select('name color').lean();
  const memberMap = new Map(members.map((m) => [String(m._id), m]));

  res.json({
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    byMember: byMember.map((m) => ({ ...m, member: memberMap.get(String(m._id)) })).sort((a, b) => b.total - a.total),
    byDepartment: byDepartment.map((d) => ({ department: d._id || 'Unknown', count: d.count, paid: d.paid })),
    expenses: expenses[0] || { paid: 0, unpaid: 0, overdue: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0 },
    monthly: monthly.map((m) => ({ month: m._id, amount: m.amount, count: m.count })),
    payments,
    upcoming: await calendarItems(req, today, addDays(today, 60), req.query.member),
  });
});

export default router;
