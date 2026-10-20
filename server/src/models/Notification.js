import mongoose from 'mongoose';
import { NOTIFICATION_KINDS } from '../utils/constants.js';

const notificationSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    email: String,
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true, index: true },
    // Unique key preventing the same reminder from being sent twice.
    dedupeKey: { type: String, unique: true, sparse: true },
    subject: String,
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    error: String,
    attempts: { type: Number, default: 0 },
    providerId: String,
    simulated: Boolean,
    sentAt: Date,
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  },
  { timestamps: true },
);

export const Notification = mongoose.model('Notification', notificationSchema);
