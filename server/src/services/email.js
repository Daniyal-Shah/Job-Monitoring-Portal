import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const emailEnabled = () => Boolean(resend);

/**
 * Send an email through Resend. Without RESEND_API_KEY the email is logged to
 * the console instead (useful in development) and reported as simulated.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    console.log(`[email:simulated] to=${to} subject="${subject}"`);
    return { id: null, simulated: true };
  }
  const { data, error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html, text });
  if (error) throw new Error(error.message || 'Resend rejected the email');
  return { id: data?.id, simulated: false };
}
