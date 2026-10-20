import mongoose from 'mongoose';
import { EVENT_STATUSES, EVENT_TYPES } from '../utils/constants.js';

const eventSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    // Denormalized from the application for fast calendar/reminder queries.
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    type: { type: String, enum: EVENT_TYPES, required: true },
    title: { type: String, trim: true },
    date: { type: Date, required: true, index: true },
    location: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: EVENT_STATUSES, default: 'scheduled' },
  },
  { timestamps: true },
);

export const Event = mongoose.model('Event', eventSchema);
