import mongoose from 'mongoose';
import { env } from '../config/env.js';

const notificationPrefsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    newJobs: { type: Boolean, default: true },
    // Also email this member about new jobs that are not assigned to them.
    allNewJobs: { type: Boolean, default: false },
    deadlines: { type: Boolean, default: true },
    challans: { type: Boolean, default: true },
    events: { type: Boolean, default: true },
    statusChanges: { type: Boolean, default: true },
    reminderDays: { type: [Number], default: () => [...env.DEFAULT_REMINDER_DAYS] },
  },
  { _id: false },
);

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    relation: { type: String, trim: true },
    dateOfBirth: Date,
    qualification: { type: String, trim: true },
    domicile: { type: String, trim: true },
    notes: { type: String, trim: true },
    color: { type: String, default: '#4f46e5' },
    active: { type: Boolean, default: true },
    notifications: { type: notificationPrefsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export const Member = mongoose.model('Member', memberSchema);
