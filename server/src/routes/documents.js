import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { Application, Document, Job } from '../models/index.js';
import { assertMemberAccess, isAdmin, scopedMember } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { badRequest, forbidden, notFound, paging, parse, escapeRegex } from '../utils/http.js';
import { DOCUMENT_TYPES } from '../utils/constants.js';
import { objectId, str } from '../utils/schemas.js';
import { driverFor, localDriver, storage } from '../services/storage.js';

const router = Router();

/** Members can access documents of their own applications and of jobs assigned to them. */
async function assertDocAccess(req, doc) {
  if (isAdmin(req)) return;
  if (doc.member) return assertMemberAccess(req, doc.member);
  if (doc.job && (await Application.exists({ job: doc.job, member: req.user.member }))) return;
  throw forbidden();
}

async function loadDoc(req) {
  const doc = await Document.findById(req.params.id);
  if (!doc) throw notFound('Document');
  await assertDocAccess(req, doc);
  return doc;
}

const strip = ({ key, ...d }) => d;

router.get('/', async (req, res) => {
  const filter = {};
  const scope = scopedMember(req);
  if (scope) {
    const jobIds = await Application.distinct('job', { member: scope });
    filter.$or = [{ member: scope }, { member: null, job: { $in: jobIds } }];
  } else if (req.query.member) {
    filter.member = req.query.member;
  }
  if (req.query.type) filter.type = { $in: String(req.query.type).split(',') };
  if (req.query.job) filter.job = req.query.job;
  if (req.query.application) filter.application = req.query.application;
  if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q)), 'i');

  const { page, limit, skip } = paging(req.query, { defaultLimit: 60 });
  const [documents, total] = await Promise.all([
    Document.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('job', 'title department')
      .populate('member', 'name color')
      .lean(),
    Document.countDocuments(filter),
  ]);
  res.json({ documents: documents.map(strip), total, page, pages: Math.ceil(total / limit) });
});

router.post('/', uploadSingle, async (req, res) => {
  if (!req.file) throw badRequest('Please choose a file to upload');
  const body = parse(
    z.object({
      title: str(200).optional(),
      type: z.enum(DOCUMENT_TYPES).default('other'),
      job: objectId.optional(),
      application: objectId.optional(),
    }),
    req.body,
  );
  if (!body.job && !body.application) throw badRequest('A document must belong to a job or an application');

  let job = body.job;
  let member = null;
  if (body.application) {
    const app = await Application.findById(body.application);
    if (!app) throw notFound('Application');
    assertMemberAccess(req, app.member);
    job = app.job;
    member = app.member;
  } else {
    if (!(await Job.exists({ _id: job }))) throw notFound('Job');
    await assertDocAccess(req, { job });
  }

  const stored = await storage.upload(req.file, { folder: body.application ? 'applications' : 'jobs' });
  const doc = await Document.create({
    title: body.title || req.file.originalname,
    type: body.type,
    job,
    application: body.application,
    member,
    provider: storage.name,
    mimeType: req.file.mimetype,
    originalName: req.file.originalname,
    uploadedBy: req.user.id,
    ...stored,
  });
  res.status(201).json({ document: doc });
});

// Returns a short-lived signed URL for viewing or downloading the file.
router.get('/:id/access', async (req, res) => {
  const doc = await loadDoc(req);
  const url = await driverFor(doc).accessUrl(doc, {
    download: req.query.download === '1',
    baseUrl: `${req.protocol}://${req.get('host')}`,
  });
  res.json({ url, mimeType: doc.mimeType, expiresIn: 600 });
});

router.patch('/:id', async (req, res) => {
  const body = parse(z.object({ title: str(200).min(1), type: z.enum(DOCUMENT_TYPES) }).partial(), req.body);
  const doc = await loadDoc(req);
  doc.set(body);
  await doc.save();
  res.json({ document: doc });
});

router.delete('/:id', async (req, res) => {
  const doc = await loadDoc(req);
  await driverFor(doc).remove(doc);
  await doc.deleteOne();
  res.json({ ok: true });
});

/** Unauthenticated route serving local-driver files via HMAC-signed, expiring URLs. */
export const publicDocumentRouter = Router();
publicDocumentRouter.get('/:id/raw', async (req, res) => {
  const { exp, sig, download } = req.query;
  if (!localDriver.verify(req.params.id, exp, sig)) throw forbidden('This link is invalid or has expired');
  const doc = await Document.findById(req.params.id);
  if (!doc || doc.provider !== 'local') throw notFound('Document');
  const file = localDriver.filePath(doc);
  if (!fs.existsSync(file)) throw notFound('File');
  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.originalName || doc.title)}"`,
  );
  fs.createReadStream(file).pipe(res);
});

export default router;
