// Runs the reminder engine once (e.g. from an external cron instead of the in-process scheduler).
import mongoose from 'mongoose';
import { assertEnv } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { runReminders } from '../services/reminders.js';

assertEnv();
await connectDB();
console.log(await runReminders());
await mongoose.disconnect();
