/**
 * Scheduled reminder engine. For every member with notifications enabled it
 * looks at upcoming application deadlines, unpaid challans and recruitment
 * events, and sends one email per configured offset (e.g. 7, 3 and 1 days
 * before). Dedupe keys include the target date, so if a date is rescheduled
 * the member is reminded again for the new date, but never twice for the same
 * offset of the same date.
 */
import { Application, Event, Member } from '../models/index.js';
import { PRE_SUBMISSION_STATUSES, CLOSED_STATUSES } from '../utils/constants.js';
import { addDays, dayKey, daysUntil, todayStart } from '../utils/dates.js';
import { deliver, wants } from './notify.js';
import * as templates from './emailTemplates.js';

let running = false;

const normalizeOffsets = (days) => [...new Set((days || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 60))].sort((a, b) => a - b);

/**
 * Pick the reminder offset that applies today: the smallest configured offset
 * that is >= days remaining. This catches up if the server was down on the
 * exact day, without sending older reminders as well.
 */
function offsetFor(days, offsets) {
  if (days < 0) return undefined;
  return offsets.find((o) => o >= days);
}

async function remind({ member, offsets, kind, refId, date, dateOnly, build, refs, now }) {
  const days = daysUntil(date, { dateOnly, now });
  const offset = offsetFor(days, offsets);
  if (offset === undefined) return null;
  const dedupeKey = `${kind}:${refId}:${member._id}:${offset}:${dayKey(date, { dateOnly })}`;
  return deliver({ member, kind, dedupeKey, message: build(days), ...refs });
}

export async function runReminders({ now = new Date(), memberId } = {}) {
  if (running) return { skipped: true, reason: 'A reminder run is already in progress' };
  running = true;
  const stats = { sent: 0, failed: 0, duplicate: 0, members: 0 };
  const tally = (r) => r && (stats[r.status] = (stats[r.status] || 0) + 1);

  try {
    const filter = { active: true, 'notifications.enabled': true, ...(memberId ? { _id: memberId } : {}) };
    const members = await Member.find(filter);
    const from = addDays(todayStart(now), -1);

    for (const member of members) {
      const offsets = normalizeOffsets(member.notifications.reminderDays);
      if (!offsets.length || !member.email) continue;
      stats.members += 1;
      const horizon = addDays(now, offsets.at(-1) + 1);

      // 1. Application deadlines for jobs not yet applied to.
      if (wants(member, 'deadlines')) {
        const apps = await Application.find({ member: member._id, status: { $in: PRE_SUBMISSION_STATUSES } }).populate({
          path: 'job',
          match: { archived: false, lastDate: { $gte: from, $lte: horizon } },
        });
        for (const app of apps.filter((a) => a.job)) {
          tally(
            await remind({
              member, offsets, now, kind: 'deadline', refId: app._id, date: app.job.lastDate, dateOnly: true,
              build: (days) => templates.deadlineEmail({ member, job: app.job, application: app, days }),
              refs: { job: app.job, application: app },
            }),
          );
        }
      }

      // 2. Unpaid challans (due date falls back to the job's last date).
      if (wants(member, 'challans')) {
        const apps = await Application.find({
          member: member._id,
          'fee.status': 'unpaid',
          status: { $nin: CLOSED_STATUSES },
        }).populate({ path: 'job', match: { archived: false } });
        for (const app of apps.filter((a) => a.job)) {
          const due = app.fee?.dueDate || app.job.lastDate;
          if (!due || due < from || due > horizon) continue;
          tally(
            await remind({
              member, offsets, now, kind: 'challan', refId: app._id, date: due, dateOnly: true,
              build: (days) => templates.challanEmail({ member, job: app.job, application: app, dueDate: due, days }),
              refs: { job: app.job, application: app },
            }),
          );
        }
      }

      // 3. Tests, interviews and other recruitment events.
      if (wants(member, 'events')) {
        const events = await Event.find({
          member: member._id,
          status: { $in: ['scheduled', 'postponed'] },
          date: { $gte: from, $lte: horizon },
        }).populate('job');
        for (const event of events.filter((e) => e.job)) {
          tally(
            await remind({
              member, offsets, now, kind: 'event', refId: event._id, date: event.date, dateOnly: false,
              build: (days) => templates.eventEmail({ member, job: event.job, event, days }),
              refs: { job: event.job, application: event.application, event },
            }),
          );
        }
      }
    }
    return stats;
  } finally {
    running = false;
  }
}
