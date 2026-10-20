// Usage: npm run create-admin -- "Full Name" email@example.com "password"
import mongoose from 'mongoose';
import { assertEnv } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { User } from '../models/index.js';

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- "Full Name" email@example.com "password (8+ chars)"');
  process.exit(1);
}
assertEnv();
await connectDB();
let user = await User.findOne({ email: email.toLowerCase() });
if (!user) user = new User({ name, email, role: 'admin' });
user.set({ name, role: 'admin', active: true });
await user.setPassword(password);
await user.save();
console.log(`Admin ready: ${user.email}`);
await mongoose.disconnect();
