import { Application, Job, Member } from '../models/index.js';
import { HttpError, notFound } from '../utils/http.js';

/** Default challan details for a new application, taken from the job. */
export function feeDefaults(job) {
  return job.applicationFee > 0
    ? { status: 'unpaid', amount: job.applicationFee, dueDate: job.lastDate }
    : { status: 'not_required', amount: 0 };
}

/** Assign a job to members by creating "discovered" applications. Skips existing ones. */
export async function assignJob(job, memberIds, user) {
  const members = await Member.find({ _id: { $in: memberIds } }).select('_id').lean();
  if (members.length !== new Set(memberIds.map(String)).size) throw notFound('Member');
  const existing = new Set((await Application.find({ job: job._id }).select('member').lean()).map((a) => String(a.member)));
  const toCreate = members.filter((m) => !existing.has(String(m._id)));
  const created = await Application.insertMany(
    toCreate.map((m) => ({
      job: job._id,
      member: m._id,
      status: 'discovered',
      fee: feeDefaults(job),
      timeline: [{ status: 'discovered', note: 'Job assigned', by: user.id, byName: user.name }],
    })),
  );
  return created.map((a) => a.member);
}

export async function loadJob(id) {
  const job = await Job.findById(id);
  if (!job) throw notFound('Job');
  if (job.archived) throw new HttpError(400, 'This job is archived');
  return job;
}
