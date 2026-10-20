import { Member, Notification } from '../models/index.js';
import { sendEmail } from './email.js';
import * as templates from './emailTemplates.js';

const MAX_ATTEMPTS = 3;

/**
 * Reserve a notification slot for `dedupeKey`. Returns null if an email with
 * this key was already sent (or is being sent), or exhausted its retries.
 */
async function claim(dedupeKey, base) {
  if (!dedupeKey) return Notification.create({ ...base, status: 'pending' });
  try {
    return await Notification.create({ ...base, dedupeKey, status: 'pending' });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  // Retry a previously failed send.
  return Notification.findOneAndUpdate(
    { dedupeKey, status: 'failed', attempts: { $lt: MAX_ATTEMPTS } },
    { $set: { status: 'pending', ...base } },
    { new: true },
  );
}

/** Send one email and record the outcome in the notification history. */
export async function deliver({ member, kind, dedupeKey, message, job, application, event }) {
  const notif = await claim(dedupeKey, {
    member: member._id,
    email: member.email,
    kind,
    subject: message.subject,
    job: job?._id ?? job,
    application: application?._id ?? application,
    event: event?._id ?? event,
  });
  if (!notif) return { status: 'duplicate' };

  notif.attempts += 1;
  try {
    const result = await sendEmail({ to: member.email, subject: message.subject, html: message.html, text: message.text });
    Object.assign(notif, { status: 'sent', sentAt: new Date(), providerId: result.id, simulated: result.simulated, error: undefined });
  } catch (err) {
    Object.assign(notif, { status: 'failed', error: String(err.message || err).slice(0, 500) });
    console.error(`[notify] ${kind} to ${member.email} failed:`, err.message);
  }
  await notif.save();
  return { status: notif.status, notification: notif };
}

const wants = (member, pref) => member?.active && member.notifications?.enabled && member.notifications?.[pref] && member.email;

/** Email members about a newly published job. Fire-and-forget safe. */
export async function notifyNewJob(job, assignedMemberIds = []) {
  const assigned = new Set(assignedMemberIds.map(String));
  const members = await Member.find({
    active: true,
    'notifications.enabled': true,
    'notifications.newJobs': true,
    $or: [{ _id: { $in: [...assigned] } }, { 'notifications.allNewJobs': true }],
  });
  const results = [];
  for (const member of members) {
    results.push(
      await deliver({
        member,
        kind: 'new_job',
        dedupeKey: `new_job:${job._id}:${member._id}`,
        message: templates.newJobEmail({ member, job, assigned: assigned.has(String(member._id)) }),
        job,
      }),
    );
  }
  return results;
}

export async function notifyStatusChange({ application, job, member, status, note, timelineId }) {
  if (!wants(member, 'statusChanges')) return { status: 'skipped' };
  return deliver({
    member,
    kind: 'status_change',
    dedupeKey: `status:${application._id}:${timelineId}`,
    message: templates.statusChangeEmail({ member, job, application, status, note }),
    job,
    application,
  });
}

export async function sendTestEmail(member) {
  return deliver({ member, kind: 'test', message: templates.testEmail({ member }) });
}

/** Run a notification without letting failures break the calling request. */
export function background(promise, label) {
  Promise.resolve(promise).catch((err) => console.error(`[notify] ${label} failed:`, err));
}

export { wants };
