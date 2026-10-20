import { assertEnv, env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';

async function main() {
  assertEnv();
  await connectDB();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[server] storage=${env.STORAGE_DRIVER} email=${env.RESEND_API_KEY ? 'resend' : 'console (simulated)'}`);
  });
  startScheduler();
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
