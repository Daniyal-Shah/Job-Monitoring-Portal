import cron from 'node-cron';
import { env } from '../config/env.js';
import { runReminders } from '../services/reminders.js';

export function startScheduler() {
  if (!env.ENABLE_SCHEDULER) {
    console.log('[scheduler] disabled (ENABLE_SCHEDULER=false)');
    return null;
  }
  if (!cron.validate(env.REMINDER_CRON)) throw new Error(`Invalid REMINDER_CRON: ${env.REMINDER_CRON}`);

  const run = async () => {
    try {
      const stats = await runReminders();
      if (stats.sent || stats.failed) console.log('[scheduler] reminders', stats);
    } catch (err) {
      console.error('[scheduler] reminder run failed:', err);
    }
  };
  const task = cron.schedule(env.REMINDER_CRON, run, { timezone: env.APP_TIMEZONE });
  console.log(`[scheduler] reminders scheduled "${env.REMINDER_CRON}" (${env.APP_TIMEZONE})`);
  // Catch up shortly after boot in case the server was down at a scheduled time.
  setTimeout(run, 15_000).unref();
  return task;
}
