import { env } from '../config/env.js';
import { EVENT_LABELS, STATUS_LABELS } from '../utils/constants.js';
import { formatDate } from '../utils/dates.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const inDays = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);

function layout({ heading, intro, rows = [], cta, footer }) {
  const rowsHtml = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#0f172a">${esc(v)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#4f46e5;color:#fff;padding:16px 24px;font-size:14px;font-weight:600">${esc(env.APP_NAME)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px;color:#0f172a">${esc(heading)}</h1>
<p style="margin:0 0 16px;color:#334155;line-height:1.5">${esc(intro)}</p>
${rowsHtml ? `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px">${rowsHtml}</table>` : ''}
${cta ? `<a href="${esc(cta.url)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">${esc(cta.label)}</a>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px">${esc(footer || 'You receive these emails because notifications are enabled for your profile. Ask the portal administrator to change your preferences.')}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, '', intro, '', ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), '', cta ? `${cta.label}: ${cta.url}` : '']
    .join('\n')
    .trim();
  return { html, text };
}

const appUrl = (path) => `${env.APP_URL}${path}`;
const fee = (n) => (n ? `Rs. ${Number(n).toLocaleString('en-PK')}` : undefined);

export function newJobEmail({ member, job, assigned }) {
  return {
    subject: `New job: ${job.title} — ${job.department}`,
    ...layout({
      heading: 'A new job has been added',
      intro: `Hi ${member.name}, ${assigned ? 'a new job has been added to the portal and assigned to you' : 'a new job has been added to the portal'}.`,
      rows: [
        ['Job', job.title],
        ['Department', job.department],
        ['Organization', job.organization],
        ['Advertisement no.', job.advertisementNumber],
        ['BPS', job.bps],
        ['Application fee', fee(job.applicationFee)],
        ['Last date', job.lastDate && formatDate(job.lastDate, { dateOnly: true })],
      ],
      cta: { label: 'View job', url: appUrl(`/jobs/${job._id}`) },
    }),
  };
}

export function deadlineEmail({ member, job, application, days }) {
  return {
    subject: `Deadline ${inDays(days)}: ${job.title}`,
    ...layout({
      heading: `Application deadline ${inDays(days)}`,
      intro: `Hi ${member.name}, the last date to apply for ${job.title} is ${formatDate(job.lastDate, { dateOnly: true })}. Your application is not yet marked as submitted.`,
      rows: [
        ['Job', job.title],
        ['Department', job.department],
        ['Advertisement no.', job.advertisementNumber],
        ['Apply at', job.applyLink || job.officialLink],
      ],
      cta: { label: 'Open application', url: appUrl(`/applications/${application._id}`) },
    }),
  };
}

export function challanEmail({ member, job, application, dueDate, days }) {
  return {
    subject: `Challan due ${inDays(days)}: ${job.title}`,
    ...layout({
      heading: `Challan payment due ${inDays(days)}`,
      intro: `Hi ${member.name}, the application fee for ${job.title} is still unpaid. The payment deadline is ${formatDate(dueDate, { dateOnly: true })}.`,
      rows: [
        ['Job', job.title],
        ['Amount', fee(application.fee?.amount)],
        ['Challan no.', application.fee?.challanNumber],
        ['Bank', application.fee?.bank],
      ],
      cta: { label: 'Update payment', url: appUrl(`/applications/${application._id}`) },
    }),
  };
}

export function eventEmail({ member, job, event, days }) {
  const label = EVENT_LABELS[event.type] || 'Event';
  return {
    subject: `${label} ${inDays(days)}: ${job.title}`,
    ...layout({
      heading: `${event.title || label} ${inDays(days)}`,
      intro: `Hi ${member.name}, you have an upcoming ${label.toLowerCase()} for ${job.title}.`,
      rows: [
        ['What', event.title || label],
        ['When', formatDate(event.date, { withTime: true })],
        ['Where', event.location],
        ['Job', `${job.title} — ${job.department}`],
        ['Notes', event.notes],
      ],
      cta: { label: 'View details', url: appUrl(`/applications/${event.application}`) },
    }),
  };
}

export function statusChangeEmail({ member, job, application, status, note }) {
  return {
    subject: `Status update: ${job.title} — ${STATUS_LABELS[status]}`,
    ...layout({
      heading: 'Your application status changed',
      intro: `Hi ${member.name}, the status of your application for ${job.title} is now "${STATUS_LABELS[status]}".`,
      rows: [
        ['Job', job.title],
        ['Department', job.department],
        ['New status', STATUS_LABELS[status]],
        ['Note', note],
      ],
      cta: { label: 'View application', url: appUrl(`/applications/${application._id}`) },
    }),
  };
}

export function testEmail({ member }) {
  return {
    subject: `Test email from ${env.APP_NAME}`,
    ...layout({
      heading: 'Email notifications are working',
      intro: `Hi ${member.name}, this is a test email. Reminders will be sent ${member.notifications?.reminderDays?.join(', ') || '7, 3, 1'} day(s) before important dates.`,
      cta: { label: 'Open portal', url: appUrl('/') },
    }),
  };
}
