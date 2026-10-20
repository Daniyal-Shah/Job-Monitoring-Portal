import { Router } from 'express';
import { z } from 'zod';
import { Application, Document, Job } from '../models/index.js';
import { isAdmin, requireAdmin, scopedMember } from '../middleware/auth.js';
import { notFound, paging, parse, escapeRegex, forbidden } from '../utils/http.js';
import { objectId, optDate, optNum, optUrl, str } from '../utils/schemas.js';
import { todayStart, addDays } from '../utils/dates.js';
import { assignJob, loadJob } from '../services/applications.js';
import { deleteApplications, deleteDocuments } from '../services/cleanup.js';
import { background, notifyNewJob } from '../services/notify.js';

const router = Router();

const jobSchema = z.object({
  title: str(200).min(1, 'Title is required'),
  department: str(200).min(1, 'Department is required'),
  organization: str(200).optional(),
  advertisementNumber: str(100).optional(),
  advertisementDate: optDate,
  bps: optNum(1, 22),
  salary: str(100).optional(),
  numberOfPosts: optNum(0, 100000),
  location: str(200).optional(),
  qualification: str(2000).optional(),
  eligibility: str(5000).optional(),
  ageLimit: str(200).optional(),
  applicationFee: optNum(0, 1e7),
  lastDate: optDate,
  officialLink: optUrl,
  applyLink: optUrl,
  notes: str(5000).optional(),
  tags: z.array(str(50)).max(20).optional(),
});

async function scopedJobIds(req) {
  const scope = scopedMember(req);
  return scope ? Application.distinct('job', { member: scope }) : null;
}

router.get('/', async (req, res) => {
  const { q, department, organization, deadline, archived, member, sort } = req.query;
  const filter = { archived: archived === 'true' ? true : archived === 'all' ? { $in: [true, false] } : false };
  const ids = await scopedJobIds(req);
  if (ids) filter._id = { $in: ids };
  if (member && isAdmin(req)) filter._id = { $in: await Application.distinct('job', { member }) };
  if (department) filter.department = department;
  if (organization) filter.organization = organization;
  if (q) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [{ title: rx }, { department: rx }, { organization: rx }, { advertisementNumber: rx }, { location: rx }, { tags: rx }];
  }
  const today = todayStart();
  if (deadline === 'upcoming') filter.lastDate = { $gte: today };
  if (deadline === 'week') filter.lastDate = { $gte: today, $lte: addDays(today, 7) };
  if (deadline === 'passed') filter.lastDate = { $lt: today };

  const sorts = { deadline: { lastDate: 1 }, newest: { createdAt: -1 }, title: { title: 1 } };
  const { page, limit, skip } = paging(req.query, { defaultLimit: 50 });
  const [jobs, total] = await Promise.all([
    Job.find(filter).sort(sorts[sort] || sorts.newest).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);

  const appFilter = { job: { $in: jobs.map((j) => j._id) } };
  const scope = scopedMember(req);
  if (scope) appFilter.member = scope;
  const apps = await Application.find(appFilter).select('job member status fee.status').populate('member', 'name color').lean();
  const byJob = new Map();
  for (const a of apps) byJob.set(String(a.job), [...(byJob.get(String(a.job)) || []), a]);
  res.json({
    jobs: jobs.map((j) => ({ ...j, applications: byJob.get(String(j._id)) || [] })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

router.get('/meta/filters', async (req, res) => {
  const ids = await scopedJobIds(req);
  const filter = ids ? { _id: { $in: ids } } : {};
  const [departments, organizations] = await Promise.all([Job.distinct('department', filter), Job.distinct('organization', filter)]);
  res.json({ departments: departments.filter(Boolean).sort(), organizations: organizations.filter(Boolean).sort() });
});

router.post('/', requireAdmin, async (req, res) => {
  const body = parse(jobSchema.extend({ assignTo: z.array(objectId).optional(), notify: z.boolean().optional() }), req.body);
  const { assignTo = [], notify = true, ...data } = body;
  const job = await Job.create({ ...data, createdBy: req.user.id });
  const assigned = assignTo.length ? await assignJob(job, assignTo, req.user) : [];
  if (notify) background(notifyNewJob(job, assigned), 'new job');
  res.status(201).json({ job });
});

router.get('/:id', async (req, res) => {
  const job = await Job.findById(req.params.id).populate('createdBy', 'name').lean();
  if (!job) throw notFound('Job');
  const scope = scopedMember(req);
  const appFilter = { job: job._id, ...(scope ? { member: scope } : {}) };
  const applications = await Application.find(appFilter).populate('member', 'name color email').select('-timeline').lean();
  if (scope && !applications.length) throw forbidden();
  const documents = await Document.find({
    $or: [{ job: job._id, application: null }, { application: { $in: applications.map((a) => a._id) } }],
  })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ job, applications, documents: documents.map(({ key, ...d }) => d) });
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const body = parse(jobSchema.partial(), req.body);
  const job = await Job.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!job) throw notFound('Job');
  res.json({ job });
});

router.post('/:id/archive', requireAdmin, async (req, res) => {
  const { archived } = parse(z.object({ archived: z.boolean() }), req.body);
  const job = await Job.findByIdAndUpdate(req.params.id, { archived }, { new: true });
  if (!job) throw notFound('Job');
  res.json({ job });
});

router.post('/:id/assign', requireAdmin, async (req, res) => {
  const { memberIds, notify = true } = parse(z.object({ memberIds: z.array(objectId).min(1), notify: z.boolean().optional() }), req.body);
  const job = await loadJob(req.params.id);
  const assigned = await assignJob(job, memberIds, req.user);
  if (notify && assigned.length) background(notifyNewJob(job, assigned), 'job assignment');
  res.json({ assigned: assigned.length });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw notFound('Job');
  await deleteApplications({ job: job._id });
  await deleteDocuments({ job: job._id });
  await job.deleteOne();
  res.json({ ok: true });
});

export default router;
