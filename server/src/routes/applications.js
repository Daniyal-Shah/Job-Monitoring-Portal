import { Router } from 'express';
import { z } from 'zod';
import { Application, Document, Event, Job, Member } from '../models/index.js';
import { assertMemberAccess, requireAdmin, scopedMember } from '../middleware/auth.js';
import { HttpError, notFound, paging, parse, escapeRegex } from '../utils/http.js';
import { APPLICATION_STATUSES, CLOSED_STATUSES, FEE_STATUSES } from '../utils/constants.js';
import { objectId, optDate, optNum, str } from '../utils/schemas.js';
import { todayStart } from '../utils/dates.js';
import { feeDefaults, loadJob } from '../services/applications.js';
import { deleteApplications } from '../services/cleanup.js';
import { background, notifyStatusChange } from '../services/notify.js';

const router = Router();

const feeSchema = z
  .object({
    status: z.enum(FEE_STATUSES),
    amount: optNum(0, 1e7),
    challanNumber: str(100),
    bank: str(100),
    dueDate: optDate,
    paidDate: optDate,
    notes: str(1000),
  })
  .partial();

const updateSchema = z
  .object({
    appliedDate: optDate,
    applicationNumber: str(100),
    rollNumber: str(100),
    testCentre: str(200),
    marks: str(100),
    meritPosition: str(100),
    notes: str(5000),
    fee: feeSchema,
  })
  .partial();

/** Build a Mongo filter from list query params, honoring member scope. */
export async function applicationFilter(req, query = req.query) {
  const filter = {};
  const scope = scopedMember(req);
  if (scope) filter.member = scope;
  else if (query.member) filter.member = query.member;

  if (query.status) filter.status = { $in: String(query.status).split(',') };
  if (query.stage === 'active') filter.status = { $nin: CLOSED_STATUSES };
  if (query.stage === 'closed') filter.status = { $in: CLOSED_STATUSES };

  const today = todayStart();
  if (query.payment === 'overdue') Object.assign(filter, { 'fee.status': 'unpaid', 'fee.dueDate': { $lt: today } });
  else if (query.payment === 'due') Object.assign(filter, { 'fee.status': 'unpaid', $or: [{ 'fee.dueDate': { $gte: today } }, { 'fee.dueDate': null }] });
  else if (query.payment) filter['fee.status'] = query.payment;

  const jobFilter = {};
  if (query.department) jobFilter.department = query.department;
  if (query.q) {
    const rx = new RegExp(escapeRegex(String(query.q).trim()), 'i');
    jobFilter.$or = [{ title: rx }, { department: rx }, { organization: rx }, { advertisementNumber: rx }];
  }
  if (query.deadlineFrom || query.deadlineTo) {
    jobFilter.lastDate = {};
    if (query.deadlineFrom) jobFilter.lastDate.$gte = new Date(query.deadlineFrom);
    if (query.deadlineTo) jobFilter.lastDate.$lte = new Date(query.deadlineTo);
  }
  if (query.includeArchived !== 'true') jobFilter.archived = false;
  if (Object.keys(jobFilter).length) filter.job = { $in: await Job.distinct('_id', jobFilter) };
  return filter;
}

async function loadApplication(req, id = req.params.id) {
  const app = await Application.findById(id);
  if (!app) throw notFound('Application');
  assertMemberAccess(req, app.member);
  return app;
}

router.get('/', async (req, res) => {
  const filter = await applicationFilter(req);
  const { page, limit, skip } = paging(req.query, { defaultLimit: 50 });
  const sorts = { updated: { updatedAt: -1 }, created: { createdAt: -1 }, due: { 'fee.dueDate': 1 } };
  const [applications, total] = await Promise.all([
    Application.find(filter)
      .select('-timeline')
      .sort(sorts[req.query.sort] || sorts.updated)
      .skip(skip)
      .limit(limit)
      .populate('job', 'title department organization advertisementNumber lastDate bps applicationFee archived')
      .populate('member', 'name color')
      .lean(),
    Application.countDocuments(filter),
  ]);
  res.json({ applications, total, page, pages: Math.ceil(total / limit) });
});

router.post('/', async (req, res) => {
  const body = parse(updateSchema.extend({ job: objectId, member: objectId, status: z.enum(APPLICATION_STATUSES).optional() }), req.body);
  assertMemberAccess(req, body.member);
  const job = await loadJob(body.job);
  if (!(await Member.exists({ _id: body.member }))) throw notFound('Member');
  if (await Application.exists({ job: job._id, member: body.member })) throw new HttpError(409, 'This member already has an application for this job');
  const status = body.status || 'discovered';
  const application = await Application.create({
    ...body,
    status,
    fee: { ...feeDefaults(job), ...(body.fee || {}) },
    timeline: [{ status, note: 'Application created', by: req.user.id, byName: req.user.name }],
  });
  res.status(201).json({ application });
});

router.get('/:id', async (req, res) => {
  const application = await Application.findById(req.params.id).populate('job').populate('member', 'name color email').lean();
  if (!application) throw notFound('Application');
  assertMemberAccess(req, application.member);
  const [events, documents] = await Promise.all([
    Event.find({ application: application._id }).sort({ date: 1 }).lean(),
    Document.find({ $or: [{ application: application._id }, { job: application.job._id, application: null }] })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  application.timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ application, events, documents: documents.map(({ key, ...d }) => d) });
});

router.patch('/:id', async (req, res) => {
  const body = parse(updateSchema, req.body);
  const app = await loadApplication(req);
  const { fee, ...rest } = body;
  app.set(rest);
  if (fee) {
    app.fee = { ...app.fee.toObject(), ...fee };
    if (fee.status === 'paid' && !app.fee.paidDate) app.fee.paidDate = todayStart();
    if (fee.status && fee.status !== 'paid') app.fee.paidDate = null;
  }
  await app.save();
  res.json({ application: app });
});

router.post('/:id/status', async (req, res) => {
  const body = parse(
    z.object({ status: z.enum(APPLICATION_STATUSES), note: str(2000).optional(), date: optDate, notify: z.boolean().optional() }),
    req.body,
  );
  const app = await loadApplication(req);
  app.status = body.status;
  if (['applied', 'challan_paid'].includes(body.status) && !app.appliedDate) app.appliedDate = body.date || todayStart();
  // Paying the challan settles the fee, which also stops challan reminders.
  if (body.status === 'challan_paid' && app.fee?.status === 'unpaid') {
    app.fee.status = 'paid';
    app.fee.paidDate = app.fee.paidDate || body.date || todayStart();
  }
  app.timeline.push({ status: body.status, note: body.note, date: body.date || new Date(), by: req.user.id, byName: req.user.name });
  await app.save();
  const entry = app.timeline.at(-1);

  if (body.notify !== false) {
    const [job, member] = await Promise.all([Job.findById(app.job), Member.findById(app.member)]);
    background(notifyStatusChange({ application: app, job, member, status: body.status, note: body.note, timelineId: entry._id }), 'status change');
  }
  res.json({ application: app });
});

router.delete('/:id/timeline/:entryId', requireAdmin, async (req, res) => {
  const app = await loadApplication(req);
  app.timeline.pull({ _id: req.params.entryId });
  await app.save();
  res.json({ application: app });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const app = await loadApplication(req);
  await deleteApplications({ _id: app._id });
  res.json({ ok: true });
});

export default router;
